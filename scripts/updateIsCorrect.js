// /functions/updateIsCorrect.js (serverless function or Firebase Cloud Function) runs after each game block to check if is correct to updat UI on post deadline predictions.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

export default async function handler(req, res) {
  try {
    // 🔄 Get config to know current season/week/type
    const configSnap = await db.doc("config/config").get();
    if (!configSnap.exists) throw new Error("Config not found");

    const config = configSnap.data();
    const { seasonYear, seasonType, week } = config;
    const gameIdPrefix = `${seasonYear}-${seasonType}-week${week}`;

    // 🔍 Get all games for the current week
    const gamesSnap = await db.collection("games").get();
    const thisWeekGames = gamesSnap.docs.filter((doc) => {
      const game = doc.data();
      return (
        game.seasonYear === seasonYear &&
        game.seasonType === seasonType &&
        game.week === week
      );
    });

    for (const gameDoc of thisWeekGames) {
      const game = gameDoc.data();
      const winnerId = game.winnerId;
      const gameId = game.id;

      if (!winnerId) continue; // Skip unfinished games

      // 🔄 Get all picks for this week
      const picksSnap = await db
        .collection("picks")
        .where("seasonYear", "==", seasonYear)
        .where("seasonType", "==", seasonType)
        .where("week", "==", week)
        .get();

      for (const pickDoc of picksSnap.docs) {
        const pickData = pickDoc.data();
        const prediction = pickData.predictions?.[gameId];

        if (!prediction || prediction.isCorrect !== null) continue; // Skip if no prediction or already marked

        const isCorrect = prediction.teamId === winnerId;

        await db.doc(`picks/${pickDoc.id}`).update({
          [`predictions.${gameId}.isCorrect`]: isCorrect,
        });
      }
    }

    return res
      .status(200)
      .json({ message: "Updated isCorrect for all picks." });
  } catch (error) {
    console.error("Error updating picks:", error);
    return res.status(500).json({ error: error.message });
  }
}
