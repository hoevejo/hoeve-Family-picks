import { db } from "../lib/firebaseAdmin"; // use your admin SDK
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase-admin/firestore"; // ✅ use the admin SDK

export async function resetForNewSeason() {
  const archivePrefix = `archive-${Date.now()}`;
  const collectionsToWipe = ["games", "picks", "weeklyRecap"];

  console.log("📦 Archiving & Clearing old data...");

  for (const name of collectionsToWipe) {
    const snapshot = await getDocs(collection(db, name));
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

    console.log(`✅ Archived and cleared: ${name}`);
  }

  console.log("🔄 Resetting leaderboards...");

  const leaderboardTypes = [
    "leaderboard",
    "leaderboardPostseason",
    "leaderboardAllTime",
  ];

  for (const type of leaderboardTypes) {
    const snapshot = await getDocs(collection(db, type));
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
      });
    });

    await resetBatch.commit();
    console.log(`✅ Reset: ${type}`);
  }

  console.log("🎉 All data reset and archived. Ready for a new season!");
}
