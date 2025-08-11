"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/firebaseConfig";
import { getDoc, doc, getDocs, collection } from "firebase/firestore";
import Image from "next/image";
import { Toaster, toast } from "react-hot-toast";

export default function WeeklyRecapPage() {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recapWeek, setRecapWeek] = useState(null);

  useEffect(() => {
    const fetchRecap = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "config"));
        if (!configDoc.exists()) return;

        const { recapWeek, seasonType, seasonYear } = configDoc.data();
        setRecapWeek(recapWeek);

        if (recapWeek === 0) return;

        const recapDoc = await getDoc(
          doc(db, "weeklyRecap", `${seasonYear}-${seasonType}-week${recapWeek}`)
        );

        if (recapDoc.exists()) {
          const recapData = recapDoc.data();

          const uids = new Set();
          [
            ...recapData.topScorers,
            ...recapData.lowestScorers,
            ...recapData.biggestRisers,
            ...recapData.biggestFallers,
            ...recapData.scores,
          ].forEach((entry) => uids.add(entry.uid));

          const usersSnapshot = await getDocs(collection(db, "users"));
          const userMap = {};
          usersSnapshot.forEach((userDoc) => {
            const user = userDoc.data();
            userMap[user.uid] = user;
          });

          const mapWithUserData = (entries) =>
            entries.map((entry) => ({
              ...entry,
              fullName: userMap[entry.uid]?.fullName || entry.uid,
              profilePicture:
                userMap[entry.uid]?.profilePicture || "/default-avatar.png",
            }));

          setRecap({
            ...recapData,
            topScorers: mapWithUserData(recapData.topScorers),
            lowestScorers: mapWithUserData(recapData.lowestScorers),
            biggestRisers: mapWithUserData(recapData.biggestRisers),
            biggestFallers: mapWithUserData(recapData.biggestFallers),
            scores: mapWithUserData(recapData.scores),
          });
        }
      } catch (err) {
        toast.error("Error fetching recap data. Please try again later.");
        console.error("Error fetching recap:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecap();
  }, []);

  const formatSeasonType = (type) =>
    type === "Regular" ? "Regular Season" : "Postseason";

  const avgScore = useMemo(() => {
    if (!recap?.scores) return 0;
    return (
      (recap.scores.reduce((sum, u) => sum + (u.score || 0), 0) || 0) /
      (recap.scores?.length || 1)
    ).toFixed(2);
  }, [recap]);

  const Section = ({ title, users }) => (
    <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 mb-4 shadow">
      <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
        {title}
      </h2>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.uid} className="flex items-center gap-3">
            <Image
              src={u.profilePicture}
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

  if (loading)
    return (
      <p className="text-center mt-6 text-[var(--text-color)]">
        Loading recap...
      </p>
    );

  if (recapWeek === 0)
    return (
      <p className="text-center mt-6 text-[var(--text-color)]">
        No weekly recap yet — come back next week for results!
      </p>
    );

  if (!recap)
    return (
      <p className="text-center mt-6 text-red-500">No recap data found.</p>
    );

  return (
    <div className="min-h-screen px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <h1 className="text-3xl font-bold text-center mb-6">
        📝 Week {recap.week} Recap ({formatSeasonType(recap.seasonType)})
      </h1>

      <div className="max-w-3xl mx-auto space-y-6">
        <Section title="🔥 Top Scorers" users={recap.topScorers} />
        <Section title="❄️ Lowest Scorers" users={recap.lowestScorers} />
        <Section title="📈 Biggest Risers" users={recap.biggestRisers} />
        <Section title="📉 Biggest Fallers" users={recap.biggestFallers} />

        <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 shadow">
          <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
            📊 All Scores
          </h2>
          <ul className="space-y-2">
            {recap.scores?.map((u) => (
              <li key={u.uid} className="flex items-center gap-3">
                <Image
                  src={u.profilePicture}
                  alt={u.fullName}
                  width={32}
                  height={32}
                  className="rounded-full border border-[var(--border-color)]"
                />
                <span className="text-[var(--text-color)] font-medium">
                  {u.fullName}
                </span>
                <span className="ml-auto text-[var(--text-color)] font-semibold">
                  {u.score} pts
                </span>
              </li>
            ))}
          </ul>
          <p className="text-center text-sm text-[var(--text-color)] mt-4">
            {recap.scores?.length || 0} participants — Avg Score: {avgScore}
          </p>
        </div>
      </div>
    </div>
  );
}
