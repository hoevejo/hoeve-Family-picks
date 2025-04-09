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
import { sendNotificationToUser } from "../lib/sendNotification"; // ✅ Import the helper

export async function calculateWeeklyResults() {
  console.log("📊 Starting weekly results calculation...");

  const configSnap = await db.doc("config/config").get();
  const configData = configSnap.data();
  const { seasonYear, seasonType, week } = configData;

  // 🏈 Fetch updated game data
  const response = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  const data = await response.json();

  const gameWinners = {};
  const gamesData = [];

  for (const game of data.events) {
    const id = game.id;
    const status = game.status?.type?.name;
    const homeTeam = game.competitions[0].competitors.find(
      (c) => c.homeAway === "home"
    );
    const awayTeam = game.competitions[0].competitors.find(
      (c) => c.homeAway === "away"
    );
    const winnerId = game.competitions[0].winner?.id || null;

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

  // 🧠 Process Picks
  const picksSnap = await db.collection("picks").get();
  const userScores = {};
  const userWeeklyDetails = [];
  const weeklyPicks = [];

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

      await db
        .doc(`picks/${pickDoc.id}`)
        .update({ predictions: updatedPredictions });

      weeklyPicks.push({
        id: pickDoc.id,
        userId: data.userId,
        fullName: data.fullName || "",
        predictions: updatedPredictions,
      });
    }
  }

  // 🧮 Leaderboard Updates
  const type =
    seasonType === "Postseason" ? "leaderboardPostseason" : "leaderboard";
  const leaderboardSnap = await db.collection(type).get();
  const updatedLeaderboard = [];

  for (const docSnap of leaderboardSnap.docs) {
    const entry = docSnap.data();
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

    await db.doc(`${type}/${user.uid}`).set({
      ...user,
      previousRank: user.currentRank || newRank,
      currentRank: newRank,
      positionChange: change,
    });

    prevPoints = totalPoints;
  }

  // 🏆 All-Time Leaderboard
  const allTimeSnap = await db.collection("leaderboardAllTime").get();
  for (const user of allTimeSnap.docs) {
    const entry = user.data();
    const uid = entry.uid;
    const score = userScores[uid] || 0;
    const totalPoints = (entry.totalPoints || 0) + score;

    await db.doc(`leaderboardAllTime/${uid}`).update({ totalPoints });
  }

  // 🧾 Recap & History
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

  const recapDocId = `${seasonYear}-${seasonType}-week${week}`;

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

  // 🔔 Send Push Notification
  await sendNotificationToUser(
    "📊 Weekly Results Are In!",
    `Week ${week} results have been posted. Check out the leaderboard!`
  );

  console.log("✅ Weekly results calculation completed.");
  return { success: true };
}
