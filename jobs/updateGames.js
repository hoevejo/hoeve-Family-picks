import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { sendNotificationToUser } from "../lib/sendNotification"; // ✅ Import the helper

export async function fetchAndStoreGames() {
  const response = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  const data = await response.json();

  const games = data.events;
  const week = data.week.number;
  const seasonYear = data.season.year;
  const seasonType = data.season.type === 3 ? "Postseason" : "Regular";

  if (data.season.type === 1) {
    return {
      success: false,
      message: "Preseason detected. Skipping fetch.",
    };
  }

  // 🛑 Stop if the season is over
  const leagueEndDate = new Date(data.leagues?.[0]?.season?.endDate);
  const now = new Date();
  if (now > leagueEndDate) {
    return {
      success: false,
      message: "Season is over. Skipping fetch.",
    };
  }

  const earliestGame = games.reduce((earliest, current) =>
    new Date(current.date) < new Date(earliest.date) ? current : earliest
  );

  const gameWrites = games.map(async (game) => {
    const id = game.id;
    const name = game.name;
    const shortName = game.shortName;
    const date = game.date;
    const status = game.status?.type?.name || "scheduled";

    const homeTeam = game.competitions[0].competitors.find(
      (c) => c.homeAway === "home"
    );
    const awayTeam = game.competitions[0].competitors.find(
      (c) => c.homeAway === "away"
    );
    const winnerTeam = game.competitions[0].competitors.find((c) => c.winner);
    const winnerId = winnerTeam ? winnerTeam.team.id : null;

    const docId = `${seasonYear}-${seasonType.toLowerCase()}-week${week}-${id}`;

    await db.doc(`games/${docId}`).set({
      id,
      name,
      shortName,
      date,
      status,
      seasonType,
      seasonYear,
      week,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.team.displayName,
        mascot: homeTeam.team.name, // ✅ NEW
        abbreviation: homeTeam.team.abbreviation,
        score: Number(homeTeam.score),
        logo: homeTeam.team.logo,
        record: homeTeam.records?.[0]?.summary || "",
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.team.displayName,
        mascot: awayTeam.team.name, // ✅ NEW
        abbreviation: awayTeam.team.abbreviation,
        score: Number(awayTeam.score),
        logo: awayTeam.team.logo,
        record: awayTeam.records?.[0]?.summary || "",
      },
      winnerId,
      lastUpdated: new Date().toISOString(),
    });
  });

  // 🛠️ Select Game of the Week if not Week 1
  let gameOfTheWeekId = null;
  if (week !== 1 && games.length > 0) {
    const randomGame = games[Math.floor(Math.random() * games.length)];
    gameOfTheWeekId = randomGame.id;
  }

  // 🛠️ Update config
  await db.doc("config/config").set({
    week,
    seasonType,
    seasonYear,
    deadline: Timestamp.fromDate(new Date(earliestGame.date)),
    endOfSeason: Timestamp.fromDate(leagueEndDate),
    recapWeek: week - 1,
    lastUpdated: new Date().toISOString(),
    ...(gameOfTheWeekId && { gameOfTheWeekId }), // only added if week !== 1
  });

  await Promise.all(gameWrites);

  // 🔔 Push Notification
  const formattedType =
    seasonType === "Postseason" ? "the Postseason" : "the Regular Season";

  const title = `📅 Week ${week} of ${formattedType} is here!`;
  const body = `Don't forget to make your picks before the deadline.`;

  await sendNotificationToUser(title, body);

  return { success: true, count: games.length };
}
