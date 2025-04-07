// /components/GamePredictionView.js

"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";
import Image from "next/image";

export default function GamePredictionView({
  games,
  seasonYear,
  seasonType,
  week,
}) {
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    const fetchPicks = async () => {
      const q = query(
        collection(db, "picks"),
        where("seasonYear", "==", seasonYear),
        where("seasonType", "==", seasonType),
        where("week", "==", week)
      );
      const snapshot = await getDocs(q);
      const allPicks = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setPicks(allPicks);
    };

    if (seasonYear && seasonType && week) fetchPicks();
  }, [seasonYear, seasonType, week]);

  const getPickers = (gameId, teamId) => {
    return picks.filter((p) => p.predictions?.[gameId] === teamId);
  };

  const isWinningTeam = (game, teamId) => {
    if (game.winnerId && game.winnerId === teamId) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      {games.map((game) => (
        <details
          key={game.gameId}
          className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-lg p-4 shadow"
        >
          <summary className="cursor-pointer font-semibold flex justify-between items-center">
            <div className="flex items-center gap-4">
              {[game.homeTeam, game.awayTeam].map((team) => (
                <div
                  key={team.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded-md border border-[var(--border-color)]
                    ${
                      isWinningTeam(game, team.id)
                        ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300"
                        : ""
                    }`}
                >
                  <Image
                    src={team.logo}
                    alt={team.name}
                    width={24}
                    height={24}
                  />
                  <span>{team.name}</span>
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Click to view picks
            </span>
          </summary>

          <div className="mt-4 flex justify-around">
            {[game.homeTeam, game.awayTeam].map((team) => (
              <div key={team.id} className="w-1/2">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Image
                    src={team.logo}
                    alt={team.name}
                    width={32}
                    height={32}
                  />
                  <h4 className="font-bold text-center">{team.name}</h4>
                </div>
                <ul className="space-y-1 text-center">
                  {getPickers(game.gameId, team.id).map((p) => (
                    <li key={p.id} className="text-[var(--text-color)]">
                      {p.fullName || p.displayName || "Unknown"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
