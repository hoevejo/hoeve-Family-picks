"use client";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  SEASON_TYPES,
  normalizeSeasonType,
  seasonTypeLabel,
} from "@/lib/seasonType";
import { FaBell, FaBroom, FaSignOutAlt, FaStar } from "react-icons/fa";

// datetime-local shows/parses local time, not UTC -- shift by the local
// offset first or the deadline silently drifts by the UTC offset on save.
function toLocalDatetimeInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState({
    week: "",
    seasonYear: new Date().getFullYear(),
    seasonType: SEASON_TYPES.REGULAR,
    deadline: "",
    recapWeek: "",
    gameOfTheWeekId: "",
    wagerMaxPoints: 5,
  });

  const [gamesForWeek, setGamesForWeek] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  // Fetch current config
  useEffect(() => {
    const fetchConfig = async () => {
      if (loading || !isAdmin) return;

      try {
        const configRef = doc(db, "config", "config");
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const data = configSnap.data();

          setConfig((prev) => ({
            ...prev,
            week: data.week || "",
            seasonYear: data.seasonYear || new Date().getFullYear(),
            seasonType: normalizeSeasonType(data.seasonType),
            deadline: data.deadline?.toDate
              ? toLocalDatetimeInputValue(data.deadline.toDate())
              : data.deadline?.seconds
                ? toLocalDatetimeInputValue(
                    new Date(data.deadline.seconds * 1000),
                  )
                : "",
            recapWeek: data.recapWeek ?? "",
            gameOfTheWeekId: data.gameOfTheWeekId
              ? String(data.gameOfTheWeekId)
              : "",
            // Default to 5 -- blank/zero would mean "unlimited" again.
            wagerMaxPoints:
              data.wagerMaxPoints != null ? String(data.wagerMaxPoints) : 5,
          }));
        } else {
          console.error("Config document not found.");
        }
      } catch (err) {
        console.error("Error fetching config:", err);
        setError("Failed to fetch settings.");
      } finally {
        setFetching(false);
      }
    };

    fetchConfig();
  }, [isAdmin, loading]);

  // Load games for the selected week/year/type
  useEffect(() => {
    const loadGames = async () => {
      try {
        if (!config.week || !config.seasonYear || !config.seasonType) {
          setGamesForWeek([]);
          return;
        }
        const qRef = query(
          collection(db, "games"),
          where("seasonYear", "==", Number(config.seasonYear)),
          where("seasonType", "==", String(config.seasonType)),
          where("week", "==", Number(config.week)),
        );
        const snap = await getDocs(qRef);
        const list = snap.docs
          .map((d) => d.data())
          .map((g) => ({
            ...g,
            id: String(g.id),
            label: buildGameLabel(g),
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setGamesForWeek(list);
      } catch (e) {
        console.error("Error loading games for week:", e);
        setGamesForWeek([]);
      }
    };
    loadGames();
  }, [config.week, config.seasonYear, config.seasonType]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setConfig((prev) => ({ ...prev, [name]: checked }));
    } else if (["week", "seasonYear", "seasonType"].includes(name)) {
      // Clear GOTW -- it only exists for its own week/year/type, and a
      // stale id from the old combination could get silently saved.
      setConfig((prev) => ({ ...prev, [name]: value, gameOfTheWeekId: "" }));
    } else {
      setConfig((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // confirm admin
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists() || !userSnap.data().isAdmin) {
        setError("You do not have permission to update settings.");
        return;
      }

      const updateData = {
        week: Number(config.week),
        seasonYear: Number(config.seasonYear),
        seasonType: normalizeSeasonType(config.seasonType),
        deadline: config.deadline
          ? Timestamp.fromDate(new Date(config.deadline))
          : null,
        recapWeek: Number(config.recapWeek),
        lastUpdated: new Date().toISOString(),
        // Only set gameOfTheWeekId if provided; allowing empty string to clear it
        ...(config.gameOfTheWeekId
          ? { gameOfTheWeekId: String(config.gameOfTheWeekId) }
          : { gameOfTheWeekId: null }),
        // Enforced server-side in placeWager -- never allow this to save as
        // 0/blank, which would mean "unlimited" again.
        wagerMaxPoints: Math.max(1, Number(config.wagerMaxPoints) || 5),
      };

      const configRef = doc(db, "config", "config");
      // setDoc(merge), not updateDoc -- config/config may not exist yet
      // (e.g. right after a season reset), and updateDoc would throw.
      await setDoc(configRef, updateData, { merge: true });

      alert("Settings updated successfully!");
    } catch (err) {
      console.error("Error updating settings:", err);
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/notifications/adminTest", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Unknown error");
      }
      alert("Test notification sent!");
    } catch (error) {
      console.error("Error sending test notification:", error);
      alert("Failed to send test notification.");
    }
  };

  const handleResetSeason = async () => {
    const confirmed = confirm(
      "Are you sure you want to clear and archive the current season?\n\n" +
        "This archives and deletes games and picks, and resets the regular/postseason/all-time leaderboards to 0 (rolling everyone's all-time total into their lifetime total first). " +
        "History and everyone's account stay intact. It cannot be undone.",
    );
    if (!confirmed) return;

    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/jobs/clearForNewSeason", {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Unknown error");
      }
      alert("Season cleared and archived!");
    } catch (error) {
      console.error("Error resetting season:", error);
      alert("Failed to reset season. See console for details.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || fetching) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-3" aria-label="Loading">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl bg-surface border border-line animate-pulse"
          />
        ))}
      </div>
    );
  }
  if (!user || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="rounded-2xl bg-surface border border-line shadow-card p-8 text-center">
          <p className="font-semibold text-danger">
            {!user
              ? "You must be logged in to access this page."
              : "You do not have permission to view this page."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-accent-text">
          Dashboard
        </p>
        <h1 className="text-4xl uppercase italic leading-none">Admin</h1>
      </div>

      {error && (
        <p className="rounded-xl bg-danger/10 border border-danger/30 text-danger font-medium px-4 py-3">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className={card}>
          <h2 className={cardTitle}>Prediction Settings</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Week Number">
              <input
                type="number"
                name="week"
                value={config.week}
                onChange={handleChange}
                className={field}
                required
              />
            </Field>

            <Field label="Season Year">
              <input
                type="number"
                name="seasonYear"
                value={config.seasonYear}
                onChange={handleChange}
                className={field}
                required
              />
            </Field>

            <Field label="Season Type">
              <select
                name="seasonType"
                value={config.seasonType}
                onChange={handleChange}
                className={field}
                required
              >
                <option value={SEASON_TYPES.REGULAR}>Regular</option>
                <option value={SEASON_TYPES.POSTSEASON}>Postseason</option>
              </select>
            </Field>

            <Field label="Deadline">
              <input
                type="datetime-local"
                name="deadline"
                value={config.deadline}
                onChange={handleChange}
                className={field}
                required
              />
            </Field>

            <Field label="Recap Week">
              <input
                type="number"
                name="recapWeek"
                value={config.recapWeek}
                onChange={handleChange}
                className={field}
                required
              />
            </Field>
          </div>
        </section>

        <section className={`${card} border-2 border-[#f5b301]/70`}>
          <h2 className={`${cardTitle} flex items-center gap-2`}>
            <FaStar className="text-[#f5b301]" /> Game of the Week
          </h2>

          <div className="space-y-4">
            <Field
              label="Game"
              hint={`List shows games for Week ${config.week} • ${seasonTypeLabel(config.seasonType)} • ${config.seasonYear}.`}
            >
              <select
                name="gameOfTheWeekId"
                value={config.gameOfTheWeekId || ""}
                onChange={handleChange}
                className={field}
              >
                <option value="">— None —</option>
                {gamesForWeek.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Max Wager Points"
              hint="Most points anyone can risk on the Game of the Week, regardless of their current total."
            >
              <input
                type="number"
                name="wagerMaxPoints"
                value={config.wagerMaxPoints}
                onChange={handleChange}
                min={1}
                required
                className={field}
              />
            </Field>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-accent-gradient text-white font-display text-xl font-extrabold uppercase italic tracking-wide shadow-card transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <section className={card}>
        <h2 className={cardTitle}>Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleTestNotification}
            className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-2 border border-line font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
          >
            <FaBell /> Send Test Notification
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-2 border border-line font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </section>

      <section className={`${card} border-danger/40 bg-danger/5`}>
        <h2 className={`${cardTitle} text-danger`}>Danger Zone</h2>
        <p className="text-sm text-muted mb-3">
          Archives and deletes this season&apos;s games and picks and resets the
          leaderboards. History and accounts stay intact. Can&apos;t be undone.
        </p>
        <button
          onClick={handleResetSeason}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#c21f1f] text-white font-semibold hover:brightness-110 transition"
        >
          <FaBroom /> Clear & Archive Season
        </button>
      </section>
    </div>
  );
}

const card = "rounded-2xl bg-surface border border-line shadow-card p-5";
const cardTitle = "text-xl uppercase mb-4";
const field =
  "w-full rounded-xl bg-surface-2 border border-line px-3 py-2.5 text-fg focus:outline-none focus:ring-2 focus:ring-accent";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </span>
      {children}
      {hint && <span className="block mt-1.5 text-sm text-muted">{hint}</span>}
    </label>
  );
}

/** Pretty label for game dropdown */
function buildGameLabel(g) {
  try {
    const d = new Date(g.date);
    const when = d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const home = g.homeTeam?.abbreviation || g.homeTeam?.name || "HOME";
    const away = g.awayTeam?.abbreviation || g.awayTeam?.name || "AWAY";
    return `${away} @ ${home} • ${when}`;
  } catch {
    const home = g.homeTeam?.abbreviation || g.homeTeam?.name || "HOME";
    const away = g.awayTeam?.abbreviation || g.awayTeam?.name || "AWAY";
    return `${away} @ ${home}`;
  }
}
