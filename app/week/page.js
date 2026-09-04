"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FaStar } from "react-icons/fa";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import WeeklyResultsView from "../../components/WeeklyResultsView";
import {
  SEASON_TYPES,
  normalizeSeasonType,
  seasonTypeLabel,
  picksDocId,
  leaderboardScope,
} from "../../lib/seasonType";

export default function WeeklyPicks() {
  const { user } = useAuth();
  const router = useRouter();

  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [week, setWeek] = useState(null);
  const [seasonYear, setSeasonYear] = useState(null);
  const [seasonType, setSeasonType] = useState(SEASON_TYPES.REGULAR);
  const [deadline, setDeadline] = useState(null);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allUserPicks, setAllUserPicks] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [gameOfTheWeekId, setGameOfTheWeekId] = useState(null);
  const [wagerPick, setWagerPick] = useState(null); // { gameId, teamId, points }
  const [userPoints, setUserPoints] = useState(0);
  const [wagerMaxPoints, setWagerMaxPoints] = useState(5);
  const maxWagerPoints = Math.min(userPoints, wagerMaxPoints);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // theme
  useEffect(() => {
    const theme = localStorage.getItem("theme") || "theme-light";
    document.body.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-vibrant",
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
          setSeasonType(normalizeSeasonType(c.seasonType));
          if (c.gameOfTheWeekId) setGameOfTheWeekId(String(c.gameOfTheWeekId));
          if (c.wagerMaxPoints != null)
            setWagerMaxPoints(Number(c.wagerMaxPoints));

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
          where("week", "==", week),
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
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        setGames(filteredGames);

        // initialize GOTW wager default (points clamped later by the maxWagerPoints effect)
        const gotw = filteredGames.find(
          (g) => String(g.id) === String(gameOfTheWeekId),
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
          picksDocId({ seasonYear, seasonType, week, uid: user.uid }),
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
        const leaderboardCollection = `leaderboards/${leaderboardScope(seasonType)}/entries`;
        const pointsDoc = await getDoc(
          doc(db, leaderboardCollection, user.uid),
        );
        setUserPoints(
          pointsDoc.exists()
            ? Number((pointsDoc.data() || {}).totalPoints || 0)
            : 0,
        );
      } catch (e) {
        console.error("Error fetching leaderboard points:", e);
      }
    };
    fetchPoints();
  }, [user?.uid, seasonType]);

  // clamp wager to the lesser of available points and the configured cap
  useEffect(() => {
    if (!wagerPick) return;
    setWagerPick((prev) =>
      prev
        ? {
            ...prev,
            points: Math.max(0, Math.min(prev.points || 0, maxWagerPoints)),
          }
        : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxWagerPoints]);

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
          where("week", "==", week),
        );
        const snapshot = await getDocs(picksQueryRef);
        const picks = snapshot.docs.map((d) => d.data());
        setAllUserPicks(picks);

        // publicProfiles, not users -- only display fields are needed here.
        const usersSnapshot = await getDocs(collection(db, "publicProfiles"));
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
    if (isSubmitting) return;
    if (!user || !seasonYear || !seasonType || !week) return;

    const nonGotwGames = games.filter(
      (g) => String(g.id) !== String(gameOfTheWeekId),
    );
    const allPicked = nonGotwGames.every(
      (game) => predictions[String(game.id)]?.teamId,
    );
    if (!allPicked) {
      alert("Please make a prediction for every game before submitting.");
      return;
    }

    // validate GOTW wager
    if (gameOfTheWeekId) {
      if (!wagerPick?.teamId || (wagerPick.points ?? 0) <= 0) {
        alert(
          "Please make your Game of the Week pick and enter a valid wager.",
        );
        return;
      }
      if (wagerPick.points > maxWagerPoints || wagerPick.points < 0) {
        alert(`Wager must be between 0 and ${maxWagerPoints} points.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Save predictions (merge; do not overwrite doc)
      const ref = doc(
        db,
        "picks",
        picksDocId({ seasonYear, seasonType, week, uid: user.uid }),
      );
      await setDoc(
        ref,
        {
          userId: user.uid,
          seasonYear,
          seasonType,
          week,
          fullName: user.fullName || user.displayName || "",
          predictions,
        },
        { merge: true },
      );

      // Place/Update Wager via API (server validates against kickoff & points)
      if (gameOfTheWeekId && wagerPick?.teamId && (wagerPick.points ?? 0) > 0) {
        // auth.currentUser, not `user` -- object spread in AuthContext.js
        // drops the Auth User's prototype methods, getIdToken included.
        const idToken = await auth.currentUser.getIdToken();
        const resp = await fetch("/api/placeWager", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors min-h-screen">
      {isLoading ? (
        <p className="text-center">Loading...</p>
      ) : !games.length ? (
        <p className="text-center text-red-500">
          No games available for {seasonTypeLabel(seasonType)} - Week {week}.
        </p>
      ) : !isDeadlinePassed ? (
        <>
          <h1 className="text-2xl font-bold">
            Make Your Predictions ({seasonTypeLabel(seasonType)} - Week {week})
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
                              ? "border-blue-500 bg-blue-100 text-blue-900 shadow-md"
                              : "border-[var(--border-color)] bg-[var(--card-color)] hover:bg-[var(--hover-color)]"
                          }`}
                        onClick={() =>
                          handlePredictionChange(
                            String(game.id),
                            String(team.id),
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
                              String(team.id),
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
              <div className="my-6 p-5 rounded-xl border border-[var(--border-color)] bg-[var(--card-color)] shadow-md">
                <div className="flex items-center justify-center mb-3">
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border border-amber-400/50 text-amber-500">
                    <FaStar /> Game of the Week
                  </span>
                </div>

                <p className="text-center text-sm opacity-80 mb-4">
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
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-md"
                    : "border-[var(--border-color)] bg-[var(--card-color)] hover:bg-[var(--hover-color)]"
                }`}
                          onClick={() => {
                            setWagerPick((prev) => ({
                              ...(prev || {
                                gameId: String(game.id),
                                points: Math.min(1, userPoints || 0),
                              }),
                              gameId: String(game.id),
                              teamId: String(team.id),
                            }));
                            // keep local predictions in sync so "all picked" logic is happy
                            handlePredictionChange(
                              String(game.id),
                              String(team.id),
                            );
                          }}
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

                <div className="mt-5 flex flex-col items-center">
                  <label className="text-sm mb-1">Wager Amount</label>
                  <input
                    type="number"
                    min={0}
                    max={maxWagerPoints}
                    className="w-32 p-2 border rounded-sm text-center bg-[var(--card-color)] border-[var(--border-color)]"
                    value={wagerPick?.points ?? ""}
                    onChange={(e) => {
                      const n = Math.max(
                        0,
                        Math.min(parseInt(e.target.value) || 0, maxWagerPoints),
                      );
                      setWagerPick((prev) =>
                        prev ? { ...prev, points: n } : prev,
                      );
                    }}
                    disabled={!maxWagerPoints || isSubmitting}
                  />
                  <p className="text-xs opacity-70 mt-1">
                    You can risk up to {maxWagerPoints} points this week
                    {maxWagerPoints < userPoints
                      ? ` (capped at ${wagerMaxPoints}; you have ${userPoints}).`
                      : "."}
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting ? "true" : "false"}
              className={`bg-blue-500 text-white px-6 py-2 rounded-sm mt-4 block mx-auto transition-all
                hover:bg-blue-600
                disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Submitting…
                </span>
              ) : (
                "Submit Predictions"
              )}
            </button>
          </form>
        </>
      ) : (
        // Locked view
        <>
          <h1 className="text-2xl font-bold text-center mb-4">
            Predictions Locked – See What Everyone Picked
          </h1>
          <WeeklyResultsView
            games={games}
            picks={allUserPicks.map((entry) => ({
              ...entry,
              fullName:
                entry.fullName ||
                userMap[entry.userId]?.firstName ||
                entry.userId,
            }))}
            gameOfTheWeekId={gameOfTheWeekId}
            currentUserId={user?.uid}
          />
        </>
      )}
    </div>
  );
}
