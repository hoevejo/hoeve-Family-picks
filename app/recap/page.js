"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, getDocs, collection } from "firebase/firestore";
import Image from "next/image";
import { Toaster, toast } from "react-hot-toast";
import RecapSection from "../../components/RecapSection";
import { weekKey, seasonTypeLabel } from "../../lib/seasonType";
import {
  FaArrowDown,
  FaArrowUp,
  FaChartBar,
  FaFire,
  FaSnowflake,
} from "react-icons/fa";

export default function WeeklyRecapPage() {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recapWeek, setRecapWeek] = useState(null);

  useEffect(() => {
    const fetchRecap = async () => {
      try {
        const configSnap = await getDoc(doc(db, "config", "config"));
        if (!configSnap.exists()) {
          setLoading(false);
          return;
        }

        const cfg = configSnap.data() || {};
        const { seasonYear } = cfg;
        const rw = Number(cfg.recapWeek ?? 0);
        setRecapWeek(rw);
        if (rw === 0) {
          setLoading(false);
          return;
        }

        // weeklyRecap is retired -- history/{weekKey}.recap has the same data.
        const rawType = (
          cfg.recapSeasonType ||
          cfg.seasonTypeSlug ||
          cfg.seasonType ||
          ""
        ).toString();
        const recapId = weekKey({ seasonYear, seasonType: rawType, week: rw });
        let historyDoc = await getDoc(doc(db, "history", recapId));

        // Fallbacks in case old jobs wrote different casing
        if (!historyDoc.exists()) {
          const legacyIdExact = `${seasonYear}-${rawType}-week${rw}`;
          const legacyIdLower = `${seasonYear}-${rawType.toLowerCase()}-week${rw}`;
          historyDoc = await getDoc(doc(db, "history", legacyIdExact));
          if (!historyDoc.exists()) {
            historyDoc = await getDoc(doc(db, "history", legacyIdLower));
          }
        }

        if (!historyDoc.exists()) {
          setLoading(false);
          toast.error("No recap data found for the configured week.");
          return;
        }

        const historyData = historyDoc.data();
        const recapData = {
          week: historyData.week,
          seasonType: historyData.seasonType,
          ...historyData.recap,
        };

        // publicProfiles, not users -- avoids scanning private fields.
        const usersSnap = await getDocs(collection(db, "publicProfiles"));
        const userMap = {};
        usersSnap.forEach((u) => {
          const ud = u.data();
          if (ud?.uid) userMap[ud.uid] = ud;
        });

        const mapWithUserData = (entries = []) =>
          entries.map((entry) => {
            const u = userMap[entry.uid] || {};
            return {
              ...entry,
              fullName:
                entry.fullName ||
                u.fullName ||
                [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                entry.uid,
              profilePicture:
                u.profilePicture ||
                entry.profilePicture ||
                "/default-avatar.png",
            };
          });

        setRecap({
          ...recapData,
          topScorers: mapWithUserData(recapData.topScorers),
          lowestScorers: mapWithUserData(recapData.lowestScorers),
          biggestRisers: mapWithUserData(recapData.biggestRisers),
          biggestFallers: mapWithUserData(recapData.biggestFallers),
          scores: mapWithUserData(recapData.scores),
        });
      } catch (err) {
        console.error("Error fetching recap:", err);
        toast.error("Error fetching recap data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecap();
  }, []);

  const avgScore = useMemo(() => {
    if (!recap?.scores?.length) return 0;
    const total = recap.scores.reduce(
      (sum, u) => sum + (Number(u.score) || 0),
      0,
    );
    return (total / recap.scores.length).toFixed(2);
  }, [recap]);

  const sortedScores = useMemo(
    () =>
      [...(recap?.scores || [])].sort(
        (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0),
      ),
    [recap],
  );
  const highScore = Number(sortedScores[0]?.score) || 0;

  if (loading) {
    return (
      <div
        className="max-w-3xl mx-auto py-6 space-y-3"
        aria-label="Loading recap"
      >
        <Toaster position="top-center" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-surface border border-line animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (recapWeek === 0 || !recap) {
    return (
      <div className="max-w-3xl mx-auto py-6">
        <Toaster position="top-center" />
        <div className="rounded-2xl bg-surface border border-line shadow-card p-8 text-center">
          <p className="font-semibold">
            {recapWeek === 0 ? "No weekly recap yet" : "No recap data found."}
          </p>
          {recapWeek === 0 && (
            <p className="text-sm text-muted mt-1">
              Come back next week for results!
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5">
      <Toaster position="top-center" />
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-accent-text">
          {seasonTypeLabel(recap.seasonType)}
        </p>
        <h1 className="text-4xl uppercase italic leading-none">
          Week {recap.week} Recap
        </h1>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-3 rounded-2xl bg-accent-gradient text-white shadow-card divide-x divide-white/20">
        {[
          ["High", recap.highestScore ?? highScore],
          ["Average", avgScore],
          ["Players", recap.scores?.length || 0],
        ].map(([label, value]) => (
          <div key={label} className="py-4 text-center">
            <div className="font-display text-4xl font-extrabold tabular-nums leading-none">
              {value}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <RecapSection
          title="Top Scorers"
          icon={FaFire}
          tone="gold"
          users={recap.topScorers}
          stat={(u) => `${u.lastWeekPoints ?? 0} pts`}
        />
        <RecapSection
          title="Lowest Scorers"
          icon={FaSnowflake}
          tone="ice"
          users={recap.lowestScorers}
          stat={(u) => `${u.lastWeekPoints ?? 0} pts`}
        />
        <RecapSection
          title="Biggest Risers"
          icon={FaArrowUp}
          tone="up"
          users={recap.biggestRisers}
          stat={(u) => formatMove(u.positionChange)}
        />
        <RecapSection
          title="Biggest Fallers"
          icon={FaArrowDown}
          tone="down"
          users={recap.biggestFallers}
          stat={(u) => formatMove(u.positionChange)}
        />
      </div>

      <div className="rounded-2xl bg-surface border border-line shadow-card p-4">
        <h2 className="flex items-center gap-2 mb-3 text-xl uppercase">
          <span className="grid place-items-center h-8 w-8 rounded-lg text-base bg-accent/15 text-accent-text">
            <FaChartBar />
          </span>
          All Scores
        </h2>
        {sortedScores.length ? (
          <ol className="space-y-2.5">
            {sortedScores.map((u, i) => {
              const score = Number(u.score) || 0;
              return (
                <li key={u.uid} className="flex items-center gap-3">
                  <span className="w-5 text-center font-display font-bold text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <Image
                    src={u.profilePicture || "/default-avatar.png"}
                    alt={u.fullName || u.uid}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">
                        {u.fullName || u.uid}
                      </span>
                      <span className="font-display text-lg font-bold tabular-nums">
                        {u.score} pts
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-gradient"
                        style={{
                          width: `${highScore > 0 ? (score / highScore) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted">No scores recorded.</p>
        )}
      </div>
    </div>
  );
}

function formatMove(change = 0) {
  if (change > 0) return `▲${change}`;
  if (change < 0) return `▼${Math.abs(change)}`;
  return "—";
}
