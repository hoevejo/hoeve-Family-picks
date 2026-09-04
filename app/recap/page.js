"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, getDocs, collection } from "firebase/firestore";
import Image from "next/image";
import { Toaster, toast } from "react-hot-toast";
import RecapSection from "../../components/RecapSection";
import { weekKey, seasonTypeLabel } from "../../lib/seasonType";

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

        // weeklyRecap is retired -- history/{weekKey}.recap has the same
        // data (history is a strict superset: it also carries leaderboard
        // and picks). Legacy-cased ID fallback stays for now (removed once
        // the migration script has run and no legacy-cased history docs
        // remain -- see the schema-cleanup plan).
        const rawType = (cfg.seasonTypeSlug || cfg.seasonType || "").toString();
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

        // Build user map for names/avatars -- publicProfiles, not users,
        // which carries private fields that have no business being broadly
        // scanned here.
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

  if (loading) {
    return (
      <>
        <Toaster position="top-center" />
        <p className="text-center mt-6 text-[var(--text-color)]">
          Loading recap...
        </p>
      </>
    );
  }

  if (recapWeek === 0) {
    return (
      <>
        <Toaster position="top-center" />
        <p className="text-center mt-6 text-[var(--text-color)]">
          No weekly recap yet — come back next week for results!
        </p>
      </>
    );
  }

  if (!recap) {
    return (
      <>
        <Toaster position="top-center" />
        <p className="text-center mt-6 text-red-500">No recap data found.</p>
      </>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <Toaster position="top-center" />
      <h1 className="text-3xl font-bold text-center mb-6">
        📝 Week {recap.week} Recap ({seasonTypeLabel(recap.seasonType)})
      </h1>

      <div className="max-w-3xl mx-auto space-y-6">
        <RecapSection title="🔥 Top Scorers" users={recap.topScorers} />
        <RecapSection title="❄️ Lowest Scorers" users={recap.lowestScorers} />
        <RecapSection title="📈 Biggest Risers" users={recap.biggestRisers} />
        <RecapSection title="📉 Biggest Fallers" users={recap.biggestFallers} />

        <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
          <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
            📊 All Scores
          </h2>
          {recap.scores?.length ? (
            <>
              <ul className="space-y-2">
                {recap.scores.map((u) => (
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
                {recap.scores.length} participants — Avg Score: {avgScore}
              </p>
            </>
          ) : (
            <p className="opacity-70">No scores recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}
