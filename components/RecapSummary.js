import Image from "next/image";
import {
  FaArrowDown,
  FaArrowUp,
  FaChartBar,
  FaFire,
  FaSnowflake,
} from "react-icons/fa";
import RecapSection from "./RecapSection";

/**
 * Headline numbers, award cards, and the full score list for one graded
 * week. Shared by /recap and /history so the two stay identical. `recap` is
 * history/{weekKey}.recap with users already joined to publicProfiles.
 */
export default function RecapSummary({ recap }) {
  const scores = [...(recap?.scores || [])].sort(
    (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0),
  );
  const highScore = Number(scores[0]?.score) || 0;
  const avgScore = scores.length
    ? (
        scores.reduce((sum, u) => sum + (Number(u.score) || 0), 0) /
        scores.length
      ).toFixed(2)
    : 0;

  return (
    <>
      {/* Headline numbers */}
      <div className="grid grid-cols-3 rounded-2xl bg-accent-gradient text-white shadow-card divide-x divide-white/20">
        {[
          ["High", recap?.highestScore ?? highScore],
          ["Average", avgScore],
          ["Players", scores.length],
        ].map(([label, value]) => (
          <div key={label} className="py-4 text-center">
            <div className="font-display text-4xl font-extrabold tabular-nums leading-none">
              {value}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <RecapSection
          title="Top Scorers"
          icon={FaFire}
          tone="gold"
          users={recap?.topScorers}
          stat={(u) => `${u.lastWeekPoints ?? 0} pts`}
        />
        <RecapSection
          title="Lowest Scorers"
          icon={FaSnowflake}
          tone="ice"
          users={recap?.lowestScorers}
          stat={(u) => `${u.lastWeekPoints ?? 0} pts`}
        />
        <RecapSection
          title="Biggest Risers"
          icon={FaArrowUp}
          tone="up"
          // The job lists everyone tied for the biggest change, which is
          // everyone when nobody moved -- only show actual movers.
          users={(recap?.biggestRisers || []).filter(
            (u) => u.positionChange > 0,
          )}
          emptyText="No movement this week."
          stat={(u) => formatMove(u.positionChange)}
        />
        <RecapSection
          title="Biggest Fallers"
          icon={FaArrowDown}
          tone="down"
          users={(recap?.biggestFallers || []).filter(
            (u) => u.positionChange < 0,
          )}
          emptyText="No movement this week."
          stat={(u) => formatMove(u.positionChange)}
        />
      </div>

      <div className="rounded-2xl bg-surface border border-line shadow-card p-4">
        <h2 className="flex items-center gap-2 mb-3 text-xl uppercase">
          <span className="grid place-items-center h-8 w-8 rounded-lg text-base bg-accent/15 text-accent-text">
            <FaChartBar />
          </span>
          All Scores
        </h2>
        {scores.length ? (
          <ol className="space-y-2.5">
            {scores.map((u, i) => {
              const score = Number(u.score) || 0;
              return (
                <li key={u.uid} className="flex items-center gap-3">
                  <span className="w-5 text-center font-display font-bold text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <Image
                    src={u.profilePicture || "/default-avatar.png"}
                    alt={u.fullName || u.uid}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">
                        {u.fullName || u.uid}
                      </span>
                      <span className="font-display text-lg font-bold tabular-nums">
                        {u.score} pts
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-gradient"
                        style={{
                          width: `${highScore > 0 ? (score / highScore) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted">No scores recorded.</p>
        )}
      </div>
    </>
  );
}

function formatMove(change = 0) {
  if (change > 0) return `▲${change}`;
  if (change < 0) return `▼${Math.abs(change)}`;
  return "—";
}
