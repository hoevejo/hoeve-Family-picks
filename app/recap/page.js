"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, getDocs, collection } from "firebase/firestore";
import { Toaster, toast } from "react-hot-toast";
import RecapSummary from "../../components/RecapSummary";
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

      <RecapSummary recap={recap} />
    </div>
  );
}
