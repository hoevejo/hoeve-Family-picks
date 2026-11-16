"use client";

import { FaChevronDown, FaStar } from "react-icons/fa";
import TeamLogo from "./TeamLogo";

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
    <div className="space-y-3">
      {games.map((game) => {
        const isGotw = String(game.id) === String(gameOfTheWeekId);

        return (
          <details
            key={game.id}
            className={`group rounded-2xl bg-surface shadow-card overflow-hidden ${
              isGotw ? "border-2 border-[#f5b301]/70" : "border border-line"
            }`}
          >
            <summary className="list-none [&::-webkit-details-marker]:hidden px-4 py-3 cursor-pointer flex items-center justify-between gap-2 hover:bg-surface-2/60 transition-colors">
              <div className="flex items-center gap-2">
                {isGotw && <FaStar className="text-[#f5b301]" />}
                <TeamAbbr team={game.homeTeam} winnerId={game.winnerId} />
                <span className="mx-1 font-display text-sm font-bold italic text-muted">
                  VS
                </span>
                <TeamAbbr team={game.awayTeam} winnerId={game.winnerId} />
              </div>
              <FaChevronDown className="text-muted text-sm transition-transform group-open:rotate-180" />
            </summary>

            <div className="p-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                      ? "text-success"
                      : "text-danger";

                return (
                  <div key={team.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <TeamLogo team={team} size={22} />
                      <span className={`font-semibold ${teamColor}`}>
                        {team.name}
                      </span>
                      <span className="ml-auto text-xs font-semibold text-muted tabular-nums">
                        {usersForTeam.length}{" "}
                        {usersForTeam.length === 1 ? "pick" : "picks"}
                      </span>
                    </div>

                    <ul className="flex flex-col gap-1">
                      {usersForTeam.map((entry) => {
                        const pred = entry.predictions?.[String(game.id)];
                        const isCorrect = pred?.isCorrect;
                        const isYou = entry.userId === currentUserId;
                        const userColor =
                          isCorrect === true
                            ? "bg-success/15 text-success"
                            : isCorrect === false
                              ? "bg-danger/15 text-danger"
                              : "bg-surface-2 text-fg";

                        return (
                          <li
                            key={entry.userId}
                            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${userColor} ${
                              isYou ? "ring-2 ring-inset ring-accent" : ""
                            }`}
                          >
                            {isYou ? "You" : entry.fullName || entry.userId}
                            {isGotw &&
                              String(entry.wager?.teamId) === String(team.id) &&
                              Number(entry.wager?.points) > 0 && (
                                <span className="font-bold text-gold-text tabular-nums">
                                  {entry.wager.points} pts
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
        );
      })}
    </div>
  );
}

function TeamAbbr({ team, winnerId }) {
  const color = winnerId
    ? String(winnerId) === String(team.id)
      ? "text-success"
      : "text-danger"
    : "";

  return (
    <span className="flex items-center gap-1.5">
      <TeamLogo team={team} size={22} />
      <span className={`font-display text-lg font-bold ${color}`}>
        {team.abbreviation}
      </span>
    </span>
  );
}
