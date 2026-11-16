"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FaCheck,
  FaClock,
  FaLock,
  FaMinus,
  FaPlus,
  FaStar,
} from "react-icons/fa";
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

  const setWagerPoints = (n) =>
    setWagerPick((prev) =>
      prev
        ? { ...prev, points: Math.max(0, Math.min(n || 0, maxWagerPoints)) }
        : prev,
    );

  const regularGames = games.filter(
    (game) => String(game.id) !== String(gameOfTheWeekId),
  );
  const gotwGame = games.find((g) => String(g.id) === String(gameOfTheWeekId));
  const pickedCount = games.filter(
    (g) => predictions[String(g.id)]?.teamId,
  ).length;

  const weekHeader = (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-accent-text">
        {seasonTypeLabel(seasonType)}
      </p>
      <h1 className="text-4xl uppercase italic leading-none">Week {week}</h1>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5">
      {isLoading ? (
        <div className="space-y-3" aria-label="Loading games">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-surface border border-line animate-pulse"
            />
          ))}
        </div>
      ) : !games.length ? (
        <div className="rounded-2xl bg-surface border border-line shadow-card p-8 text-center">
          <p className="font-semibold">No games available yet</p>
          <p className="text-sm text-muted mt-1">
            {seasonTypeLabel(seasonType)} - Week {week}
          </p>
        </div>
      ) : !isDeadlinePassed ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            {weekHeader}
            <span className="inline-flex items-center gap-2 rounded-full bg-surface border border-line px-3 py-1.5 text-sm font-medium shadow-card">
              <FaClock className="text-accent-text" />
              Picks lock{" "}
              {deadline?.toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                timeZoneName: "short",
              })}
            </span>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-semibold">
                {pickedCount} of {games.length} picked
              </span>
              {pickedCount === games.length && (
                <span className="text-success font-semibold">All set!</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-gradient transition-all"
                style={{ width: `${(pickedCount / games.length) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Regular games (exclude GOTW card below) */}
            {regularGames.map((game) => (
              <div
                key={game.id}
                className="rounded-2xl bg-surface border border-line shadow-card p-4"
              >
                <GameMeta game={game} />
                <TeamPair
                  game={game}
                  selectedId={predictions[String(game.id)]?.teamId}
                  onSelect={(teamId) =>
                    handlePredictionChange(String(game.id), teamId)
                  }
                />
              </div>
            ))}

            {/* Game of the Week */}
            {gameOfTheWeekId && (
              <div className="rounded-2xl bg-surface border-2 border-[#f5b301]/70 shadow-card overflow-hidden">
                <div className="flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-[#f5b301] to-[#ffcf4d] text-black font-display text-lg font-extrabold uppercase italic tracking-wide">
                  <FaStar /> Game of the Week
                </div>

                <div className="p-4">
                  <p className="text-center text-sm text-muted mb-4">
                    Choose a team and risk your points. Double if you&apos;re
                    right — lose them if you&apos;re wrong.
                  </p>

                  {gotwGame && (
                    <>
                      <GameMeta game={gotwGame} />
                      <TeamPair
                        game={gotwGame}
                        gold
                        selectedId={wagerPick?.teamId}
                        onSelect={(teamId) => {
                          setWagerPick((prev) => ({
                            ...(prev || {
                              gameId: String(gotwGame.id),
                              points: Math.min(1, userPoints || 0),
                            }),
                            gameId: String(gotwGame.id),
                            teamId,
                          }));
                          // keep local predictions in sync so "all picked" logic is happy
                          handlePredictionChange(String(gotwGame.id), teamId);
                        }}
                      />
                    </>
                  )}

                  <div className="mt-5 flex flex-col items-center">
                    <label
                      htmlFor="wager-points"
                      className="text-xs font-bold uppercase tracking-widest text-muted mb-2"
                    >
                      Wager
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease wager"
                        onClick={() =>
                          setWagerPoints((wagerPick?.points ?? 0) - 1)
                        }
                        disabled={!maxWagerPoints || isSubmitting}
                        className="grid place-items-center h-10 w-10 rounded-full bg-surface-2 border border-line hover:bg-accent/10 disabled:opacity-40"
                      >
                        <FaMinus className="text-xs" />
                      </button>
                      <input
                        id="wager-points"
                        type="number"
                        min={0}
                        max={maxWagerPoints}
                        className="w-20 py-1 text-center font-display text-3xl font-extrabold tabular-nums bg-transparent border-b-2 border-[#f5b301] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={wagerPick?.points ?? ""}
                        onChange={(e) =>
                          setWagerPoints(parseInt(e.target.value) || 0)
                        }
                        disabled={!maxWagerPoints || isSubmitting}
                      />
                      <button
                        type="button"
                        aria-label="Increase wager"
                        onClick={() =>
                          setWagerPoints((wagerPick?.points ?? 0) + 1)
                        }
                        disabled={!maxWagerPoints || isSubmitting}
                        className="grid place-items-center h-10 w-10 rounded-full bg-surface-2 border border-line hover:bg-accent/10 disabled:opacity-40"
                      >
                        <FaPlus className="text-xs" />
                      </button>
                    </div>
                    <p className="text-xs text-muted mt-2">
                      You can risk up to {maxWagerPoints} points this week
                      {maxWagerPoints < userPoints
                        ? ` (capped at ${wagerMaxPoints}; you have ${userPoints}).`
                        : "."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting ? "true" : "false"}
              className="w-full py-3.5 rounded-xl bg-accent-gradient text-white font-display text-xl font-extrabold uppercase italic tracking-wide shadow-card transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            {weekHeader}
            <span className="inline-flex items-center gap-2 rounded-full bg-surface border border-line px-3 py-1.5 text-sm font-medium shadow-card">
              <FaLock className="text-accent-text" />
              Picks locked
            </span>
          </div>
          <p className="text-muted">See what everyone picked.</p>
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

function GameMeta({ game }) {
  const kickoff = game.date
    ? new Date(game.date).toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex items-center justify-between gap-2 mb-3 text-xs text-muted">
      <span className="truncate">{game.name}</span>
      {kickoff && <span className="shrink-0 font-semibold">{kickoff}</span>}
    </div>
  );
}

function TeamPair({ game, selectedId, onSelect, gold = false }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
      <TeamTile
        team={game.homeTeam}
        selected={String(selectedId) === String(game.homeTeam.id)}
        onSelect={onSelect}
        gold={gold}
      />
      <span className="font-display text-lg font-extrabold italic text-muted">
        VS
      </span>
      <TeamTile
        team={game.awayTeam}
        selected={String(selectedId) === String(game.awayTeam.id)}
        onSelect={onSelect}
        gold={gold}
      />
    </div>
  );
}

function TeamTile({ team, selected, onSelect, gold }) {
  const selectedStyle = gold
    ? "border-[#f5b301] bg-[#f5b301]/15 ring-2 ring-[#f5b301]"
    : "border-accent bg-accent/10 ring-2 ring-accent";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(String(team.id))}
      className={`relative flex flex-col items-center text-center p-3 sm:p-4 rounded-xl border transition-all active:scale-[0.98] ${
        selected
          ? selectedStyle
          : "border-line bg-surface-2/50 hover:bg-surface-2"
      }`}
    >
      {selected && (
        <span
          className={`absolute top-2 right-2 grid place-items-center h-5 w-5 rounded-full text-[10px] ${
            gold ? "bg-[#f5b301] text-black" : "bg-accent text-white"
          }`}
        >
          <FaCheck />
        </span>
      )}
      <Image
        src={team.logo}
        alt={team.mascot}
        width={56}
        height={56}
        className="h-14 w-14 object-contain"
      />
      <span className="mt-2 font-display text-xl font-bold uppercase leading-tight truncate w-full">
        {team.mascot || team.name}
      </span>
      <span className="text-xs text-muted tabular-nums">
        {team.record?.trim() ? team.record : "0-0"}
      </span>
    </button>
  );
}
