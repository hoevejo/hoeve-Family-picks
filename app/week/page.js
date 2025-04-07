"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

export default function WeeklyPicks() {
  const { user } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [week, setWeek] = useState(null);
  const [seasonYear, setSeasonYear] = useState(null);
  const [seasonType, setSeasonType] = useState("Regular");
  const [deadline, setDeadline] = useState(null);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allUserPicks, setAllUserPicks] = useState([]);

  useEffect(() => {
    const theme = localStorage.getItem("theme") || "theme-light";
    document.body.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-vibrant"
    );
    document.body.classList.add(theme);
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "config"));
        if (configDoc.exists()) {
          const configData = configDoc.data();
          setWeek(configData.week);
          setSeasonYear(configData.seasonYear);
          setSeasonType(configData.seasonType);

          if (configData.deadline && configData.deadline.seconds) {
            const deadlineDate = new Date(configData.deadline.seconds * 1000);
            setDeadline(deadlineDate);
            setIsDeadlinePassed(new Date() > deadlineDate);
          }
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (!seasonYear || !seasonType || !week) return;
    const fetchGames = async () => {
      try {
        const snapshot = await getDocs(collection(db, "games"));
        const filteredGames = snapshot.docs
          .map((doc) => doc.data())
          .filter(
            (game) =>
              game.seasonYear === seasonYear &&
              game.seasonType === seasonType &&
              game.week === week
          );
        setGames(filteredGames);
      } catch (error) {
        console.error("Error fetching games:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, [seasonYear, seasonType, week]);

  useEffect(() => {
    if (!user || !week || !seasonYear) return;
    const fetchPredictions = async () => {
      try {
        const ref = doc(
          db,
          "picks",
          `${seasonYear}-${seasonType}-week${week}-${user.uid}`
        );
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const picks = snap.data().predictions || {};
          setPredictions(picks);
        }
      } catch (error) {
        console.error("Error fetching user predictions:", error);
      }
    };
    fetchPredictions();
  }, [user, week, seasonType, seasonYear]);

  useEffect(() => {
    if (!isDeadlinePassed || !seasonYear || !seasonType || !week) return;
    const fetchAllUserPicks = async () => {
      try {
        const picksQuery = query(
          collection(db, "picks"),
          where("seasonYear", "==", seasonYear),
          where("seasonType", "==", seasonType),
          where("week", "==", week)
        );
        const snapshot = await getDocs(picksQuery);
        const picks = snapshot.docs.map((doc) => doc.data());
        setAllUserPicks(picks);
      } catch (error) {
        console.error("Error fetching all picks:", error);
      }
    };
    fetchAllUserPicks();
  }, [isDeadlinePassed, seasonYear, seasonType, week]);

  const handlePredictionChange = (gameId, teamId) => {
    setPredictions((prev) => ({
      ...prev,
      [gameId]: { teamId, isCorrect: null },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const ref = doc(
        db,
        "picks",
        `${seasonYear}-${seasonType}-week${week}-${user.uid}`
      );
      await setDoc(ref, {
        predictions,
        userId: user.uid,
        seasonYear,
        seasonType,
        week,
      });
      alert("Predictions submitted!");
      router.push("/");
    } catch (error) {
      console.error("Error submitting:", error);
    }
  };

  return (
    <div className="p-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors min-h-screen">
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
                key={game.id}
                className="my-4 p-4 bg-[var(--card-color)] shadow-md rounded-lg"
              >
                <h3 className="text-lg font-semibold text-center mb-3">
                  {game.name}
                </h3>
                <div className="flex justify-center space-x-6">
                  {[game.homeTeam, game.awayTeam].map((team) => (
                    <label
                      key={team.id}
                      className={`cursor-pointer flex flex-col items-center p-3 border-2 rounded-lg transition-all
                        ${
                          predictions[game.id]?.teamId === team.id
                            ? "border-blue-500 bg-blue-100 shadow-md"
                            : "border-[var(--border-color)] bg-[var(--card-color)] hover:bg-[var(--hover-color)]"
                        }
                      `}
                      onClick={() => handlePredictionChange(game.id, team.id)}
                    >
                      <input
                        type="radio"
                        name={`prediction-${game.id}`}
                        value={team.id}
                        checked={predictions[game.id]?.teamId === team.id}
                        onChange={() =>
                          handlePredictionChange(game.id, team.id)
                        }
                        className="hidden"
                      />
                      <Image
                        src={team.logo}
                        alt={team.name}
                        width={64}
                        height={64}
                      />
                      <span className="mt-2 text-lg font-semibold">
                        {team.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        Record: {team.record || "N/A"}
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
        <>
          <h1 className="text-2xl font-bold text-center mb-4">
            Predictions Locked – See What Everyone Picked
          </h1>
          <div className="space-y-4">
            {games.map((game) => (
              <details
                key={game.id}
                className="bg-[var(--card-color)] rounded shadow-md"
              >
                <summary className="px-4 py-3 font-semibold cursor-pointer">
                  {game.name}
                </summary>
                <div className="p-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[game.homeTeam, game.awayTeam].map((team) => (
                    <div key={team.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <Image
                          src={team.logo}
                          alt={team.name}
                          width={24}
                          height={24}
                        />
                        <span className="font-semibold">{team.name}</span>
                      </div>
                      <ul className="ml-6 list-disc text-sm text-[var(--text-color)]">
                        {allUserPicks
                          .filter(
                            (entry) =>
                              entry.predictions?.[game.id]?.teamId === team.id
                          )
                          .map((entry) => (
                            <li key={entry.userId}>
                              {entry.userId === user?.uid
                                ? "You"
                                : entry.userId}
                              {entry.predictions[game.id].isCorrect ===
                                true && (
                                <span className="text-green-500">
                                  {" "}
                                  (Correct)
                                </span>
                              )}
                              {entry.predictions[game.id].isCorrect ===
                                false && (
                                <span className="text-red-500"> (Wrong)</span>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
