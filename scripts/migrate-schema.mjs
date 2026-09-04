// One-off migration onto the new Firestore schema.
//
// Usage: pnpm run migrate [-- --commit] [-- --only=users,picks]
// Dry run by default; --commit required to write. Every write is a merge
// keyed by a stable id, so it's idempotent -- safe to re-run. Never
// touches/deletes old collections; that cleanup is manual, once verified.

import { db } from "../lib/firebaseAdmin.js";
import {
  normalizeSeasonType,
  weekKey,
  gameDocId,
  picksDocId,
} from "../lib/seasonType.js";

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").filter(Boolean))
  : null;

function shouldRun(phase) {
  return !ONLY || ONLY.has(phase);
}

const report = {
  publicProfiles: 0,
  leaderboards: { regular: 0, postseason: 0, allTime: 0, lifetime: 0 },
  games: 0,
  picks: 0,
  picksRepaired: 0,
  historyBackfilled: 0,
  errors: [],
};

const BATCH_LIMIT = 450; // headroom under Firestore's 500-write batch cap

// Buffers writes and commits them in chunks; in dry-run mode it only logs.
function makeWriter() {
  let pending = [];
  let planned = 0;

  async function flush() {
    if (!pending.length) return;
    if (COMMIT) {
      const batch = db.batch();
      for (const { ref, data } of pending)
        batch.set(ref, data, { merge: true });
      await batch.commit();
    }
    pending = [];
  }

  async function plan(ref, data, { sample = false } = {}) {
    planned++;
    if (sample && planned <= 5) {
      console.log(`  [plan] ${ref.path} =`, JSON.stringify(data));
    }
    pending.push({ ref, data });
    if (pending.length >= BATCH_LIMIT) await flush();
  }

  return { plan, flush, count: () => planned };
}

async function migrateUsersAndPublicProfiles() {
  if (!shouldRun("users")) return;
  console.log("\n== users -> publicProfiles ==");
  const writer = makeWriter();
  const snap = await db.collection("users").get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const publicData = {
      uid: doc.id,
      firstName: d.firstName || "",
      lastName: d.lastName || "",
      fullName: d.fullName || "",
      displayName: d.displayName || d.fullName || "",
      profilePicture: d.profilePicture || "",
    };
    await writer.plan(db.doc(`publicProfiles/${doc.id}`), publicData, {
      sample: true,
    });
  }
  await writer.flush();
  report.publicProfiles = writer.count();
  console.log(`  ${report.publicProfiles} publicProfiles doc(s) planned`);
  return snap.docs.map((d) => d.id).length
    ? new Map(snap.docs.map((d) => [d.id, d.data() || {}]))
    : new Map();
}

const LEADERBOARD_SOURCES = [
  ["regular", "leaderboard"],
  ["postseason", "leaderboardPostseason"],
  ["allTime", "leaderboardAllTime"],
  ["lifetime", "lifetimeLeaderboard"],
];

function shapeLeaderboardEntry(scope, data) {
  if (scope === "lifetime") {
    return {
      uid: data.uid,
      totalPoints: data.totalPoints || 0,
      seasonsPlayed: data.seasonsPlayed || 0,
      lastSeasonPoints: data.lastSeasonPoints || 0,
      updatedAt: data.updatedAt || new Date(),
    };
  }
  if (scope === "allTime") {
    return {
      uid: data.uid,
      totalPoints: data.totalPoints || 0,
      lastWeekPoints: data.lastWeekPoints || 0,
      lastGradedKey: data.lastGradedKey || "",
    };
  }
  return {
    uid: data.uid,
    totalPoints: data.totalPoints || 0,
    lastWeekPoints: data.lastWeekPoints || 0,
    lastGradedKey: data.lastGradedKey || "",
    currentRank: data.currentRank || 0,
    previousRank: data.previousRank || 0,
    positionChange: data.positionChange || 0,
  };
}

async function migrateLeaderboards() {
  if (!shouldRun("leaderboards")) return;
  console.log("\n== leaderboards ==");
  for (const [scope, oldCollection] of LEADERBOARD_SOURCES) {
    const writer = makeWriter();
    const snap = await db.collection(oldCollection).get();
    for (const doc of snap.docs) {
      const data = { uid: doc.id, ...(doc.data() || {}) };
      await writer.plan(
        db.doc(`leaderboards/${scope}/entries/${doc.id}`),
        shapeLeaderboardEntry(scope, data),
        { sample: true },
      );
    }
    await writer.flush();
    report.leaderboards[scope] = writer.count();
    console.log(
      `  ${oldCollection} -> leaderboards/${scope}/entries: ${writer.count()} doc(s)`,
    );
  }
}

