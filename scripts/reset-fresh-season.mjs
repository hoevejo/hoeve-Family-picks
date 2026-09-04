// One-off: wipe a test season and pre-migration schema debris, keeping
// user accounts and the schema itself intact for a genuine fresh start.
//
// Usage: pnpm run reset-season [-- --commit] (dry run by default)
//
// DELETES: the old top-level leaderboard/weeklyRecap collections, dead
// config docs, and the season itself (games/picks/history/leaderboards +
// config/config, recreated fresh by the next fetchGames run).
// PRESERVES: users, publicProfiles, notificationSubscriptions, seasonArchives.
//
// No archiving, unlike jobs/newSeason.js's normal season-reset flow --
// this is a one-off full delete, not a real season boundary.

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
