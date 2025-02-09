import { db } from "../lib/firebaseConfig.js"; // ✅ Use .js extension in import
import { doc, setDoc } from "firebase/firestore";

// 🔹 Fetch & Store Games in Firestore
const fetchAndStoreGames = async () => {
  try {
    console.log("Fetching games from ESPN API...");
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );
    const data = await response.json();

    if (!data.events) {
      console.warn("No games found in ESPN response.");
      return;
    }

    const seasonYear = data.season.year;
    const seasonType = data.season.type === 3 ? "Postseason" : "Regular Season";
    const week = data.week.number;

    // 🔹 Format the data
    const games = data.events.map((event) => ({
      gameId: event.id,
      shortName: event.shortName,
      gameDate: event.date,
      venue: event.competitions[0].venue.fullName,
      homeTeam: {
        id: event.competitions[0].competitors.find((c) => c.homeAway === "home")
          .id,
        name: event.competitions[0].competitors.find(
          (c) => c.homeAway === "home"
        ).team.displayName,
        abbreviation: event.competitions[0].competitors.find(
          (c) => c.homeAway === "home"
        ).team.abbreviation,
        logo: event.competitions[0].competitors.find(
          (c) => c.homeAway === "home"
        ).team.logo,
      },
      awayTeam: {
        id: event.competitions[0].competitors.find((c) => c.homeAway === "away")
          .id,
        name: event.competitions[0].competitors.find(
          (c) => c.homeAway === "away"
        ).team.displayName,
        abbreviation: event.competitions[0].competitors.find(
          (c) => c.homeAway === "away"
        ).team.abbreviation,
        logo: event.competitions[0].competitors.find(
          (c) => c.homeAway === "away"
        ).team.logo,
      },
    }));

    // 🔹 Store games in Firestore
    const gamesDocRef = doc(
      db,
      "games",
      `${seasonYear}-${seasonType}-week${week}`
    );
    await setDoc(gamesDocRef, { games });

    console.log(`✅ Successfully stored ${games.length} games in Firestore.`);
  } catch (error) {
    console.error("❌ Error fetching/storing games:", error);
  }
};

// 🚀 Run the function
fetchAndStoreGames();