async function migrateGames() {
  if (!shouldRun("games")) return;
  console.log("\n== games ==");
  const writer = makeWriter();
  const snap = await db.collection("games").get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (!d.seasonYear || !d.seasonType || !d.week || !d.id) {
      report.errors.push(
        `games/${doc.id}: missing seasonYear/seasonType/week/id, skipped`,
      );
      continue;
    }
    const canonicalId = gameDocId({
      seasonYear: d.seasonYear,
      seasonType: d.seasonType,
      week: d.week,
      gameId: d.id,
    });
    const canonicalSeasonType = normalizeSeasonType(d.seasonType);
    if (canonicalId === doc.id && d.seasonType === canonicalSeasonType) {
      continue; // already canonical, nothing to do
    }
    await writer.plan(
      db.doc(`games/${canonicalId}`),
      { ...d, seasonType: canonicalSeasonType },
      { sample: true },
    );
  }
  await writer.flush();
  report.games = writer.count();
  console.log(
    `  ${report.games} game doc(s) planned (already-canonical docs skipped)`,
  );
}

// Folds the dotted-key merge bug's literal fields (e.g. "predictions.123.teamId")
// back into a real nested predictions map. No-op on unaffected docs.
function repairDottedPredictions(data) {
  const predictions = { ...(data.predictions || {}) };
  let repaired = false;
  for (const [key, value] of Object.entries(data)) {
    const match = key.match(/^predictions\.([^.]+)\.(teamId|isCorrect)$/);
    if (!match) continue;
    const [, gameId, field] = match;
    predictions[gameId] = { ...(predictions[gameId] || {}), [field]: value };
    repaired = true;
  }
  return { predictions, repaired };
}

async function migratePicksAndRepairDottedKeys(publicProfilesByUid) {
  if (!shouldRun("picks")) return;
  console.log("\n== picks ==");
  const writer = makeWriter();
  const snap = await db.collection("picks").get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (!d.seasonYear || !d.seasonType || !d.week || !d.userId) {
      report.errors.push(`picks/${doc.id}: missing identity fields, skipped`);
      continue;
    }
    const { predictions, repaired } = repairDottedPredictions(d);
    if (repaired) report.picksRepaired++;

    const canonicalId = picksDocId({
      seasonYear: d.seasonYear,
      seasonType: d.seasonType,
      week: d.week,
      uid: d.userId,
    });
    const fullName =
      d.fullName || publicProfilesByUid?.get(d.userId)?.fullName || "";

    const newData = {
      userId: d.userId,
      seasonYear: d.seasonYear,
      seasonType: normalizeSeasonType(d.seasonType),
      week: d.week,
      fullName,
      predictions,
      ...(d.wager ? { wager: d.wager } : {}),
      ...(d.wagerResult ? { wagerResult: d.wagerResult } : {}),
    };
    await writer.plan(db.doc(`picks/${canonicalId}`), newData, {
      sample: true,
    });
  }
  await writer.flush();
  report.picks = writer.count();
  console.log(
    `  ${report.picks} picks doc(s) planned, ${report.picksRepaired} had dotted-key fields repaired`,
  );
}

async function backfillHistoryFromWeeklyRecap() {
  if (!shouldRun("history")) return;
  console.log("\n== history (backfill from weeklyRecap) ==");
  const writer = makeWriter();
  const snap = await db.collection("weeklyRecap").get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (!d.seasonYear || !d.seasonType || !d.week) {
      report.errors.push(
        `weeklyRecap/${doc.id}: missing identity fields, skipped`,
      );
      continue;
    }
    const canonicalId = weekKey({
      seasonYear: d.seasonYear,
      seasonType: d.seasonType,
      week: d.week,
    });
    const existing = await db.doc(`history/${canonicalId}`).get();
    if (existing.exists) continue; // native history doc already covers this week

    await writer.plan(
      db.doc(`history/${canonicalId}`),
      {
        week: d.week,
        seasonYear: d.seasonYear,
        seasonType: normalizeSeasonType(d.seasonType),
        recap: {
          highestScore: d.highestScore ?? null,
          lowestScore: d.lowestScore ?? null,
          topScorers: d.topScorers || [],
          lowestScorers: d.lowestScorers || [],
          biggestRisers: d.biggestRisers || [],
          biggestFallers: d.biggestFallers || [],
          scores: d.scores || [],
        },
        leaderboard: [],
        picks: [],
        createdAt: d.createdAt || new Date(),
        backfilledFromWeeklyRecap: true,
      },
      { sample: true },
    );
  }
  await writer.flush();
  report.historyBackfilled = writer.count();
  console.log(`  ${report.historyBackfilled} history doc(s) backfilled`);
}

async function main() {
  console.log(
    `Firestore schema migration -- ${COMMIT ? "COMMIT (writing for real)" : "DRY RUN (nothing will be written)"}`,
  );
  if (ONLY) console.log(`Restricted to: ${[...ONLY].join(", ")}`);

  const publicProfilesByUid = await migrateUsersAndPublicProfiles();
  await migrateLeaderboards();
  await migrateGames();
  await migratePicksAndRepairDottedKeys(publicProfilesByUid);
  await backfillHistoryFromWeeklyRecap();

  console.log("\n== Report ==");
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) {
    console.log(
      `\n${report.errors.length} row(s) skipped with errors -- see above.`,
    );
  }
  if (!COMMIT) {
    console.log(
      "\nDry run only -- nothing was written. Re-run with --commit to apply.",
    );
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});
