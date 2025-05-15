"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, collection, getDocs } from "firebase/firestore";
import Image from "next/image";
import GamePredictionView from "../../components/GamePredictionView";

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedSeasonType, setSelectedSeasonType] = useState("Regular");
  const [availableYears, setAvailableYears] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);

  useEffect(() => {
    const fetchDefaults = async () => {
      const configDoc = await getDoc(doc(db, "config", "config"));
      if (!configDoc.exists()) return;

      const { seasonYear, recapWeek, seasonType } = configDoc.data();
      setSelectedYear(seasonYear);
      setSelectedWeek(recapWeek);
      setSelectedSeasonType(seasonType);
    };
    fetchDefaults();
  }, []);

  useEffect(() => {
    const fetchAvailableHistory = async () => {
      const historySnapshot = await getDocs(collection(db, "history"));
      const yearsSet = new Set();
      const weeksSet = new Set();

      historySnapshot.forEach((doc) => {
        const { seasonYear, week, seasonType } = doc.data();
        if (seasonType === selectedSeasonType) {
          yearsSet.add(seasonYear);
          if (seasonYear === selectedYear) weeksSet.add(week);
        }
      });

      const years = Array.from(yearsSet).sort((a, b) => b - a);
      const weeks = Array.from(weeksSet).sort((a, b) => a - b);

      setAvailableYears(years);
      setAvailableWeeks(weeks);
    };

    if (selectedSeasonType && selectedYear !== null) {
      fetchAvailableHistory();
    }
  }, [selectedSeasonType, selectedYear]);

  useEffect(() => {
    const fetchHistoryData = async () => {
      setLoading(true);
      try {
        const docId = `${selectedYear}-${selectedSeasonType}-week${selectedWeek}`;
        const historyDoc = await getDoc(doc(db, "history", docId));
        if (historyDoc.exists()) {
          setHistory(historyDoc.data());
        } else {
          setHistory(null);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };

    if (selectedYear && selectedWeek && selectedSeasonType) {
      fetchHistoryData();
    }
  }, [selectedYear, selectedWeek, selectedSeasonType]);

  const formatSeasonType = (type) =>
    type === "Regular" ? "Regular Season" : "Postseason";

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
            {formatSeasonType(selectedSeasonType)} – Week {selectedWeek} Recap (
            {selectedYear})
          </h2>
          <Section title="🔥 Top Scorers" users={history.recap.topScorers} />
          <Section
            title="❄️ Lowest Scorers"
            users={history.recap.lowestScorers}
          />
          <Section
            title="📈 Biggest Risers"
            users={history.recap.biggestRisers}
          />
          <Section
            title="📉 Biggest Fallers"
            users={history.recap.biggestFallers}
          />
          <Section title="📊 All Scores" users={history.recap.scores} />

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
