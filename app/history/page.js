"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, collection, getDocs } from "firebase/firestore";
import WeeklyResultsView from "../../components/WeeklyResultsView";
import { Toaster, toast } from "react-hot-toast";
import RecapSummary from "../../components/RecapSummary";
import { FaChevronDown } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import {
  normalizeSeasonType,
  seasonTypeLabel,
  weekKey,
} from "../../lib/seasonType";

export default function HistoryPage() {
  const { user } = useAuth();
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

        const { seasonYear, recapWeek, recapSeasonType, seasonType } =
          configDoc.data();
        setSelectedYear(Number(seasonYear));
        setSelectedWeek(Number(recapWeek));
        // Normalize initial UI value to "Regular"/"Postseason"
        setSelectedSeasonType(
          normalizeSeasonType(recapSeasonType || seasonType) === "postseason"
            ? "Postseason"
            : "Regular",
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
        const desiredSlug = normalizeSeasonType(selectedSeasonType);

        hs.forEach((d) => {
          const data = d.data() || {};
          const docSlug = normalizeSeasonType(data.seasonType);
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
        const primaryId = weekKey({
          seasonYear: selectedYear,
          seasonType: selectedSeasonType,
          week: selectedWeek,
        });

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

        // publicProfiles, not users -- avoids scanning private fields.
        const data = snap.data();
        const usersSnap = await getDocs(collection(db, "publicProfiles"));
        const userMap = {};
        usersSnap.forEach((u) => {
          const ud = u.data();
          if (ud?.uid) userMap[ud.uid] = ud;
        });

        const fillUser = (arr = [], idKey = "uid") =>
          arr.map((e) => {
            const u = userMap[e[idKey]] || {};
            return {
              ...e,
              fullName:
                e.fullName ||
                u.fullName ||
                [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                e[idKey],
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
          picks: fillUser(data.picks, "userId"),
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

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5">
      <Toaster position="top-center" />
      <h1 className="text-4xl uppercase italic leading-none">History</h1>

      <div className="grid grid-cols-[auto_1fr_auto] gap-2">
        <FilterSelect
          label="Year"
          value={selectedYear || ""}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
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
        </FilterSelect>

        <FilterSelect
          label="Season"
          value={selectedSeasonType}
          onChange={(e) => setSelectedSeasonType(e.target.value)}
        >
          <option value="Regular">Regular Season</option>
          <option value="Postseason">Postseason</option>
        </FilterSelect>

        <FilterSelect
          label="Week"
          value={selectedWeek || ""}
          onChange={(e) => setSelectedWeek(Number(e.target.value))}
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
        </FilterSelect>
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Loading history">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-surface border border-line animate-pulse"
            />
          ))}
        </div>
      ) : !history ? (
        <div className="rounded-2xl bg-surface border border-line shadow-card p-8 text-center">
          <p className="font-semibold">No history data found.</p>
          <p className="text-sm text-muted mt-1">
            Try a different week or season.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-accent-text">
              {seasonTypeLabel(selectedSeasonType)} · {selectedYear}
            </p>
            <h2 className="text-3xl uppercase italic leading-none">
              Week {selectedWeek} Recap
            </h2>
          </div>

          <RecapSummary recap={history.recap} />

          {history.games && history.games.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-2xl uppercase italic leading-none pt-2">
                Weekly Matchups
              </h2>
              <WeeklyResultsView
                games={history.games}
                picks={history.picks || []}
                gameOfTheWeekId={history.gameOfTheWeekId}
                currentUserId={user?.uid}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-xl bg-surface border border-line shadow-card pl-3 pr-8 py-2.5 text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {children}
      </select>
      <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted" />
    </label>
  );
}
