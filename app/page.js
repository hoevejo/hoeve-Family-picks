"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Fetch all users from the `leaderboard` collection
        const leaderboardRef = collection(db, "leaderboard");
        const snapshot = await getDocs(leaderboardRef);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort leaderboard by total points (highest to lowest)
        data.sort((a, b) => b.totalPoints - a.totalPoints);

        setLeaderboard(data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      }

      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

  if (loading)
    return <p className="text-center mt-10">Loading leaderboard...</p>;

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">🏆 NFL Pick'em Leaderboard</h1>

      <div className="w-full max-w-4xl bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">First Name</th>
              <th className="p-3">Total Points</th>
              <th className="p-3">Last Week's Points</th>
              <th className="p-3">Change</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, index) => (
              <tr key={user.id} className="border-b">
                <td className="p-3 text-center font-semibold">{index + 1}</td>
                <td className="p-3">{user.firstName}</td>
                <td className="p-3 text-center">{user.totalPoints}</td>
                <td className="p-3 text-center">{user.lastWeekPoints}</td>
                <td
                  className={`p-3 text-center flex items-center justify-center ${
                    user.positionChange > 0
                      ? "text-green-500"
                      : user.positionChange < 0
                      ? "text-red-500"
                      : "text-gray-500"
                  }`}
                >
                  {user.positionChange > 0 && (
                    <span className="mr-1">▲</span> // Green Up Triangle
                  )}
                  {user.positionChange < 0 && (
                    <span className="mr-1">▼</span> // Red Down Triangle
                  )}
                  {user.positionChange} {/* Show number after triangle */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
