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

  // theme
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "theme-light";
    document.body.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-vibrant"
    );
    document.body.classList.add(theme);
  }, []);

  // load config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "config"));
        if (configDoc.exists()) {
          const c = configDoc.data();
          setWeek(c.week);
          setSeasonYear(c.seasonYear);
          setSeasonType(c.seasonType);
          if (c.gameOfTheWeekId) setGameOfTheWeekId(String(c.gameOfTheWeekId));

          if (c.deadline?.seconds) {
            const deadlineDate = new Date(c.deadline.seconds * 1000);
            setDeadline(deadlineDate);
            setIsDeadlinePassed(new Date() > deadlineDate);
          }
        }
      } catch (e) {
        console.error("Error fetching config:", e);
      }
    };
    fetchConfig();
  }, []);

  // load games for the week
  useEffect(() => {
    if (!seasonYear || !seasonType || !week) return;
    const fetchGames = async () => {
      try {
        const gamesQ = query(
          collection(db, "games"),
          where("seasonYear", "==", seasonYear),
          where("seasonType", "==", seasonType),
          where("week", "==", week)
        );
        const snapshot = await getDocs(gamesQ);
        const filteredGames = snapshot.docs.map((d) => {
          const g = d.data();
          return {
            ...g,
            id: String(g.id),
            winnerId: g.winnerId != null ? String(g.winnerId) : null,
            homeTeam: { ...g.homeTeam, id: String(g.homeTeam?.id) },
            awayTeam: { ...g.awayTeam, id: String(g.awayTeam?.id) },
          };
        });

        filteredGames.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setGames(filteredGames);

        // initialize GOTW wager default (points clamped later by userPoints effect)
        const gotw = filteredGames.find(
          (g) => String(g.id) === String(gameOfTheWeekId)
        );
        if (gotw && !wagerPick) {
          setWagerPick({ gameId: String(gotw.id), teamId: null, points: 1 });
        }
      } catch (e) {
        console.error("Error fetching games:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonYear, seasonType, week, gameOfTheWeekId]);

  // load user's existing predictions (and existing wager if present)
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
          const d = snap.data();
          setPredictions(d.predictions || {});
          if (d.wager) {
            setWagerPick({
              gameId: String(d.wager.gameId),
              teamId: d.wager.teamId ? String(d.wager.teamId) : null,
              points: Number(d.wager.points) || 1,
            });
          }
        }
      } catch (e) {
        console.error("Error fetching user predictions:", e);
      }
    };
    fetchPredictions();
  }, [user, week, seasonType, seasonYear]);

  // load user's current points (for max wager)
  useEffect(() => {
    if (!user?.uid || !seasonType) return;
    const fetchPoints = async () => {
      try {
        const leaderboardCollection =
          seasonType === "Postseason" ? "leaderboardPostseason" : "leaderboard";
        const pointsDoc = await getDoc(
          doc(db, leaderboardCollection, user.uid)
        );
        setUserPoints(
          pointsDoc.exists()
            ? Number((pointsDoc.data() || {}).totalPoints || 0)
            : 0
        );
      } catch (e) {
        console.error("Error fetching leaderboard points:", e);
      }
    };
    fetchPoints();
  }, [user?.uid, seasonType]);

  // clamp wager to available points whenever points change
  useEffect(() => {
    if (!wagerPick) return;
    setWagerPick((prev) =>
      prev
        ? {
            ...prev,
            points: Math.max(0, Math.min(prev.points || 0, userPoints || 0)),
          }
        : prev
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPoints]);

  // after deadline: fetch everyone’s picks + users
  useEffect(() => {
    if (!deadline || !isDeadlinePassed || !seasonYear || !seasonType || !week)
      return;
    const fetchAllUserPicks = async () => {
      try {
        const picksQueryRef = query(
          collection(db, "picks"),
          where("seasonYear", "==", seasonYear),
          where("seasonType", "==", seasonType),
          where("week", "==", week)
        );
        const snapshot = await getDocs(picksQueryRef);
        const picks = snapshot.docs.map((d) => d.data());
        setAllUserPicks(picks);

        const usersSnapshot = await getDocs(collection(db, "users"));
        const map = {};
        usersSnapshot.forEach((u) => {
          const data = u.data();
          map[data.uid] = data;
        });
        setUserMap(map);
      } catch (e) {
        console.error("Error fetching all picks or users:", e);
      }
    };
    fetchAllUserPicks();
  }, [deadline, isDeadlinePassed, seasonYear, seasonType, week]);

  const handlePredictionChange = (gameId, teamId) => {
    setPredictions((prev) => ({
      ...prev,
      [String(gameId)]: { teamId: String(teamId), isCorrect: null },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user || !seasonYear || !seasonType || !week) return;

    const allPicked = games.every(
      (game) => predictions[String(game.id)]?.teamId
    );
    if (!allPicked) {
      alert("Please make a prediction for every game before submitting.");
      return;
    }

    // validate GOTW wager
    if (gameOfTheWeekId) {
      if (!wagerPick?.teamId || (wagerPick.points ?? 0) <= 0) {
        alert(
          "Please make your Game of the Week pick and enter a valid wager."
        );
        return;
      }
      if (wagerPick.points > userPoints || wagerPick.points < 0) {
        alert(`Wager must be between 0 and ${userPoints} points.`);
        return;
      }
    }

    try {
      // Save predictions (merge; do not overwrite doc)
      const ref = doc(
        db,
        "picks",
        `${seasonYear}-${seasonType}-week${week}-${user.uid}`
      );
      await setDoc(
        ref,
        { userId: user.uid, seasonYear, seasonType, week, predictions },
        { merge: true }
      );

      // Place/Update Wager via API (server validates against kickoff & points)
      if (gameOfTheWeekId && wagerPick?.teamId && (wagerPick.points ?? 0) > 0) {
        const resp = await fetch("/api/placeWager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            seasonYear,
            seasonType,
            week,
            teamId: String(wagerPick.teamId),
            points: Number(wagerPick.points),
          }),
        });
        const j = await resp.json();
        if (!resp.ok) throw new Error(j?.error || "Failed to place wager");
      }

      alert("Predictions submitted!");
      router.push("/");
    } catch (error) {
      console.error("Error submitting:", error);
      alert("Something went wrong submitting your picks. Please try again.");
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
            {/* Regular games (exclude GOTW card below) */}
            {games
              .filter((game) => String(game.id) !== String(gameOfTheWeekId))
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
                            predictions[String(game.id)]?.teamId ===
                            String(team.id)
                              ? "border-blue-500 bg-blue-100 shadow-md"
                              : "border-[var(--border-color)] bg-[var(--card-color)] hover:bg-[var(--hover-color)]"
                          }`}
                        onClick={() =>
                          handlePredictionChange(
                            String(game.id),
                            String(team.id)
                          )
                        }
                      >
                        <input
                          type="radio"
                          name={`prediction-${game.id}`}
                          value={team.id}
                          checked={
                            predictions[String(game.id)]?.teamId ===
                            String(team.id)
                          }
                          onChange={() =>
                            handlePredictionChange(
                              String(game.id),
                              String(team.id)
                            )
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

            {/* Game of the Week */}
            {gameOfTheWeekId && (
              <div className="my-6 p-4 bg-yellow-100 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-center mb-2">
                  🔥 Game of the Week{" "}
                  <span className="text-yellow-500 align-middle">⭐</span>
                </h2>
                <p className="text-center text-sm mb-4">
                  Choose a team and risk your points. Double if you&apos;re
                  right — lose them if you&apos;re wrong.
                </p>

                {games
                  .filter((g) => String(g.id) === String(gameOfTheWeekId))
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
                              String(wagerPick?.teamId) === String(team.id)
                                ? "border-orange-500 bg-orange-100 shadow-md"
                                : "border-[var(--border-color)] bg-[var(--card-color)] hover:bg-[var(--hover-color)]"
                            }`}
                          onClick={() =>
                            setWagerPick((prev) => ({
                              ...(prev || {
                                gameId: String(game.id),
                                points: Math.min(1, userPoints || 0),
                              }),
                              gameId: String(game.id),
                              teamId: String(team.id),
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
                    value={wagerPick?.points ?? ""}
                    onChange={(e) => {
                      const n = Math.max(
                        0,
                        Math.min(parseInt(e.target.value) || 0, userPoints)
                      );
                      setWagerPick((prev) =>
                        prev ? { ...prev, points: n } : prev
                      );
                    }}
                    disabled={!userPoints}
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
        // Locked view
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
                <summary className="px-4 py-3 font-semibold cursor-pointer flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {String(game.id) === String(gameOfTheWeekId) && (
                      <span className="text-yellow-500">⭐</span>
                    )}

                    <Image
                      src={game.homeTeam.logo}
                      alt={game.homeTeam.name}
                      width={20}
                      height={20}
                    />
                    <span
                      className={
                        game.winnerId
                          ? String(game.winnerId) === String(game.homeTeam.id)
                            ? "text-green-600"
                            : "text-red-600"
                          : ""
                      }
                    >
                      {game.homeTeam.abbreviation}
                    </span>

                    <span className="mx-1">vs</span>

                    <Image
                      src={game.awayTeam.logo}
                      alt={game.awayTeam.name}
                      width={20}
                      height={20}
                    />
                    <span
                      className={
                        game.winnerId
                          ? String(game.winnerId) === String(game.awayTeam.id)
                            ? "text-green-600"
                            : "text-red-600"
                          : ""
                      }
                    >
                      {game.awayTeam.abbreviation}
                    </span>
                  </div>
                </summary>

                <div className="p-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[game.homeTeam, game.awayTeam].map((team) => {
                    const usersForTeam = allUserPicks
                      .filter(
                        (entry) =>
                          String(
                            entry.predictions?.[String(game.id)]?.teamId
                          ) === String(team.id)
                      )
                      .sort((a, b) => {
                        const nameA = userMap[a.userId]?.firstName || a.userId;
                        const nameB = userMap[b.userId]?.firstName || b.userId;
                        return nameA.localeCompare(nameB);
                      });

                    const teamColor =
                      game.winnerId == null
                        ? ""
                        : String(game.winnerId) === String(team.id)
                        ? "text-green-600"
                        : "text-red-600";

                    return (
                      <div key={team.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <Image
                            src={team.logo}
                            alt={team.name}
                            width={24}
                            height={24}
                          />
                          <span className={`font-semibold ${teamColor}`}>
                            {team.name}
                          </span>
                        </div>

                        <ul className="ml-6 list-disc text-sm text-[var(--text-color)]">
                          {usersForTeam.map((entry) => {
                            const pred = entry.predictions?.[String(game.id)];
                            const isCorrect = pred?.isCorrect;
                            const userColor =
                              isCorrect === true
                                ? "text-green-600"
                                : isCorrect === false
                                ? "text-red-600"
                                : "";

                            return (
                              <li key={entry.userId} className={userColor}>
                                {entry.userId === user?.uid
                                  ? "You"
                                  : userMap[entry.userId]?.firstName ||
                                    entry.userId}
                                {/* show wager next to name on GOTW */}
                                {String(game.id) === String(gameOfTheWeekId) &&
                                  String(entry.wager?.teamId) ===
                                    String(team.id) &&
                                  Number(entry.wager?.points) > 0 && (
                                    <span className="text-yellow-600">
                                      {" "}
                                      ({entry.wager.points} pts)
                                    </span>
                                  )}
                              </li>
                            );
                          })}
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
