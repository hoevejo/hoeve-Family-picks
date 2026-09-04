import Image from "next/image";

/**
 * A titled card listing users with avatar and optional score. Shared by the
 * weekly Recap and History pages.
 */
export default function RecapSection({ title, users = [] }) {
  return (
    <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-4 mb-4 shadow-sm">
      <h2 className="text-xl font-bold mb-3 text-[var(--text-color)]">
        {title}
      </h2>
      {users.length === 0 ? (
        <p className="opacity-70">No data.</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.uid} className="flex items-center gap-3">
              <Image
                src={u.profilePicture || "/default-avatar.png"}
                alt={u.fullName || u.uid}
                width={32}
                height={32}
                className="rounded-full border border-[var(--border-color)]"
              />
              <span className="text-[var(--text-color)] font-medium">
                {u.fullName || u.uid}
              </span>
              {u.score !== undefined && (
                <span className="ml-auto text-[var(--text-color)] font-semibold">
                  {u.score} pts
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
