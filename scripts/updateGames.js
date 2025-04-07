// /app/api/fetchGames/route.js Runs wednesday at 6am. Pulls in new game data and updates config.

import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseConfig";
import { doc, setDoc, Timestamp } from "firebase/firestore";

export async function GET() {
  try {
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );
    const data = await response.json();

    const games = data.events;
    const week = data.week.number;
    const seasonYear = data.season.year;
    const seasonType = data.season.type === 3 ? "Postseason" : "Regular";

    // 🛑 Get dynamic end date from ESPN API
    const leagueEndDate = new Date(data.leagues?.[0]?.season?.endDate);
    const now = new Date();
    if (now > leagueEndDate) {
      return NextResponse.json({
        success: false,
        message: "Season is over. Skipping fetch.",
      });
    }

    // 🕒 Find earliest game to determine deadline
    const earliestGame = games.reduce((earliest, current) => {
      return new Date(current.date) < new Date(earliest.date)
        ? current
        : earliest;
    });

    const gameWrites = games.map(async (game) => {
      const id = game.id;
      const name = game.name;
      const date = game.date;
      const status = game.status?.type?.name;
      const homeTeam = game.competitions[0].competitors.find(
        (c) => c.homeAway === "home"
      );
      const awayTeam = game.competitions[0].competitors.find(
        (c) => c.homeAway === "away"
      );
      const winnerId = game.competitions[0].winner?.id || null;

      const docId = `${seasonYear}-${seasonType.toLowerCase()}-week${week}-${id}`;
      const ref = doc(db, "games", docId);

      await setDoc(ref, {
        id,
        name,
        date,
        status,
        seasonType,
        seasonYear,
        week,
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
        winnerId,
        lastUpdated: new Date().toISOString(),
      });
    });

    // 🔧 Update config document with deadline and endOfSeason date
    const configRef = doc(db, "config", "config");
    await setDoc(configRef, {
      week,
      seasonType,
      seasonYear,
      deadline: Timestamp.fromDate(new Date(earliestGame.date)),
      endOfSeason: Timestamp.fromDate(leagueEndDate),
      lastUpdated: new Date().toISOString(),
    });

    await Promise.all(gameWrites);

    return NextResponse.json({ success: true, count: games.length });
  } catch (error) {
    console.error("Failed to fetch/store games:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
