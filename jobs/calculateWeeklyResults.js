import { db } from "../lib/firebaseAdmin";
import fetch from "node-fetch";
import { sendNotificationToUser } from "../lib/sendNotification";

export async function calculateWeeklyResults() {
  console.log("📊 Starting weekly results calculation...");

  // --- Load config
  const configSnap = await db.doc("config/config").get();
  if (!configSnap.exists) throw new Error("Config not found");
  const cfg = configSnap.data();
  if (!cfg) throw new Error("Config doc exists but has no data");
  const { seasonYear, seasonType, week } = cfg;

  // Normalize seasonType to handle case differences: "regular" vs "Regular"
  const seasonTypeSlug = String(seasonType || "").toLowerCase();
  const seasonTypeVariants = Array.from(
    new Set([
      String(seasonType || ""),
      seasonTypeSlug,
      seasonTypeSlug.charAt(0).toUpperCase() + seasonTypeSlug.slice(1),
    ])
  ).filter(Boolean);

  const recapDocId = `${seasonYear}-${seasonTypeSlug}-week${week}`;

  // --- 1) Build winners map from your GAMES collection (authoritative)
  const winners = new Map(); // gameId -> winnerTeamId
  const gamesSnap = await db
    .collection("games")
    .where("seasonYear", "==", seasonYear)
    .where("week", "==", week)
    .where("seasonType", "in", seasonTypeVariants)
    .get();

  const gameIdsForWeek = [];
  for (const g of gamesSnap.docs) {
    const gd = g.data() || {};
    const gameId = String(gd.id || g.id.split("-").pop()); // support either stored 'id' or doc id suffix
    gameIdsForWeek.push(gameId);
    if (gd.hasResult && gd.winnerId) {
      winners.set(gameId, String(gd.winnerId));
    }
  }

  // --- 2) If any winners missing, fall back to ESPN scoreboard to fill gaps
  const missing = gameIdsForWeek.filter((k) => !winners.has(k));
  if (missing.length > 0) {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );
    const sb = await res.json();
    const events = sb?.events || [];

    for (const event of events) {
      const gameId = String(event.id);
      if (!missing.includes(gameId)) continue;

      const competition = event.competitions && event.competitions[0];
      const competitors = (competition && competition.competitors) || [];

      const compStatus = (competition && competition.status) || {};
      const evtStatus = event.status || {};
      const isFinal =
        compStatus?.type?.completed === true ||
        compStatus?.type?.state === "post" ||
        evtStatus?.type?.completed === true ||
        evtStatus?.type?.name === "STATUS_FINAL";

      if (!isFinal || competitors.length < 2) continue;

      let winnerTeam = competitors.find((c) => c && c.winner === true);
      if (!winnerTeam) {
        const [a, b] = competitors;
        const aScore = Number(a?.score ?? a?.score?.value ?? 0);
        const bScore = Number(b?.score ?? b?.score?.value ?? 0);
        if (
          !Number.isNaN(aScore) &&
          !Number.isNaN(bScore) &&
          aScore !== bScore
        ) {
          winnerTeam = aScore > bScore ? a : b;
        }
      }
      if (winnerTeam?.team?.id) {
        winners.set(gameId, String(winnerTeam.team.id));
      }
    }
  }

  // Optional STRICT mode: ensure all games have winners before grading
  const STRICT_ALL_FINAL = true;
  if (STRICT_ALL_FINAL) {
    const stillMissing = gameIdsForWeek.filter((k) => !winners.has(k));
    if (stillMissing.length > 0) {
      console.log(
        "⚠️ Some games have no winner yet; aborting grading:",
        stillMissing
      );
      return { success: false, message: "Not all games are final yet." };
    }
  }

  if (winners.size === 0) {
    console.log("⚠️ No completed games with winners—exiting.");
    return { success: false, message: "No winners available." };
  }

  // --- 3) Grade picks for this week (single query)
  const picksSnap = await db
    .collection("picks")
    .where("seasonYear", "==", seasonYear)
    .where("seasonType", "in", seasonTypeVariants)
    .where("week", "==", week)
    .get();

  const userScores = {}; // uid -> weekly points
  const userWeeklyDetails = []; // [{ uid, fullName, score }]
  const weeklyPicks = []; // compact record for history

  // batch writes in chunks
  const commitBatch = async (writes) => {
    if (writes.length === 0) return;
    const b = db.batch();
    writes.forEach(({ ref, data }) => b.update(ref, data));
    await b.commit();
  };

  let pending = [];
  for (const pickDoc of picksSnap.docs) {
    const pdata = pickDoc.data() || {};
    const uid = pdata.userId;
    const fullName = pdata.fullName || "";
    const preds = pdata.predictions || {};

    let weeklyScore = 0;
    const dotUpdates = {};

    // grade only games with winners for this week
    for (const [gameId, pred] of Object.entries(preds)) {
      if (!pred) continue;
      const winnerId = winners.get(String(gameId));
      if (!winnerId) continue; // not part of this configured week or not final (in non-strict mode)

      const newIsCorrect = String(pred.teamId) === String(winnerId);

      // only write if changed or not set
      const already = pred.isCorrect;
      const needsWrite =
        !(already === true || already === false) || already !== newIsCorrect;
      if (needsWrite) {
        dotUpdates[`predictions.${gameId}.isCorrect`] = newIsCorrect;
      }

      if (newIsCorrect) weeklyScore += 1;
    }

    // queue write
    if (Object.keys(dotUpdates).length > 0) {
      pending.push({ ref: pickDoc.ref, data: dotUpdates });
      if (pending.length >= 450) {
        await commitBatch(pending);
        pending = [];
      }
    }

    userScores[uid] = (userScores[uid] || 0) + weeklyScore;
    userWeeklyDetails.push({ uid, fullName, score: weeklyScore });
    weeklyPicks.push({
      id: pickDoc.id,
      userId: uid,
      fullName,
      graded: dotUpdates,
    });
  }
  if (pending.length) await commitBatch(pending);

  // --- 4) Update weekly leaderboard (regular or postseason)
  const leaderboardType =
    seasonTypeSlug === "postseason" ? "leaderboardPostseason" : "leaderboard";

  const lbSnap = await db.collection(leaderboardType).get();
  const updated = [];
  for (const d of lbSnap.docs) {
    const e = d.data() || {};
    const uid = e.uid;
    const lastWeekPoints = userScores[uid] || 0;
    const totalPoints = (e.totalPoints || 0) + lastWeekPoints;
    updated.push({ ...e, lastWeekPoints, totalPoints });
  }

  // Rank by totalPoints (stable for ties)
  updated.sort((a, b) => b.totalPoints - a.totalPoints);
  for (let i = 0; i < updated.length; i++) {
    const cur = updated[i];
    const sameAsAbove = i > 0 && cur.totalPoints === updated[i - 1].totalPoints;
    const newRank = sameAsAbove ? updated[i - 1].currentRank : i + 1;

    const prevRank = cur.currentRank ?? newRank;
    const positionChange = prevRank - newRank;

    await db.doc(`${leaderboardType}/${cur.uid}`).set(
      {
        ...cur,
        previousRank: prevRank,
        currentRank: newRank,
        positionChange,
      },
      { merge: true }
    );

    cur.previousRank = prevRank;
    cur.currentRank = newRank;
    cur.positionChange = positionChange;
  }

  // --- 5) Update all-time leaderboard (merge to avoid missing docs)
  const allTimeSnap = await db.collection("leaderboardAllTime").get();
  for (const d of allTimeSnap.docs) {
    const e = d.data() || {};
    const uid = e.uid;
    const add = userScores[uid] || 0;
    if (add) {
      await db
        .doc(`leaderboardAllTime/${uid}`)
        .set({ uid, totalPoints: (e.totalPoints || 0) + add }, { merge: true });
    }
  }

  // --- 6) Recap + History documents
  const lastWeekPointsArr = updated.map((u) => u.lastWeekPoints ?? 0);
  const highestScore = lastWeekPointsArr.length
    ? Math.max(...lastWeekPointsArr)
    : 0;
  const lowestScore = lastWeekPointsArr.length
    ? Math.min(...lastWeekPointsArr)
    : 0;

  const topScorers = updated.filter(
    (u) => (u.lastWeekPoints ?? 0) === highestScore
  );
  const lowestScorers = updated.filter(
    (u) => (u.lastWeekPoints ?? 0) === lowestScore
  );

  const posChanges = updated.map((u) => u.positionChange ?? 0);
  const maxRise = posChanges.length ? Math.max(...posChanges) : 0;
  const maxDrop = posChanges.length ? Math.min(...posChanges) : 0;
  const biggestRisers = updated.filter(
    (u) => (u.positionChange ?? 0) === maxRise
  );
  const biggestFallers = updated.filter(
    (u) => (u.positionChange ?? 0) === maxDrop
  );

  await db.doc(`weeklyRecap/${recapDocId}`).set({
    week,
    seasonType: seasonTypeSlug,
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

  // Optional: keep a compact history for the week (omit full predictions to keep size sane)
  await db.doc(`history/${recapDocId}`).set({
    week,
    seasonType: seasonTypeSlug,
    seasonYear,
    leaderboard: updated,
    recap: {
      highestScore,
      lowestScore,
      topScorers,
      lowestScorers,
      biggestRisers,
      biggestFallers,
      scores: userWeeklyDetails,
    },
    // If you also want games here, read from your games collection and attach; omitted to keep lean
    picks: weeklyPicks,
    createdAt: new Date(),
  });

  console.log("✅ Weekly results calculation completed.");
  return { success: true };
}
