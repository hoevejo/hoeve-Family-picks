"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

export default function WeeklyPicks() {
  const { user } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [week, setWeek] = useState(null);
  const [seasonYear, setSeasonYear] = useState(null);
  const [seasonType, setSeasonType] = useState("Regular Season");
  const [deadline, setDeadline] = useState(null);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Fetch Firestore Config (Current Week, Season & Deadline)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log("Fetching Firestore config...");
        const configDoc = await getDoc(doc(db, "config", "predictionSettings"));

        if (configDoc.exists()) {
          const configData = configDoc.data();
          console.log("Config Data:", configData);

          setWeek(configData.week);
          setSeasonYear(configData.seasonYear || new Date().getFullYear());
          setSeasonType(configData.seasonType || "Regular Season");

          // ✅ Convert Firestore Timestamp correctly
          if (configData.deadline && configData.deadline.seconds) {
            const deadlineDate = new Date(configData.deadline.seconds * 1000); // Convert Firestore Timestamp
            setDeadline(deadlineDate);
            setIsDeadlinePassed(new Date() > deadlineDate);
          } else {
            console.warn(
              "Invalid Firestore deadline format:",
              configData.deadline
            );
            setDeadline(null);
          }
        } else {
          console.warn("Firestore config not found!");
        }
      } catch (error) {
        console.error("Error fetching configuration data:", error);
      }
    };

    fetchConfig();
  }, []);

  // ✅ Fetch Games from Firestore
  useEffect(() => {
    if (!seasonYear || !seasonType || !week) return;

    const fetchGames = async () => {
      try {
        console.log(
          `Fetching games for ${seasonYear}-${seasonType}-Week ${week}...`
        );
        const gamesDoc = await getDoc(
          doc(db, "games", `${seasonYear}-${seasonType}-week${week}`)
        );

        if (gamesDoc.exists()) {
          setGames(gamesDoc.data().games);
          console.log("Games Data:", gamesDoc.data().games);
        } else {
          console.warn("No games found for this week.");
        }
      } catch (error) {
        console.error("Error fetching games from Firestore:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, [seasonYear, seasonType, week]);

  // ✅ Fetch User's Existing Predictions
  useEffect(() => {
    if (!user || !week || !seasonYear) return;

    const fetchUserPredictions = async () => {
      try {
        console.log("Fetching user predictions...");
        const predictionsDocRef = doc(
          db,
          "picks",
          `${seasonYear}-${seasonType}-week${week}-${user.uid}`
        );
        const predictionsDoc = await getDoc(predictionsDocRef);

        if (predictionsDoc.exists()) {
          setPredictions(predictionsDoc.data().predictions);
          console.log(
            "User predictions found:",
            predictionsDoc.data().predictions
          );
        } else {
          console.log("No predictions found for this user.");
        }
      } catch (error) {
        console.error("Error fetching user predictions:", error);
      }
    };

    if (!isDeadlinePassed) {
      fetchUserPredictions();
    }
  }, [user, week, seasonYear, isDeadlinePassed]);

  // ✅ Handle Prediction Changes
  const handlePredictionChange = (gameId, teamId) => {
    setPredictions((prev) => ({ ...prev, [gameId]: teamId }));
  };

  // ✅ Submit Predictions to Firestore
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!games.length) return;

    try {
      if (user && week && seasonYear) {
        const predictionsDocRef = doc(
          db,
          "picks",
          `${seasonYear}-${seasonType}-week${week}-${user.uid}`
        );
        await setDoc(
          predictionsDocRef,
          {
            predictions,
            userId: user.uid,
            seasonYear,
            seasonType,
            week,
          },
          { merge: true }
        );

        alert("Prediction Submitted Successfully");
        router.push("/");
      }
    } catch (error) {
      console.error("Error submitting predictions:", error);
    }
  };

  return (
    <div className="p-6">
      {isLoading ? (
        <p className="text-center">Loading...</p>
      ) : !games.length ? (
        <p className="text-center text-red-500">
          No games available for {seasonType} - Week {week}.
        </p>
      ) : !isDeadlinePassed ? (
        <>
          <h1 className="text-2xl font-bold">
            Make Your Predictions ({seasonType} - Week {week})
          </h1>
          <h2>Deadline: {deadline?.toLocaleString()}</h2>
          <form onSubmit={handleSubmit}>
            {games.map((game) => (
              <div
                key={game.gameId}
                className="my-4 p-4 bg-white shadow-md rounded-lg"
              >
                <h3 className="text-lg font-semibold text-center mb-3">
                  {game.shortName}
                </h3>
                <div className="flex justify-center space-x-6">
                  {[game.homeTeam, game.awayTeam].map((team) => (
                    <label
                      key={team.id}
                      className={`cursor-pointer flex flex-col items-center p-3 border-2 rounded-lg transition-all
              ${
                predictions[game.gameId] === team.id
                  ? "border-blue-500 bg-blue-100 shadow-md"
                  : "border-gray-300 bg-white hover:bg-gray-100"
              }
            `}
                      onClick={() =>
                        handlePredictionChange(game.gameId, team.id)
                      }
                    >
                      <input
                        type="radio"
                        name={`prediction-${game.gameId}`}
                        value={team.id}
                        checked={predictions[game.gameId] === team.id}
                        onChange={() =>
                          handlePredictionChange(game.gameId, team.id)
                        }
                        className="hidden"
                      />
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="w-16 h-16"
                      />
                      <span className="mt-2 text-lg font-semibold">
                        {team.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-2 rounded mt-4 block mx-auto hover:bg-blue-600 transition-all"
            >
              Submit Predictions
            </button>
          </form>
        </>
      ) : (
        <h2 className="text-center text-xl">
          Predictions are locked. Check results soon!
        </h2>
      )}
    </div>
  );
}
