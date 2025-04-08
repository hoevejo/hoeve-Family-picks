import { db } from "@/lib/firebaseAdmin";
import fetch from "node-fetch";

export async function updateIsCorrectJob() {
  console.log("🔄 Starting updateIsCorrect job...");

  const configSnap = await db.doc("config/config").get();
  if (!configSnap.exists) throw new Error("Config not found");

  const config = configSnap.data();
  const { seasonYear, seasonType, week } = config;
  const gameIdPrefix = `${seasonYear}-${seasonType}-week${week}`;

  const response = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  const data = await response.json();
  const events = data.events || [];

  let updatedGames = 0;
  let updatedPicks = 0;

  for (const event of events) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];
    const winnerTeam = competitors.find((team) => team.winner === true);
    if (!winnerTeam) continue;

    const winnerId = winnerTeam.team.id;
    const gameId = event.id;
    const fullGameId = `${gameIdPrefix}-${gameId}`;

    // Update the winner in games
    const gameRef = db.doc(`games/${fullGameId}`);
    await gameRef.update({
      winnerId,
      status: "completed",
    });
    updatedGames++;

    // Update related picks
    const picksSnap = await db
      .collection("picks")
      .where("seasonYear", "==", seasonYear)
      .where("seasonType", "==", seasonType)
      .where("week", "==", week)
      .get();

    for (const pickDoc of picksSnap.docs) {
      const prediction = pickDoc.data().predictions?.[fullGameId];
      if (!prediction || prediction.isCorrect !== null) continue;

      const isCorrect = prediction.teamId === winnerId;
      await db.doc(`picks/${pickDoc.id}`).update({
        [`predictions.${fullGameId}.isCorrect`]: isCorrect,
      });
      updatedPicks++;
    }
  }

  return {
    success: true,
    updatedGames,
    updatedPicks,
  };
}
