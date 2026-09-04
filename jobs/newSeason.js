import { db } from "../lib/firebaseAdmin";
import { normalizeSeasonType } from "../lib/seasonType";

// Firestore batches cap at 500 writes; chunk defensively even though a
// family-sized league is nowhere near that.
const BATCH_LIMIT = 450;

async function commitInChunks(items, applyToBatch) {
  let batch = db.batch();
  let opsInBatch = 0;
  for (const item of items) {
    applyToBatch(batch, item);
    opsInBatch++;
    if (opsInBatch >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();
}

// The leaderboard-shaped collections carry only numeric fields now (see the
// schema-cleanup plan) -- no fullName/profilePicture. Pulling those two
// destructured straight off old docs is what made this job throw on
// .set()'s undefined-field rejection before this rewrite; explicitly
// building a numeric-only record avoids that entirely.
function resetEntry(uid) {
  return {
    uid,
    totalPoints: 0,
    currentRank: 0,
    previousRank: 0,
    positionChange: 0,
    seasonResetAt: new Date(),
  };
}

export async function resetForNewSeason() {
  const cfgSnap = await db.doc("config/config").get();
  const cfg = cfgSnap.data() || {};
  const seasonYear = cfg.seasonYear || new Date().getFullYear();
  const seasonType = normalizeSeasonType(cfg.seasonType);
  const archiveId = `${seasonYear}-${seasonType}-reset-${Date.now()}`;

  const collectionsToWipe = ["games", "picks"];

  console.log("📦 Archiving & clearing old data...");

  const archivedCollections = [];
  const docCounts = {};

  for (const name of collectionsToWipe) {
    const snapshot = await db.collection(name).get();
    if (snapshot.empty) {
      console.log(`⚠️ No data in ${name} to archive.`);
      docCounts[name] = 0;
      continue;
    }

    await commitInChunks(snapshot.docs, (batch, docSnap) => {
      batch.set(
        db.doc(`seasonArchives/${archiveId}/${name}/${docSnap.id}`),
        docSnap.data(),
      );
    });
    await commitInChunks(snapshot.docs, (batch, docSnap) => {
      batch.delete(db.doc(`${name}/${docSnap.id}`));
    });

    archivedCollections.push(name);
    docCounts[name] = snapshot.size;
    console.log(`✅ Archived and cleared ${name}: ${snapshot.size} docs`);
  }

  await db.doc(`seasonArchives/${archiveId}`).set({
    createdAt: new Date(),
    seasonYear,
    seasonType,
    archivedCollections,
    docCounts,
  });
  // Point of last archive lives on config/config now, not a separate
  // write-only config/lastArchive doc.
  await db
    .doc("config/config")
    .set(
      { lastArchive: { archiveId, createdAt: new Date() } },
      { merge: true },
    );

  console.log("🧮 Updating lifetime leaderboard...");

  const allTimeSnap = await db.collection("leaderboards/allTime/entries").get();
  const lifetimeUpdates = [];
  for (const docSnap of allTimeSnap.docs) {
    const data = docSnap.data() || {};
    const lifetimeRef = db.doc(`leaderboards/lifetime/entries/${docSnap.id}`);
    const lifetimeSnap = await lifetimeRef.get();
    const lifetimeData = lifetimeSnap.exists() ? lifetimeSnap.data() || {} : {};

    lifetimeUpdates.push({
      ref: lifetimeRef,
      data: {
        uid: data.uid,
        totalPoints: (lifetimeData.totalPoints || 0) + (data.totalPoints || 0),
        seasonsPlayed: (lifetimeData.seasonsPlayed || 0) + 1,
        lastSeasonPoints: data.totalPoints || 0,
        updatedAt: new Date(),
      },
    });
  }
  await commitInChunks(lifetimeUpdates, (batch, { ref, data }) =>
    batch.set(ref, data),
  );
  console.log("✅ Lifetime leaderboard updated.");

  console.log("🔄 Resetting leaderboards...");

  // Lifetime is deliberately excluded -- it's the cross-season career total
  // just updated above, not something a season reset should zero out.
  const scopesToReset = ["regular", "postseason", "allTime"];

  for (const scope of scopesToReset) {
    const collectionPath = `leaderboards/${scope}/entries`;
    const snapshot = await db.collection(collectionPath).get();
    if (snapshot.empty) {
      console.log(`⚠️ No entries in ${collectionPath} to reset.`);
      continue;
    }

    await commitInChunks(snapshot.docs, (batch, docSnap) => {
      batch.set(
        db.doc(`${collectionPath}/${docSnap.id}`),
        resetEntry(docSnap.id),
      );
    });
    console.log(`✅ Reset: ${collectionPath}`);
  }

  console.log("🎉 All data reset and archived. Ready for a new season!");
  return { success: true, archiveId };
}
