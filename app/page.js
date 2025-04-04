"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";

export default function Leaderboard() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const leaderboardRef = collection(db, "leaderboard");
        const snapshot = await getDocs(leaderboardRef);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        data.sort((a, b) => b.totalPoints - a.totalPoints);
        setLeaderboard(data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading)
    return (
      <p className="text-center mt-10 text-[var(--text-color)]">
        Loading leaderboard...
      </p>
    );

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <h1 className="text-2xl font-bold mb-6">
        🏆 NFL Pick&apos;em Leaderboard
      </h1>

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
              <th className="px-2 py-3 text-center w-5 border-x border-[var(--border-color)]">
                Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = user?.uid === entry.uid;

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
                    {index + 1}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap border-l border-[var(--border-color)]">
                    <div className="flex items-center gap-1">
                      <Image
                        src={entry.profilePicture || "/default-avatar.png"}
                        alt={entry.firstName}
                        width={24}
                        height={24}
                        className="rounded-full object-cover"
                      />
                      <span className="font-medium">{entry.firstName}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right font-semibold border-r border-[var(--border-color)]">
                    {entry.totalPoints}
                  </td>

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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
