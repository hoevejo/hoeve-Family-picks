import { db } from "./firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

const fetchAndStoreGames = async () => {
  try {
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );
    const data = await response.json();

    const seasonYear = data.season.year;
    const seasonType = data.season.type === 3 ? "Postseason" : "Regular Season";
    const week = data.week.number;

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

    // Save to Firestore
    await setDoc(doc(db, "games", `${seasonYear}-${seasonType}-week${week}`), {
      games,
    });

    console.log("Games stored successfully in Firestore.");
  } catch (error) {
    console.error("Error fetching and storing games:", error);
  }
};

// Run the function
fetchAndStoreGames();
