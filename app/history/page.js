// /app/history/page.js

"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, collection, getDocs } from "firebase/firestore";
import Image from "next/image";
import GamePredictionView from "../../components/GamePredictionView"; // assumed component to visualize picks

export default function HistoryPage() {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedSeasonType, setSelectedSeasonType] =
    useState("Regular Season");
  const [availableYears, setAvailableYears] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [games, setGames] = useState([]);

  useEffect(() => {
    const fetchConfig = async () => {
      const configDoc = await getDoc(doc(db, "config", "predictionSettings"));
      if (configDoc.exists()) {
        const { seasonYear, week, seasonType } = configDoc.data();
        setSelectedYear(seasonYear);
        setSelectedWeek(week);
        setSelectedSeasonType(seasonType);

        const years = Array.from({ length: 5 }, (_, i) => seasonYear - i);
        setAvailableYears(years);

        const weeks =
          seasonType === "Postseason"
            ? [1, 2, 3, 4, 5]
            : Array.from({ length: 18 }, (_, i) => i + 1);
        setAvailableWeeks(weeks);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchRecapAndGames = async () => {
      setLoading(true);
      try {
        const configDoc = await getDoc(doc(db, "config", "predictionSettings"));
        const isCurrentYear = configDoc.data().seasonYear === selectedYear;
        const source = isCurrentYear ? "weeklyRecap" : "archivedRecaps";

        const recapDoc = await getDoc(
          doc(
            db,
            source,
            `${selectedYear}-${selectedSeasonType}-week${selectedWeek}`
          )
        );
        if (recapDoc.exists()) {
          setRecap(recapDoc.data());
        } else {
          setRecap(null);
        }

        const gamesDoc = await getDoc(
          doc(
            db,
            "games",
            `${selectedYear}-${selectedSeasonType}-week${selectedWeek}`
          )
        );
        if (gamesDoc.exists()) {
          setGames(gamesDoc.data().games || []);
        } else {
          setGames([]);
        }
      } catch (err) {
        console.error("Error fetching recap or games:", err);
      } finally {
        setLoading(false);
      }
    };

    if (selectedYear && selectedWeek && selectedSeasonType) {
      fetchRecapAndGames();
    }
  }, [selectedYear, selectedWeek, selectedSeasonType]);

  const Section = ({ title, users }) => (
    <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 mb-4 shadow">
      <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
        {title}
      </h2>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.uid} className="flex items-center gap-3">
            <Image
              src={u.profilePicture || "/default-avatar.png"}
              alt={u.fullName}
              width={32}
              height={32}
              className="rounded-full border border-[var(--border-color)]"
            />
            <span className="text-[var(--text-color)] font-medium">
              {u.fullName}
            </span>
            {u.score !== undefined && (
              <span className="ml-auto text-[var(--text-color)] font-semibold">
                {u.score} pts
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-3xl font-bold mb-4">📚 Weekly History</h1>
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedYear || ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-2 border rounded-md"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            value={selectedSeasonType}
            onChange={(e) => {
              setSelectedSeasonType(e.target.value);
              const newWeeks =
                e.target.value === "Postseason"
                  ? [1, 2, 3, 4, 5]
                  : Array.from({ length: 18 }, (_, i) => i + 1);
              setAvailableWeeks(newWeeks);
              setSelectedWeek(newWeeks[0]);
            }}
            className="p-2 border rounded-md"
          >
            <option value="Regular Season">Regular Season</option>
            <option value="Postseason">Postseason</option>
          </select>

          <select
            value={selectedWeek || ""}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="p-2 border rounded-md"
          >
            {availableWeeks.map((week) => (
              <option key={week} value={week}>
                Week {week}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-[var(--text-color)] mt-4">
          Loading recap...
        </p>
      ) : !recap ? (
        <p className="text-center text-red-500 mt-4">No recap data found.</p>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-xl font-bold text-center mb-6">
            {selectedSeasonType} - Week {selectedWeek} Recap ({selectedYear})
          </h2>
          <Section title="🔥 Top Scorers" users={recap.topScorers} />
          <Section title="❄️ Lowest Scorers" users={recap.lowestScorers} />
          <Section title="📈 Biggest Risers" users={recap.biggestRisers} />
          <Section title="📉 Biggest Fallers" users={recap.biggestFallers} />
          <Section title="📊 All Scores" users={recap.scores} />

          {games.length > 0 && (
            <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 shadow">
              <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
                🏈 Weekly Matchups
              </h2>
              <GamePredictionView
                games={games}
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
