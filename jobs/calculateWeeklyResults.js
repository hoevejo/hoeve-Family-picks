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
  const gameOfTheWeekId = cfg.gameOfTheWeekId
    ? String(cfg.gameOfTheWeekId)
    : null;

  const seasonTypeSlug = String(seasonType || "").toLowerCase();
  const seasonTypeVariants = Array.from(
    new Set([
      String(seasonType || ""),
      seasonTypeSlug,
      seasonTypeSlug.charAt(0).toUpperCase() + seasonTypeSlug.slice(1),
    ])
  ).filter(Boolean);

  const recapDocId = `${seasonYear}-${seasonTypeSlug}-week${week}`;

  // --- 1) Build winners + final ties from your GAMES collection (authoritative)
  const winners = new Map(); // gameId -> winnerTeamId
  const finalTies = new Set(); // gameId (final but tied)
  const gameById = new Map(); // gameId -> game doc (for scores/status)

  const gamesSnap = await db
    .collection("games")
    .where("seasonYear", "==", seasonYear)
    .where("week", "==", week)
    .where("seasonType", "in", seasonTypeVariants)
    .get();

  const gameIdsForWeek = [];
  for (const g of gamesSnap.docs) {
    const gd = g.data() || {};
    const gameId = String(gd.id || g.id.split("-").pop());
    gameIdsForWeek.push(gameId);
    gameById.set(gameId, gd);

    const statusName = (gd.status || "").toString().toUpperCase();
    const homeScore = Number(gd?.homeTeam?.score ?? 0);
    const awayScore = Number(gd?.awayTeam?.score ?? 0);
    const isFinalDoc = statusName.includes("FINAL");

    if (gd.hasResult && gd.winnerId) {
      winners.set(gameId, String(gd.winnerId));
    } else if (isFinalDoc && homeScore === awayScore) {
      finalTies.add(gameId);
    }
  }

  // --- 2) Fill gaps from ESPN scoreboard (winners and ties)
  const missing = gameIdsForWeek.filter(
    (k) => !winners.has(k) && !finalTies.has(k)
  );
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
      const statusName = compStatus?.type?.name || evtStatus?.type?.name || "";
      const isFinal =
        compStatus?.type?.completed === true ||
        compStatus?.type?.state === "post" ||
        evtStatus?.type?.completed === true ||
        statusName === "STATUS_FINAL";

      if (!isFinal || competitors.length < 2) continue;

      const [a, b] = competitors;
      const aScore = Number(a?.score ?? a?.score?.value ?? 0);
      const bScore = Number(b?.score ?? b?.score?.value ?? 0);

      let winnerTeam = competitors.find((c) => c && c.winner === true);
      if (
        !winnerTeam &&
        !Number.isNaN(aScore) &&
        !Number.isNaN(bScore) &&
        aScore !== bScore
      ) {
        winnerTeam = aScore > bScore ? a : b;
      }

      if (winnerTeam?.team?.id) {
        winners.set(gameId, String(winnerTeam.team.id));
      } else if (aScore === bScore) {
        finalTies.add(gameId);
      }
    }
  }

  // --- Strictness: allow ties, require no unresolved games
  const unresolved = gameIdsForWeek.filter(
    (k) => !winners.has(k) && !finalTies.has(k)
  );
  if (unresolved.length > 0) {
    console.log("⚠️ Some games unresolved; aborting grading:", unresolved);
    return { success: false, message: "Not all games are final yet." };
  }
  if (winners.size === 0 && finalTies.size === 0) {
    console.log("⚠️ No completed games—exiting.");
    return { success: false, message: "No final games available." };
  }

  // --- 3) Grade picks + apply GOTW wagers
  const picksSnap = await db
    .collection("picks")
    .where("seasonYear", "==", seasonYear)
    .where("seasonType", "in", seasonTypeVariants)
    .where("week", "==", week)
    .get();

  const userScores = {}; // uid -> weekly points (including wager)
  const userWeeklyDetails = []; // [{ uid, fullName, score }]
  const weeklyPicks = []; // compact record for history (graded fields only)

  const commitBatch = async (writes) => {
    if (!writes.length) return;
    const b = db.batch();
    writes.forEach(({ ref, data }) => b.set(ref, data, { merge: true }));
    await b.commit();
  };

  let pending = [];

  for (const pickDoc of picksSnap.docs) {
    const pdata = pickDoc.data() || {};
    const uid = pdata.userId;
    const fullName = pdata.fullName || "";
    const preds = pdata.predictions || {};
    const wager = pdata.wager || null;

    let weeklyScore = 0;
    const dotUpdates = {}; // predictions.*.isCorrect + wagerResult

    // Grade standard picks
    for (const [gameIdRaw, pred] of Object.entries(preds)) {
      const gameId = String(gameIdRaw);
      if (!pred) continue;

      if (winners.has(gameId)) {
        const winnerId = winners.get(gameId);
        const newIsCorrect = String(pred.teamId) === String(winnerId);
        const already = pred.isCorrect;
        const needsWrite =
          !(already === true || already === false) || already !== newIsCorrect;
        if (needsWrite)
          dotUpdates[`predictions.${gameId}.isCorrect`] = newIsCorrect;
        if (newIsCorrect) weeklyScore += 1;
      } else if (finalTies.has(gameId)) {
        // final tie -> ensure isCorrect is null
        if (pred.isCorrect !== null) {
          dotUpdates[`predictions.${gameId}.isCorrect`] = null;
        }
        // no points awarded
      }
    }

    // Apply GOTW wager (+points if correct, -points if wrong, push=0 on tie)
    let wagerApplied = 0;
    let wagerOutcome = null;

    if (
      gameOfTheWeekId &&
      wager &&
      String(wager.gameId) === String(gameOfTheWeekId)
    ) {
      const wTeam = String(wager.teamId);
      const wPts = Number(wager.points || 0);

      if (wPts > 0) {
        if (winners.has(gameOfTheWeekId)) {
          const winnerId = winners.get(gameOfTheWeekId);
          if (wTeam === String(winnerId)) {
            wagerOutcome = "win";
            wagerApplied = wPts; // ✅ win_lose mode: +points
          } else {
            wagerOutcome = "lose";
            wagerApplied = -wPts; // ❗ lose: -points
          }
        } else if (finalTies.has(gameOfTheWeekId)) {
          wagerOutcome = "push";
          wagerApplied = 0; // tie: no change
        }
      }

      // Persist concise wager result (idempotent-friendly)
      dotUpdates["wagerResult"] = {
        outcome: wagerOutcome,
        applied: wagerApplied,
        gradedAt: new Date().toISOString(),
      };

      weeklyScore += wagerApplied;
    }

    // Queue write if needed
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

  // --- 4) Update weekly leaderboard (idempotent totals)
  const leaderboardType =
    seasonTypeSlug === "postseason" ? "leaderboardPostseason" : "leaderboard";
  const lbSnap = await db.collection(leaderboardType).get();
  const updated = [];

  for (const d of lbSnap.docs) {
    const e = d.data() || {};
    const uid = e.uid;
    const lastWeekPoints = userScores[uid] || 0; // includes wager
    const newTotal =
      (e.totalPoints || 0) - (e.lastWeekPoints || 0) + lastWeekPoints; // ✅ idempotent
    updated.push({ ...e, lastWeekPoints, totalPoints: newTotal });
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

  // --- 5) Update all-time leaderboard (also idempotent)
  const allTimeSnap = await db.collection("leaderboardAllTime").get();
  for (const d of allTimeSnap.docs) {
    const e = d.data() || {};
    const uid = e.uid;
    const add = userScores[uid] || 0;
    const newTotal = (e.totalPoints || 0) - (e.lastWeekPoints || 0) + add; // ✅ idempotent
    await db
      .doc(`leaderboardAllTime/${uid}`)
      .set(
        { uid, totalPoints: newTotal, lastWeekPoints: add },
        { merge: true }
      );
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
    picks: weeklyPicks,
    createdAt: new Date(),
  });

  console.log("✅ Weekly results calculation completed.");
  return { success: true };
}
