"use client";

import Image from "next/image";
import { FaStar } from "react-icons/fa";

/**
 * Per-game breakdown of who picked what and whether they were right --
 * shared by /week's post-deadline locked view and /history, so the two
 * can't visually drift apart.
 */
export default function WeeklyResultsView({
  games,
  picks,
  gameOfTheWeekId = null,
  currentUserId = null,
}) {
  return (
    <div className="space-y-4">
      {games.map((game) => (
        <details
          key={game.id}
          className="bg-[var(--card-color)] rounded-sm shadow-md"
        >
          <summary className="px-4 py-3 font-semibold cursor-pointer flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {String(game.id) === String(gameOfTheWeekId) && (
                <FaStar className="text-yellow-500" />
              )}

              <Image
                src={game.homeTeam.logo}
                alt={game.homeTeam.name}
                width={20}
                height={20}
              />
              <span
                className={
                  game.winnerId
                    ? String(game.winnerId) === String(game.homeTeam.id)
                      ? "text-green-600"
                      : "text-red-600"
                    : ""
                }
              >
                {game.homeTeam.abbreviation}
              </span>

              <span className="mx-1">vs</span>

              <Image
                src={game.awayTeam.logo}
                alt={game.awayTeam.name}
                width={20}
                height={20}
              />
              <span
                className={
                  game.winnerId
                    ? String(game.winnerId) === String(game.awayTeam.id)
                      ? "text-green-600"
                      : "text-red-600"
                    : ""
                }
              >
                {game.awayTeam.abbreviation}
              </span>
            </div>
          </summary>

          <div className="p-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[game.homeTeam, game.awayTeam].map((team) => {
              const usersForTeam = picks
                .filter(
                  (entry) =>
                    String(entry.predictions?.[String(game.id)]?.teamId) ===
                    String(team.id),
                )
                .sort((a, b) =>
                  (a.fullName || a.userId).localeCompare(
                    b.fullName || b.userId,
                  ),
                );

              const teamColor =
                game.winnerId == null
                  ? ""
                  : String(game.winnerId) === String(team.id)
                    ? "text-green-600"
                    : "text-red-600";

              return (
                <div key={team.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <Image
                      src={team.logo}
                      alt={team.name}
                      width={24}
                      height={24}
                    />
                    <span className={`font-semibold ${teamColor}`}>
                      {team.name}
                    </span>
                  </div>

                  <ul className="ml-6 list-disc text-sm text-[var(--text-color)]">
                    {usersForTeam.map((entry) => {
                      const pred = entry.predictions?.[String(game.id)];
                      const isCorrect = pred?.isCorrect;
                      const userColor =
                        isCorrect === true
                          ? "text-green-600"
                          : isCorrect === false
                            ? "text-red-600"
                            : "";

                      return (
                        <li key={entry.userId} className={userColor}>
                          {entry.userId === currentUserId
                            ? "You"
                            : entry.fullName || entry.userId}
                          {String(game.id) === String(gameOfTheWeekId) &&
                            String(entry.wager?.teamId) === String(team.id) &&
                            Number(entry.wager?.points) > 0 && (
                              <span className="text-yellow-600">
                                {" "}
                                ({entry.wager.points} pts)
                              </span>
                            )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
