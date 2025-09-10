"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, collection, getDocs } from "firebase/firestore";
import Image from "next/image";
import GamePredictionView from "../../components/GamePredictionView";
import { Toaster, toast } from "react-hot-toast";

const toSlug = (t) => {
  const s = (t || "").toString().toLowerCase();
  return s.includes("post") ? "postseason" : "regular";
};

const toDisplay = (t) =>
  toSlug(t) === "postseason" ? "Postseason" : "Regular Season";

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedSeasonType, setSelectedSeasonType] = useState("Regular");

  const [availableYears, setAvailableYears] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);

  // Defaults from config
  useEffect(() => {
    (async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "config"));
        if (!configDoc.exists()) return;

        const { seasonYear, recapWeek, seasonType } = configDoc.data();
        setSelectedYear(Number(seasonYear));
        setSelectedWeek(Number(recapWeek));
        // Normalize initial UI value to "Regular"/"Postseason"
        setSelectedSeasonType(
          toSlug(seasonType) === "postseason" ? "Postseason" : "Regular"
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Available years/weeks for the chosen season type
  useEffect(() => {
    if (selectedYear === null || !selectedSeasonType) return;

    (async () => {
      try {
        const hs = await getDocs(collection(db, "history"));
        const yearsSet = new Set();
        const weeksSet = new Set();
        const desiredSlug = toSlug(selectedSeasonType);

        hs.forEach((d) => {
          const data = d.data() || {};
          const docSlug = toSlug(data.seasonType);
          if (docSlug !== desiredSlug) return;
          yearsSet.add(Number(data.seasonYear));
          if (Number(data.seasonYear) === Number(selectedYear)) {
            weeksSet.add(Number(data.week));
          }
        });

        const years = Array.from(yearsSet).sort((a, b) => b - a);
        const weeks = Array.from(weeksSet).sort((a, b) => a - b);

        setAvailableYears(years);
        setAvailableWeeks(weeks);
      } catch (err) {
        console.error("Error fetching history list:", err);
        toast.error("Error fetching available history.");
      }
    })();
  }, [selectedSeasonType, selectedYear]);

  // Fetch a single history doc
  useEffect(() => {
    if (!selectedYear || !selectedWeek || !selectedSeasonType) return;

    (async () => {
      setLoading(true);
      try {
        const slug = toSlug(selectedSeasonType);
        const primaryId = `${selectedYear}-${slug}-week${selectedWeek}`;

        let snap = await getDoc(doc(db, "history", primaryId));

        // fallbacks for legacy casing
        if (!snap.exists()) {
          const legacyExact = `${selectedYear}-${selectedSeasonType}-week${selectedWeek}`;
          const legacyLower = `${selectedYear}-${selectedSeasonType.toLowerCase()}-week${selectedWeek}`;
          snap = await getDoc(doc(db, "history", legacyExact));
          if (!snap.exists()) {
            snap = await getDoc(doc(db, "history", legacyLower));
          }
        }

        if (!snap.exists()) {
          setHistory(null);
          setLoading(false);
          return;
        }

        // Enrich names/avatars if missing using users map
        const data = snap.data();
        const usersSnap = await getDocs(collection(db, "users"));
        const userMap = {};
        usersSnap.forEach((u) => {
          const ud = u.data();
          if (ud?.uid) userMap[ud.uid] = ud;
        });

        const fillUser = (arr = []) =>
          arr.map((e) => {
            const u = userMap[e.uid] || {};
            return {
              ...e,
              fullName:
                e.fullName ||
                u.fullName ||
                [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                e.uid,
              profilePicture:
                e.profilePicture || u.profilePicture || "/default-avatar.png",
            };
          });

        const hydrated = {
          ...data,
          recap: data.recap
            ? {
                ...data.recap,
                topScorers: fillUser(data.recap.topScorers),
                lowestScorers: fillUser(data.recap.lowestScorers),
                biggestRisers: fillUser(data.recap.biggestRisers),
                biggestFallers: fillUser(data.recap.biggestFallers),
                scores: fillUser(data.recap.scores),
              }
            : data.recap,
          // If your top-level leaderboard array is displayed elsewhere, you can hydrate it too
          leaderboard: fillUser(data.leaderboard),
        };

        setHistory(hydrated);
      } catch (err) {
        console.error("Error fetching history:", err);
        toast.error("Error fetching history data.");
        setHistory(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedYear, selectedWeek, selectedSeasonType]);

  const avgScore = useMemo(() => {
    if (!history?.recap?.scores?.length) return 0;
    const total = history.recap.scores.reduce(
      (s, u) => s + (Number(u.score) || 0),
      0
    );
    return (total / history.recap.scores.length).toFixed(2);
  }, [history]);

  const Section = ({ title, users = [] }) => (
    <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 mb-4 shadow">
      <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
        {title}
      </h2>
      {users.length === 0 ? (
        <p className="opacity-70">No data.</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.uid} className="flex items-center gap-3">
              <Image
                src={u.profilePicture || "/default-avatar.png"}
                alt={u.fullName || u.uid}
                width={32}
                height={32}
                className="rounded-full border border-[var(--border-color)]"
              />
              <span className="text-[var(--text-color)] font-medium">
                {u.fullName || u.uid}
              </span>
              {u.score !== undefined && (
                <span className="ml-auto text-[var(--text-color)] font-semibold">
                  {u.score} pts
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <Toaster position="top-center" />
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-3xl font-bold mb-4">📚 Weekly History</h1>
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedYear || ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-2 rounded-md bg-[var(--card-color)] text-[var(--text-color)] border border-[var(--border-color)]"
          >
            {availableYears.length === 0 ? (
              <option disabled>No years available</option>
            ) : (
              availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            )}
          </select>

          <select
            value={selectedSeasonType}
            onChange={(e) => setSelectedSeasonType(e.target.value)}
            className="p-2 rounded-md bg-[var(--card-color)] text-[var(--text-color)] border border-[var(--border-color)]"
          >
            <option value="Regular">Regular Season</option>
            <option value="Postseason">Postseason</option>
          </select>

          <select
            value={selectedWeek || ""}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="p-2 rounded-md bg-[var(--card-color)] text-[var(--text-color)] border border-[var(--border-color)]"
          >
            {availableWeeks.length === 0 ? (
              <option disabled>No weeks available</option>
            ) : (
              availableWeeks.map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-[var(--text-color)] mt-4">
          Loading history...
        </p>
      ) : !history ? (
        <p className="text-center text-red-500 mt-4">No history data found.</p>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-xl font-bold text-center mb-6">
            {toDisplay(selectedSeasonType)} – Week {selectedWeek} Recap (
            {selectedYear})
          </h2>

          <Section title="🔥 Top Scorers" users={history.recap?.topScorers} />
          <Section
            title="❄️ Lowest Scorers"
            users={history.recap?.lowestScorers}
          />
          <Section
            title="📈 Biggest Risers"
            users={history.recap?.biggestRisers}
          />
          <Section
            title="📉 Biggest Fallers"
            users={history.recap?.biggestFallers}
          />

          <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 shadow">
            <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
              📊 All Scores
            </h2>
            {history.recap?.scores?.length ? (
              <>
                <ul className="space-y-2">
                  {history.recap.scores.map((u) => (
                    <li key={u.uid} className="flex items-center gap-3">
                      <Image
                        src={u.profilePicture || "/default-avatar.png"}
                        alt={u.fullName || u.uid}
                        width={32}
                        height={32}
                        className="rounded-full border border-[var(--border-color)]"
                      />
                      <span className="text-[var(--text-color)] font-medium">
                        {u.fullName || u.uid}
                      </span>
                      <span className="ml-auto text-[var(--text-color)] font-semibold">
                        {u.score} pts
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-center text-sm text-[var(--text-color)] mt-4">
                  {history.recap.scores.length} participants — Avg Score:{" "}
                  {avgScore}
                </p>
              </>
            ) : (
              <p className="opacity-70">No scores recorded.</p>
            )}
          </div>

          {history.games && history.games.length > 0 && (
            <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 shadow">
              <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
                🏈 Weekly Matchups
              </h2>
              <GamePredictionView
                games={history.games}
                seasonYear={selectedYear}
                seasonType={selectedSeasonType}
                week={selectedWeek}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
