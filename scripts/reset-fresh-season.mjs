// One-off: wipe the 2025 test season and all pre-migration schema debris,
// keeping user accounts and the schema itself intact for a genuine fresh
// start on the new season.
//
// Usage:
//   pnpm run reset-season                 (dry run, default -- counts only)
//   pnpm run reset-season -- --commit     (deletes for real)
//
// DELETES (all docs, entire collections):
//   - Pre-migration schema debris: leaderboard, leaderboardPostseason,
//     leaderboardAllTime, lifetimeLeaderboard, weeklyRecap
//   - Dead config docs: config/predictionSettings, config/lastArchive
//   - The 2025 season itself, on the NEW schema: games, picks, history,
//     leaderboards/regular/entries, leaderboards/postseason/entries,
//     leaderboards/allTime/entries, leaderboards/lifetime/entries
//   - config/config itself (season-specific; recreated fresh by the next
//     fetchGames run or by the admin page)
//
// PRESERVED, never touched:
//   - users/{uid} and users/{uid}/notificationSubscriptions/*
//   - publicProfiles/{uid}
//   - seasonArchives/* (none exist yet, but left alone regardless)
//
// No archiving step -- this is a deliberate full delete of a test season,
// not a real season boundary (that's jobs/newSeason.js's resetForNewSeason,
// which does archive). Same safety pattern as migrate-schema.mjs: dry run
// by default, --commit required to actually delete.

import { db } from "../lib/firebaseAdmin.js";

const COMMIT = process.argv.includes("--commit");
const BATCH_LIMIT = 450;

const report = { deleted: {}, errors: [] };

async function deleteCollection(path) {
  const snap = await db.collection(path).get();
  if (COMMIT) {
    let batch = db.batch();
    let opsInBatch = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      opsInBatch++;
      if (opsInBatch >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) await batch.commit();
  }
  report.deleted[path] = snap.size;
  console.log(
    `  ${COMMIT ? "Deleted" : "[dry-run] Would delete"} ${snap.size} doc(s) in ${path}`,
  );
}

async function deleteDoc(path) {
  const snap = await db.doc(path).get();
  const existed = snap.exists;
  if (COMMIT && existed) await db.doc(path).delete();
  report.deleted[path] = existed ? 1 : 0;
  console.log(
    `  ${COMMIT ? "Deleted" : "[dry-run] Would delete"} ${path} (${existed ? "exists" : "doesn't exist, no-op"})`,
  );
}

async function main() {
  console.log(
    `Reset fresh season -- ${COMMIT ? "COMMIT (deleting for real)" : "DRY RUN (nothing will be deleted)"}`,
  );

  console.log("\n== Pre-migration schema debris ==");
  for (const name of [
    "leaderboard",
    "leaderboardPostseason",
    "leaderboardAllTime",
    "lifetimeLeaderboard",
    "weeklyRecap",
  ]) {
    await deleteCollection(name);
  }
  await deleteDoc("config/predictionSettings");
  await deleteDoc("config/lastArchive");

  console.log("\n== 2025 season data (new schema) ==");
  for (const name of ["games", "picks", "history"]) {
    await deleteCollection(name);
  }
  for (const scope of ["regular", "postseason", "allTime", "lifetime"]) {
    await deleteCollection(`leaderboards/${scope}/entries`);
  }
  await deleteDoc("config/config");

  console.log("\n== Report ==");
  console.log(JSON.stringify(report, null, 2));
  if (!COMMIT) {
    console.log(
      "\nDry run only -- nothing was deleted. Re-run with --commit to apply.",
    );
  } else {
    console.log(
      "\nDone. users/{uid} and publicProfiles/{uid} were never touched.",
    );
  }
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exitCode = 1;
});
