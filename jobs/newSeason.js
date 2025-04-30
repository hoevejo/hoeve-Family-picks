import { db } from "../lib/firebaseAdmin";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  writeBatch,
  getDoc,
} from "firebase-admin/firestore";

export async function resetForNewSeason() {
  const archivePrefix = `archive-${Date.now()}`;
  const collectionsToWipe = ["games", "picks", "weeklyRecap"];

  console.log("📦 Archiving & Clearing old data...");

  // 🧠 Store archive metadata (optional)
  await setDoc(doc(db, "config", "lastArchive"), {
    prefix: archivePrefix,
    createdAt: new Date(),
  });

  for (const name of collectionsToWipe) {
    const snapshot = await getDocs(collection(db, name));
    if (snapshot.empty) {
      console.log(`⚠️ No data in ${name} to archive.`);
      continue;
    }

    const archiveBatch = writeBatch(db);
    const deleteBatch = writeBatch(db);

    snapshot.forEach((docSnap) => {
      archiveBatch.set(
        doc(db, `${archivePrefix}/${name}-${docSnap.id}`),
        docSnap.data()
      );
      deleteBatch.delete(doc(db, name, docSnap.id));
    });

    await archiveBatch.commit();
    await deleteBatch.commit();
    console.log(`✅ Archived and cleared ${name}: ${snapshot.size} docs`);
  }

  console.log("🧮 Updating lifetime leaderboard...");

  const lifetimeRef = collection(db, "lifetimeLeaderboard");
  const allTimeSnap = await getDocs(collection(db, "leaderboardAllTime"));
  const lifetimeBatch = writeBatch(db);

  for (const docSnap of allTimeSnap.docs) {
    const data = docSnap.data();
    const lifetimeDocRef = doc(lifetimeRef, data.uid);
    const lifetimeSnap = await getDoc(lifetimeDocRef);
    const lifetimeData = lifetimeSnap.exists() ? lifetimeSnap.data() : {};

    lifetimeBatch.set(lifetimeDocRef, {
      uid: data.uid,
      fullName: data.fullName,
      profilePicture: data.profilePicture,
      totalPoints: (lifetimeData.totalPoints || 0) + (data.totalPoints || 0),
      seasonsPlayed: (lifetimeData.seasonsPlayed || 0) + 1,
      lastSeasonPoints: data.totalPoints || 0,
      updatedAt: new Date(),
    });
  }

  await lifetimeBatch.commit();
  console.log("✅ Lifetime leaderboard updated.");

  console.log("🔄 Resetting leaderboards...");

  const leaderboardTypes = [
    "leaderboard",
    "leaderboardPostseason",
    "leaderboardAllTime",
  ];

  for (const type of leaderboardTypes) {
    const snapshot = await getDocs(collection(db, type));
    if (snapshot.empty) {
      console.log(`⚠️ No entries in ${type} to reset.`);
      continue;
    }

    const resetBatch = writeBatch(db);

    snapshot.forEach((docSnap) => {
      const { uid, fullName, profilePicture } = docSnap.data();
      resetBatch.set(doc(db, type, uid), {
        uid,
        fullName,
        profilePicture,
        totalPoints: 0,
        currentRank: 0,
        previousRank: 0,
        positionChange: 0,
        seasonResetAt: new Date(),
      });
    });

    await resetBatch.commit();
    console.log(`✅ Reset: ${type}`);
  }

  console.log("🎉 All data reset and archived. Ready for a new season!");
}
