"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebaseConfig";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import EnableNotificationsPopup from "@/components/EnableNotificationsPopup";
import { subscribeToPushNotifications } from "@/lib/pushUtils";

export default function Leaderboard() {
  const { user } = useAuth();

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Regular Season");
  const [showPopup, setShowPopup] = useState(false);

  const tabs = useMemo(() => ["Regular Season", "Postseason", "All-Time"], []);

  // Pick default tab from config.seasonType ("Regular", "regular", etc.)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "config"));
        if (!snap.exists()) return;
        const type = String((snap.data() || {}).seasonType || "").toLowerCase();
        if (type.startsWith("post")) setActiveTab("Postseason");
        else if (type.startsWith("reg")) setActiveTab("Regular Season");
        else setActiveTab("All-Time");
      } catch (e) {
        console.warn("Failed to load config:", e);
      }
    };
    fetchConfig();
  }, []);

  const collectionName = useMemo(() => {
    if (activeTab === "Postseason") return "leaderboardPostseason";
    if (activeTab === "All-Time") return "leaderboardAllTime";
    return "leaderboard";
  }, [activeTab]);

  // Realtime leaderboard; ignore cache-only first emission to avoid stale data
  useEffect(() => {
    setLoading(true);

    const collRef = collection(db, collectionName);

    const unsub = onSnapshot(
      collRef,
      { includeMetadataChanges: true },
      async (snap) => {
        // If this is a cache-only snapshot (no pending writes), wait for server data
        if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;

        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Always fetch users fresh (server) so names/avatars update immediately
        let usersSnap;
        try {
          usersSnap = await getDocsFromServer(collection(db, "users"));
        } catch {
          usersSnap = await getDocs(collection(db, "users")); // fallback
        }

        const userMap = {};
        usersSnap.forEach((u) => {
          const ud = u.data();
          if (ud?.uid) userMap[ud.uid] = ud;
        });

        const rows = raw.map((e) => {
          const u = userMap[e.uid] || {};
          return {
            ...e,
            uid: e.uid,
            profilePicture: u.profilePicture || "/default-avatar.png",
            firstName: u.firstName || u.fullName || e.uid || "Unknown",
            totalPoints: Number(e.totalPoints || 0),
            currentRank:
              typeof e.currentRank === "number" && e.currentRank > 0
                ? e.currentRank
                : null,
            positionChange: Number(e.positionChange || 0),
          };
        });

        // Sort
        let sorted;
        if (activeTab === "All-Time") {
          sorted = [...rows].sort((a, b) => b.totalPoints - a.totalPoints);
        } else {
          sorted = [...rows].sort((a, b) => {
            const ra = a.currentRank ?? Infinity;
            const rb = b.currentRank ?? Infinity;
            if (ra !== rb) return ra - rb;
            // tie-breaker: higher total first
            return b.totalPoints - a.totalPoints;
          });
        }

        setLeaderboard(sorted);
        setLoading(false);
      },
      (err) => {
        console.error("Leaderboard onSnapshot error:", err);
        setLeaderboard([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [collectionName, activeTab]);

  // Optional: show notifications prompt after login
  useEffect(() => {
    if (user && user.notificationsEnabled !== true) {
      const t = setTimeout(() => setShowPopup(true), 5000);
      return () => clearTimeout(t);
    }
  }, [user]);

  const getRankDisplay = (index, entry) => {
    if (activeTab === "All-Time") return index + 1;
    return entry.currentRank || index + 1;
  };

  if (loading) {
    return (
      <p className="text-center mt-10 text-[var(--text-color)]">
        Loading leaderboard...
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <h1 className="text-2xl font-bold mb-4">
        🏆 NFL Pick&apos;em Leaderboard
      </h1>

      <div className="flex gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full font-medium transition border text-sm sm:text-base ${
              activeTab === tab
                ? "bg-[var(--accent-color)] text-white border-transparent"
                : "bg-transparent border-[var(--border-color)] text-[var(--text-color)] hover:bg-[var(--accent-color)/10]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="w-full max-w-6xl bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl shadow-md overflow-x-auto">
        <table className="w-full text-sm sm:text-base table-auto border-collapse">
          <thead className="bg-[var(--accent-color)] text-white">
            <tr>
              <th className="px-4 py-3 text-center w-16 border-x border-[var(--border-color)]">
                Rank
              </th>
              <th className="px-4 py-3 text-left border-l border-[var(--border-color)]">
                Player
              </th>
              <th className="px-4 py-3 text-right w-24 border-r border-[var(--border-color)]">
                Total Points
              </th>
              {activeTab !== "All-Time" && (
                <th className="px-2 py-3 text-center w-5 border-x border-[var(--border-color)]">
                  Change
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = user?.uid === entry.uid;
              const rank = getRankDisplay(index, entry);
              const change = entry.positionChange || 0;

              return (
                <tr
                  key={entry.uid || entry.id || index}
                  className={`transition ${
                    isCurrentUser
                      ? "bg-[var(--accent-color)/10] font-semibold"
                      : "hover:bg-[var(--accent-color)/5]"
                  }`}
                >
                  <td className="px-4 py-3 text-center font-bold border-x border-[var(--border-color)]">
                    {rank}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap border-l border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                      <Image
                        src={entry.profilePicture}
                        alt={entry.firstName}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                      <span className="font-medium">{entry.firstName}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right font-semibold border-r border-[var(--border-color)]">
                    {entry.totalPoints}
                  </td>

                  {activeTab !== "All-Time" && (
                    <td
                      className={`px-2 py-3 text-center font-medium border-x border-[var(--border-color)] ${
                        change > 0
                          ? "text-green-500"
                          : change < 0
                          ? "text-red-500"
                          : "text-gray-500"
                      }`}
                    >
                      {change > 0 && "▲ "}
                      {change < 0 && "▼ "}
                      {change === 0 && "—"}
                      {change !== 0 && Math.abs(change)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPopup && user && (
        <EnableNotificationsPopup
          onConfirm={async () => {
            await subscribeToPushNotifications(user);
            setShowPopup(false);
          }}
          onDismiss={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}
