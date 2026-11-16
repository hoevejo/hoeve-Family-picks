import Image from "next/image";

// Icon tint per section tone.
const TONES = {
  gold: "bg-[#f5b301]/15 text-gold-text",
  ice: "bg-sky-500/15 text-accent-text",
  up: "bg-success/15 text-success",
  down: "bg-danger/15 text-danger",
  accent: "bg-accent/15 text-accent-text",
};

// Rising/falling stats get the matching result color.
const STAT_TONES = { up: "text-success", down: "text-danger" };

/**
 * A titled card listing users with avatar and an optional stat. Shared by the
 * weekly Recap and History pages. `stat(user)` returns the text shown on the
 * right; without it, falls back to `user.score` when present.
 */
export default function RecapSection({
  title,
  users = [],
  icon: Icon = null,
  tone = "accent",
  stat = null,
  emptyText = "No data.",
}) {
  return (
    <div className="rounded-2xl bg-surface border border-line shadow-card p-4">
      <h2 className="flex items-center gap-2 mb-3 text-xl uppercase">
        {Icon && (
          <span
            className={`grid place-items-center h-8 w-8 rounded-lg text-base ${TONES[tone]}`}
          >
            <Icon />
          </span>
        )}
        {title}
      </h2>
      {users.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const value = stat
              ? stat(u)
              : u.score !== undefined
                ? `${u.score} pts`
                : null;

            return (
              <li key={u.uid} className="flex items-center gap-3">
                <Image
                  src={u.profilePicture || "/default-avatar.png"}
                  alt={u.fullName || u.uid}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="font-medium truncate">
                  {u.fullName || u.uid}
                </span>
                {value != null && (
                  <span
                    className={`ml-auto shrink-0 font-display text-lg font-bold tabular-nums ${STAT_TONES[tone] || ""}`}
                  >
                    {value}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
