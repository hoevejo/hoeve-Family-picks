"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
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

  // Fetch season type from config
  useEffect(() => {
    const fetchConfig = async () => {
      const configDoc = await getDoc(doc(db, "config", "config"));
      if (configDoc.exists()) {
        const config = configDoc.data();
        const type = config.seasonType;
        if (type === "Regular") setActiveTab("Regular Season");
        else if (type === "Postseason") setActiveTab("Postseason");
        else setActiveTab("All-Time"); // fallback or manually set for future use
      }
    };
    fetchConfig();
  }, []);

  // Fetch leaderboard based on active tab
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        let refPath = "leaderboard";
        if (activeTab === "Postseason") refPath = "leaderboardPostseason";
        if (activeTab === "All-Time") refPath = "leaderboardAllTime";

        const leaderboardRef = collection(db, refPath);
        const snapshot = await getDocs(leaderboardRef);
        const leaderboardData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const usersSnapshot = await getDocs(collection(db, "users"));
        const userMap = {};
        usersSnapshot.forEach((userDoc) => {
          const userData = userDoc.data();
          userMap[userData.uid] = userData;
        });

        const enrichedData = leaderboardData.map((entry) => ({
          ...entry,
          profilePicture:
            userMap[entry.uid]?.profilePicture || "/default-avatar.png",
          firstName: userMap[entry.uid]?.firstName || entry.uid,
        }));

        if (activeTab === "All-Time") {
          enrichedData.sort((a, b) => b.totalPoints - a.totalPoints);
        } else {
          enrichedData.sort((a, b) => {
            const rankA = a.currentRank === 0 ? Infinity : a.currentRank;
            const rankB = b.currentRank === 0 ? Infinity : b.currentRank;
            return rankA - rankB;
          });
        }

        setLeaderboard(enrichedData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [activeTab]);

  // Show notification popup after login (Option B: Delay)
  useEffect(() => {
    if (user && user.notificationsEnabled !== true) {
      const timer = setTimeout(() => setShowPopup(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const getRankDisplay = (index, entry) => {
    if (activeTab === "All-Time") return index + 1;
    return entry.currentRank || index + 1;
  };

  if (loading)
    return (
      <p className="text-center mt-10 text-[var(--text-color)]">
        Loading leaderboard...
      </p>
    );

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
                Points
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

              return (
                <tr
                  key={entry.id}
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
                    <div className="flex items-center gap-1">
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
                        entry.positionChange > 0
                          ? "text-green-500"
                          : entry.positionChange < 0
                          ? "text-red-500"
                          : "text-gray-500"
                      }`}
                    >
                      {entry.positionChange > 0 && "▲ "}
                      {entry.positionChange < 0 && "▼ "}
                      {entry.positionChange === 0 && "—"}
                      {entry.positionChange !== 0 &&
                        Math.abs(entry.positionChange)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 📣 Push Notification Prompt */}
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
