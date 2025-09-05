import { db } from "@/lib/firebaseAdmin";
import fetch from "node-fetch";

export async function updateIsCorrectJob() {
  console.log("🔄 Starting updateIsCorrect job...");

  const configSnap = await db.doc("config/config").get();
  if (!configSnap.exists) throw new Error("Config not found");
  const config = configSnap.data();
  if (!config) throw new Error("Config doc exists but has no data");

  const { seasonYear, seasonType, week } = config;

  const seasonTypeSlug = String(seasonType || "").toLowerCase();
  const gameIdPrefix = `${seasonYear}-${seasonTypeSlug}-week${week}`;

  const seasonTypeVariants = Array.from(
    new Set([
      String(seasonType || ""),
      seasonTypeSlug,
      seasonTypeSlug.charAt(0).toUpperCase() + seasonTypeSlug.slice(1), // "Regular"
    ])
  ).filter(Boolean);

  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  const json = await res.json();
  const events = json.events || [];

  let updatedGames = 0;
  let updatedPicks = 0;

  // 1) Determine winners for all completed events
  const winners = new Map(); // gameId -> winnerTeamId as string

  for (const event of events) {
    const competition = event.competitions && event.competitions[0];
    const competitors = (competition && competition.competitors) || [];

    const compStatus = (competition && competition.status) || {};
    const evtStatus = (event && event.status) || {};

    const completed =
      compStatus?.type?.completed === true ||
      compStatus?.type?.state === "post" ||
      evtStatus?.type?.completed === true ||
      evtStatus?.type?.name === "STATUS_FINAL";

    if (!completed || competitors.length < 2) continue;

    let winnerTeam = competitors.find((t) => t && t.winner === true);

    // Fallback by score if winner flag missing
    if (!winnerTeam) {
      const [a, b] = competitors;
      const aScore = Number(a?.score ?? a?.score?.value ?? 0);
      const bScore = Number(b?.score ?? b?.score?.value ?? 0);
      if (!Number.isNaN(aScore) && !Number.isNaN(bScore) && aScore !== bScore) {
        winnerTeam = aScore > bScore ? a : b;
      }
    }

    if (!winnerTeam) continue; // still not final or tie

    const winnerId = String(winnerTeam.team.id);
    const gameId = String(event.id);
    winners.set(gameId, winnerId);

    // Update the corresponding game doc if it exists for this configured week
    const fullGameId = `${gameIdPrefix}-${gameId}`;
    const gameRef = db.doc(`games/${fullGameId}`);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) continue;

    const gameData = gameSnap.data() || {};
    if (gameData.hasResult) continue;

    await gameRef.update({
      winnerId,
      status: "completed",
      hasResult: true,
      resultUpdatedAt: new Date().toISOString(),
    });
    updatedGames++;
  }

  if (winners.size === 0) {
    console.log("ℹ️ No completed games found to grade.");
    return { success: true, updatedGames, updatedPicks };
  }

  // 2) Fetch picks ONCE for the configured week
  const picksSnap = await db
    .collection("picks")
    .where("seasonYear", "==", seasonYear)
    .where("seasonType", "in", seasonTypeVariants)
    .where("week", "==", week)
    .get();

  if (picksSnap.empty) {
    console.log(
      `ℹ️ No picks matched for seasonYear=${seasonYear}, week=${week}, seasonType in ${JSON.stringify(
        seasonTypeVariants
      )}`
    );
    return { success: true, updatedGames, updatedPicks };
  }

  // 3) Grade picks; write only when needed
  const batch = db.batch();
  let opsInBatch = 0;

  for (const pickDoc of picksSnap.docs) {
    const pickData = pickDoc.data() || {};
    const predictions = pickData.predictions || {};
    let anyChange = false;
    const updates = {};

    for (const [gameId, pred] of Object.entries(predictions)) {
      if (!pred || (pred.isCorrect !== null && pred.isCorrect !== undefined))
        continue;
      const winnerId = winners.get(String(gameId));
      if (!winnerId) continue; // game not completed (or not part of this config week)

      const isCorrect = String(pred.teamId) === String(winnerId);
      updates[`predictions.${gameId}.isCorrect`] = isCorrect;
      anyChange = true;
    }

    if (anyChange) {
      batch.update(pickDoc.ref, updates);
      opsInBatch++;
      updatedPicks++;
      if (opsInBatch >= 450) {
        // keep headroom under 500
        await batch.commit();
        opsInBatch = 0;
      }
    }
  }

  if (opsInBatch > 0) await batch.commit();

  console.log(
    `✅ updateIsCorrect finished. Games updated: ${updatedGames}, Picks updated: ${updatedPicks}`
  );
  return { success: true, updatedGames, updatedPicks };
}
