// /jobs/calculateWeeklyResults.js Runs Tuesday at 2am

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import firebaseConfig from "../lib/firebaseConfig";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function calculateWeeklyResults() {
  console.log("Starting weekly results calculation...");

  const configSnap = await getDoc(doc(db, "config", "predictionSettings"));
  const configData = configSnap.data();
  const { seasonYear, seasonType, week } = configData;

  const gamesSnap = await getDoc(
    doc(db, "games", `${seasonYear}-${seasonType}-week${week}`)
  );
  const gamesData = gamesSnap.exists() ? gamesSnap.data().games : [];

  const gameWinners = {};
  for (const game of gamesData) {
    if (game.status === "completed") {
      gameWinners[game.gameId] = game.winnerId;
    }
  }

  const picksSnap = await getDocs(collection(db, "picks"));
  const userScores = {}; // uid -> score
  const userWeeklyDetails = []; // [{ uid, fullName, score }]

  for (const pickDoc of picksSnap.docs) {
    const data = pickDoc.data();
    if (
      data.seasonYear === seasonYear &&
      data.seasonType === seasonType &&
      data.week === week
    ) {
      let weeklyScore = 0;
      const updatedPredictions = {};
      for (const [gameId, prediction] of Object.entries(data.predictions)) {
        const isCorrect =
          gameWinners[gameId] && prediction.teamId === gameWinners[gameId];
        if (isCorrect) weeklyScore++;
        updatedPredictions[gameId] = {
          ...prediction,
          isCorrect: gameWinners[gameId] ? isCorrect : null,
        };
      }
      userScores[data.userId] = weeklyScore;
      userWeeklyDetails.push({
        uid: data.userId,
        fullName: data.fullName || "",
        score: weeklyScore,
      });

      await updateDoc(doc(db, "picks", pickDoc.id), {
        predictions: updatedPredictions,
      });
    }
  }

  const leaderboardCollection =
    seasonType === "Postseason" ? "leaderboardPostseason" : "leaderboard";
  const leaderboardSnap = await getDocs(collection(db, leaderboardCollection));
  const updatedLeaderboard = [];

  for (const user of leaderboardSnap.docs) {
    const entry = user.data();
    const uid = entry.uid;
    const score = userScores[uid] || 0;
    const totalPoints = (entry.totalPoints || 0) + score;

    const updated = {
      ...entry,
      totalPoints,
      lastWeekPoints: score,
    };

    updatedLeaderboard.push(updated);
  }

  updatedLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  let currentRank = 1;
  let skipCount = 0;
  let prevPoints = null;

  for (let i = 0; i < updatedLeaderboard.length; i++) {
    const user = updatedLeaderboard[i];
    const { totalPoints } = user;

    if (prevPoints !== null && totalPoints === prevPoints) {
      skipCount++;
    } else {
      currentRank += skipCount;
      skipCount = 1;
    }

    const newRank = currentRank;
    const change = (user.currentRank || newRank) - newRank;

    await updateDoc(doc(db, leaderboardCollection, user.uid), {
      ...user,
      previousRank: user.currentRank || newRank,
      currentRank: newRank,
      positionChange: change,
    });

    prevPoints = totalPoints;
  }

  const highestScore = Math.max(
    ...updatedLeaderboard.map((u) => u.lastWeekPoints)
  );
  const lowestScore = Math.min(
    ...updatedLeaderboard.map((u) => u.lastWeekPoints)
  );

  const topScorers = updatedLeaderboard
    .filter((u) => u.lastWeekPoints === highestScore)
    .map((u) => ({
      uid: u.uid,
      fullName: u.fullName,
      score: u.lastWeekPoints,
    }));

  const lowestScorers = updatedLeaderboard
    .filter((u) => u.lastWeekPoints === lowestScore)
    .map((u) => ({
      uid: u.uid,
      fullName: u.fullName,
      score: u.lastWeekPoints,
    }));

  const maxRise = Math.max(...updatedLeaderboard.map((u) => u.positionChange));
  const biggestRisers = updatedLeaderboard.filter(
    (u) => u.positionChange === maxRise
  );

  const maxDrop = Math.min(...updatedLeaderboard.map((u) => u.positionChange));
  const biggestFallers = updatedLeaderboard.filter(
    (u) => u.positionChange === maxDrop
  );

  const recapDocId = `${seasonYear}-${seasonType}-week${week}`;
  await setDoc(doc(db, "weeklyRecap", recapDocId), {
    week,
    seasonType,
    seasonYear,
    highestScore,
    lowestScore,
    topScorers,
    lowestScorers,
    biggestRisers,
    biggestFallers,
    scores: userWeeklyDetails,
    createdAt: new Date(),
  });

  // Save snapshot for history
  await setDoc(doc(db, "history", recapDocId), {
    week,
    seasonType,
    seasonYear,
    leaderboard: updatedLeaderboard,
    recap: {
      highestScore,
      lowestScore,
      topScorers,
      lowestScorers,
      biggestRisers,
      biggestFallers,
      scores: userWeeklyDetails,
    },
    games: gamesData,
    createdAt: new Date(),
  });

  console.log("Weekly results calculation completed.");
}

// Uncomment to run manually
// calculateWeeklyResults();
