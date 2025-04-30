import { db } from "../lib/firebaseAdmin";
import {
  collection,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  doc,
} from "firebase-admin/firestore";
import fetch from "node-fetch";
import { sendNotificationToUser } from "../lib/sendNotification";

export async function calculateWeeklyResults() {
  console.log("📊 Starting weekly results calculation...");

  const configSnap = await db.doc("config/config").get();
  const configData = configSnap.data();
  const { seasonYear, seasonType, week } = configData;
  const recapDocId = `${seasonYear}-${seasonType}-week${week}`;

  // 🏈 Fetch updated game data
  const response = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  const data = await response.json();

  const gameWinners = {};
  const gamesData = [];

  for (const game of data.events) {
    const id = game.id;
    const status = game.status?.type?.name || "scheduled";
    const homeTeam = game.competitions[0].competitors.find(
      (c) => c.homeAway === "home"
    );
    const awayTeam = game.competitions[0].competitors.find(
      (c) => c.homeAway === "away"
    );
    const winnerTeam = game.competitions[0].competitors.find((c) => c.winner);
    const winnerId = winnerTeam ? winnerTeam.team.id : null;

    const gameObj = {
      gameId: id,
      name: game.name,
      shortName: game.shortName,
      date: game.date,
      status,
      winnerId,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.team.displayName,
        abbreviation: homeTeam.team.abbreviation,
        score: Number(homeTeam.score),
        logo: homeTeam.team.logo,
        record: homeTeam.records?.[0]?.summary || "",
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.team.displayName,
        abbreviation: awayTeam.team.abbreviation,
        score: Number(awayTeam.score),
        logo: awayTeam.team.logo,
        record: awayTeam.records?.[0]?.summary || "",
      },
    };

    if (status === "STATUS_FINAL" && winnerId) {
      gameWinners[id] = winnerId;
    }

    gamesData.push(gameObj);
  }

  if (Object.keys(gameWinners).length === 0) {
    console.log("⚠️ No final games yet — exiting.");
    return { success: false, message: "No final games available." };
  }

  // 🧠 Process Picks
  const picksSnap = await db
    .collection("picks")
    .where("seasonYear", "==", seasonYear)
    .where("seasonType", "==", seasonType)
    .where("week", "==", week)
    .get();

  const userScores = {};
  const userWeeklyDetails = [];
  const weeklyPicks = [];

  for (const pickDoc of picksSnap.docs) {
    const data = pickDoc.data();
    if (!data.predictions) continue;

    let weeklyScore = 0;
    const updatedPredictions = {};

    for (const [gameId, prediction] of Object.entries(data.predictions)) {
      const correct =
        gameWinners[gameId] && prediction.teamId === gameWinners[gameId];
      if (correct) weeklyScore++;
      updatedPredictions[gameId] = {
        ...prediction,
        isCorrect: gameWinners[gameId] ? correct : null,
      };
    }

    userScores[data.userId] = weeklyScore;
    userWeeklyDetails.push({
      uid: data.userId,
      fullName: data.fullName || "",
      score: weeklyScore,
    });

    await db.doc(`picks/${pickDoc.id}`).update({
      predictions: updatedPredictions,
    });

    weeklyPicks.push({
      id: pickDoc.id,
      userId: data.userId,
      fullName: data.fullName || "",
      predictions: updatedPredictions,
    });
  }

  // 🏆 Leaderboard Updates
  const leaderboardType =
    seasonType === "Postseason" ? "leaderboardPostseason" : "leaderboard";
  const leaderboardSnap = await db.collection(leaderboardType).get();
  const updatedLeaderboard = [];

  for (const docSnap of leaderboardSnap.docs) {
    const entry = docSnap.data();
    const uid = entry.uid;
    const score = userScores[uid] || 0;
    const totalPoints = (entry.totalPoints || 0) + score;

    updatedLeaderboard.push({
      ...entry,
      totalPoints,
      lastWeekPoints: score,
    });
  }

  // 🥇 Sort + Rank
  updatedLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  for (let i = 0; i < updatedLeaderboard.length; i++) {
    const user = updatedLeaderboard[i];
    const sameAsAbove =
      i > 0 && user.totalPoints === updatedLeaderboard[i - 1].totalPoints;
    const newRank = sameAsAbove ? updatedLeaderboard[i - 1].currentRank : i + 1;

    const previousRank = user.currentRank || newRank;
    const change = previousRank - newRank;

    await db.doc(`${leaderboardType}/${user.uid}`).set({
      ...user,
      previousRank,
      currentRank: newRank,
      positionChange: change,
    });

    user.currentRank = newRank;
    user.previousRank = previousRank;
    user.positionChange = change;
  }

  // 🏅 Update All-Time Leaderboard
  const allTimeSnap = await db.collection("leaderboardAllTime").get();
  for (const user of allTimeSnap.docs) {
    const entry = user.data();
    const uid = entry.uid;
    const score = userScores[uid] || 0;
    const totalPoints = (entry.totalPoints || 0) + score;

    await db.doc(`leaderboardAllTime/${uid}`).update({ totalPoints });
  }

  // 📋 Recap + History
  const highestScore = Math.max(
    ...updatedLeaderboard.map((u) => u.lastWeekPoints)
  );
  const lowestScore = Math.min(
    ...updatedLeaderboard.map((u) => u.lastWeekPoints)
  );

  const topScorers = updatedLeaderboard.filter(
    (u) => u.lastWeekPoints === highestScore
  );
  const lowestScorers = updatedLeaderboard.filter(
    (u) => u.lastWeekPoints === lowestScore
  );

  const maxRise = Math.max(...updatedLeaderboard.map((u) => u.positionChange));
  const maxDrop = Math.min(...updatedLeaderboard.map((u) => u.positionChange));
  const biggestRisers = updatedLeaderboard.filter(
    (u) => u.positionChange === maxRise
  );
  const biggestFallers = updatedLeaderboard.filter(
    (u) => u.positionChange === maxDrop
  );

  await db.doc(`weeklyRecap/${recapDocId}`).set({
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

  await db.doc(`history/${recapDocId}`).set({
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
    picks: weeklyPicks,
    createdAt: new Date(),
  });

  // 🔔 Notify Users
  await sendNotificationToUser(
    "📊 Weekly Results Are In!",
    `Week ${week} results have been posted. Check out the leaderboard!`
  );

  console.log("✅ Weekly results calculation completed.");
  return { success: true };
}
