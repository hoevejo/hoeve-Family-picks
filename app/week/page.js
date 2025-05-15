// /app/weeklyPicks/page.js

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
  const [userMap, setUserMap] = useState({});
  const [gameOfTheWeekId, setGameOfTheWeekId] = useState(null);
  const [wagerPick, setWagerPick] = useState(null); // { gameId, teamId, points }
  const [userPoints, setUserPoints] = useState(0);

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
          if (configData.gameOfTheWeekId) {
            setGameOfTheWeekId(configData.gameOfTheWeekId);
          }

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
        setGames(
          filteredGames.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )
        );
        const gotw = filteredGames.find((g) => g.id === gameOfTheWeekId);
        if (gotw) {
          setWagerPick({ gameId: gotw.id, teamId: null, points: 1 });
        }
      } catch (error) {
        console.error("Error fetching games:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, [seasonYear, seasonType, week, gameOfTheWeekId]);

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
    if (!user?.uid || !seasonType) return;

    const fetchPoints = async () => {
      try {
        const leaderboardCollection =
          seasonType === "Postseason" ? "leaderboardPostseason" : "leaderboard";

        const pointsDoc = await getDoc(
          doc(db, leaderboardCollection, user.uid)
        );
        if (pointsDoc.exists()) {
          setUserPoints(pointsDoc.data().totalPoints || 0);
        } else {
          setUserPoints(0); // fallback if not found
        }
      } catch (error) {
        console.error("Error fetching leaderboard points:", error);
      }
    };

    fetchPoints();
  }, [user?.uid, seasonType]);

  useEffect(() => {
    if (!deadline || !isDeadlinePassed || !seasonYear || !seasonType || !week)
      return;

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

        const usersSnapshot = await getDocs(collection(db, "users"));
        const userMapTemp = {};
        usersSnapshot.forEach((doc) => {
          const u = doc.data();
          userMapTemp[u.uid] = u;
        });
        setUserMap(userMapTemp);
      } catch (error) {
        console.error("Error fetching all picks or users:", error);
      }
    };
    fetchAllUserPicks();
  }, [deadline, isDeadlinePassed, seasonYear, seasonType, week]);

  const handlePredictionChange = (gameId, teamId) => {
    setPredictions((prev) => ({
      ...prev,
      [gameId]: { teamId, isCorrect: null },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const allPicked = games.every((game) => predictions[game.id]?.teamId);
    if (!allPicked) {
      alert("Please make a prediction for every game before submitting.");
      return;
    }
    if (gameOfTheWeekId && (!wagerPick?.teamId || wagerPick.points <= 0)) {
      alert("Please make your Game of the Week pick and enter a valid wager.");
      return;
    }
    if (
      wagerPick?.teamId &&
      (wagerPick.points > userPoints || wagerPick.points < 0)
    ) {
      alert(`Wager must be between 0 and ${userPoints} points.`);
      return;
    }

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
        ...(wagerPick?.teamId && wagerPick.points > 0 && { wager: wagerPick }),
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
          <h2>
            Deadline:{" "}
            {deadline?.toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
              timeZoneName: "short",
            })}
          </h2>
          <form onSubmit={handleSubmit}>
            {games
              .filter((game) => game.id !== gameOfTheWeekId)
              .map((game) => (
                <div
                  key={game.id}
                  className="my-4 p-4 bg-[var(--card-color)] shadow-md rounded-lg"
                >
                  <h3 className="text-lg font-semibold text-center mb-3">
                    {game.name}
                  </h3>
                  <div className="flex flex-row justify-center gap-4 sm:gap-6">
                    {[game.homeTeam, game.awayTeam].map((team) => (
                      <label
                        key={team.id}
                        className={`w-36 sm:w-40 h-44 sm:h-48 flex flex-col items-center justify-center text-center p-3 border-2 rounded-lg transition-all
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
                          alt={team.mascot}
                          width={64}
                          height={64}
                        />
                        <span className="mt-2 text-lg font-semibold truncate w-full">
                          {team.mascot || team.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          Record: {team.record?.trim() ? team.record : "0-0"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            {gameOfTheWeekId && (
              <div className="my-6 p-4 bg-yellow-100 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-center mb-2">
                  🔥 Game of the Week
                </h2>
                <p className="text-center text-sm mb-4">
                  Choose a team and risk your points. Double if you&apos;re
                  right — lose them if you&apos;re wrong.
                </p>

                {games
                  .filter((g) => g.id === gameOfTheWeekId)
                  .map((game) => (
                    <div
                      key={game.id}
                      className="flex flex-row justify-center gap-4 sm:gap-6"
                    >
                      {[game.homeTeam, game.awayTeam].map((team) => (
                        <label
                          key={team.id}
                          className={`w-36 sm:w-40 h-44 sm:h-48 flex flex-col items-center justify-center text-center p-3 border-2 rounded-lg transition-all
                ${
                  wagerPick?.teamId === team.id
                    ? "border-orange-500 bg-orange-100 shadow-md"
                    : "border-[var(--border-color)] bg-[var(--card-color)] hover:bg-[var(--hover-color)]"
                }`}
                          onClick={() =>
                            setWagerPick((prev) => ({
                              ...prev,
                              gameId: game.id,
                              teamId: team.id,
                            }))
                          }
                        >
                          <Image
                            src={team.logo}
                            alt={team.mascot}
                            width={64}
                            height={64}
                          />
                          <span className="mt-2 text-lg font-semibold truncate w-full">
                            {team.mascot || team.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}

                <div className="mt-4 flex flex-col items-center">
                  <label className="text-sm mb-1">Wager Amount</label>
                  <input
                    type="number"
                    min={0}
                    max={userPoints}
                    className="w-32 p-2 border rounded text-center"
                    value={wagerPick?.points || ""}
                    onChange={(e) =>
                      setWagerPick((prev) => ({
                        ...prev,
                        points: Math.min(
                          parseInt(e.target.value) || 0,
                          userPoints
                        ),
                      }))
                    }
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    You have {userPoints} points available.
                  </p>
                </div>
              </div>
            )}

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
                <summary
                  className={`px-4 py-3 font-semibold cursor-pointer flex items-center justify-between gap-2
    ${game.winnerId ? "bg-green-100" : ""}
    ${game.id === gameOfTheWeekId ? "border-2 border-yellow-400" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {game.id === gameOfTheWeekId && (
                      <span className="text-yellow-500">⭐</span>
                    )}
                    <Image
                      src={game.homeTeam.logo}
                      alt={game.homeTeam.name}
                      width={20}
                      height={20}
                    />
                    <span>{game.homeTeam.abbreviation}</span>
                    <span className="mx-1">vs</span>
                    <Image
                      src={game.awayTeam.logo}
                      alt={game.awayTeam.name}
                      width={20}
                      height={20}
                    />
                    <span>{game.awayTeam.abbreviation}</span>
                  </div>
                </summary>

                <div className="p-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[game.homeTeam, game.awayTeam].map((team) => {
                    const usersForTeam = allUserPicks
                      .filter(
                        (entry) =>
                          entry.predictions?.[game.id]?.teamId === team.id
                      )
                      .sort((a, b) => {
                        const nameA = userMap[a.userId]?.firstName || a.userId;
                        const nameB = userMap[b.userId]?.firstName || b.userId;
                        return nameA.localeCompare(nameB);
                      });

                    return (
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
                          {usersForTeam.map((entry) => (
                            <li key={entry.userId}>
                              {entry.userId === user?.uid
                                ? "You"
                                : userMap[entry.userId]?.firstName ||
                                  entry.userId}
                              {game.id === gameOfTheWeekId &&
                                entry.wager?.teamId === team.id &&
                                entry.wager?.points > 0 && (
                                  <span className="text-yellow-600">
                                    {" "}
                                    ({entry.wager.points} pts)
                                  </span>
                                )}
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
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
