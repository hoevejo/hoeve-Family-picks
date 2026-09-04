"use client";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
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
              ? data.deadline.toDate().toISOString().slice(0, 16) // yyyy-mm-ddThh:mm
              : data.deadline?.seconds
                ? new Date(data.deadline.seconds * 1000)
                    .toISOString()
                    .slice(0, 16)
                : "",
            recapWeek: data.recapWeek ?? "",
            gameOfTheWeekId: data.gameOfTheWeekId
              ? String(data.gameOfTheWeekId)
              : "",
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
      };

      const configRef = doc(db, "config", "config");
      await updateDoc(configRef, updateData);

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
      const res = await fetch("/api/notifications/adminTest", {
        method: "POST",
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
      "Are you sure you want to clear and archive the current season?\n\nThis will delete all picks, games, and weekly recaps. It cannot be undone.",
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
      alert("✅ Season cleared and archived!");
    } catch (error) {
      console.error("Error resetting season:", error);
      alert("❌ Failed to reset season. See console for details.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || fetching) {
    return (
      <p className="text-center mt-10 text-[var(--text-color)]">Loading...</p>
    );
  }
  if (!user) {
    return (
      <p className="text-center mt-10 text-red-500">
        You must be logged in to access this page.
      </p>
    );
  }
  if (!isAdmin) {
    return (
      <p className="text-center mt-10 text-red-500">
        You do not have permission to view this page.
      </p>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors flex flex-col items-center">
      <h1 className="text-3xl font-bold text-center mb-6">Admin Dashboard</h1>
      {error && <p className="text-red-500 mt-2">{error}</p>}

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl shadow-md p-6 space-y-6"
      >
        <h2 className="text-xl font-semibold">Update Prediction Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium">Week Number</label>
            <input
              type="number"
              name="week"
              value={config.week}
              onChange={handleChange}
              className="w-full p-2 rounded-sm border bg-[var(--input-bg)] text-[var(--input-text)]"
              required
            />
          </div>

          <div>
            <label className="block font-medium">Season Year</label>
            <input
              type="number"
              name="seasonYear"
              value={config.seasonYear}
              onChange={handleChange}
              className="w-full p-2 rounded-sm border bg-[var(--input-bg)] text-[var(--input-text)]"
              required
            />
          </div>

          <div>
            <label className="block font-medium">Season Type</label>
            <select
              name="seasonType"
              value={config.seasonType}
              onChange={handleChange}
              className="w-full p-2 rounded-sm border bg-[var(--input-bg)] text-[var(--input-text)]"
              required
            >
              <option value={SEASON_TYPES.REGULAR}>Regular</option>
              <option value={SEASON_TYPES.POSTSEASON}>Postseason</option>
            </select>
          </div>

          <div>
            <label className="block font-medium">Deadline</label>
            <input
              type="datetime-local"
              name="deadline"
              value={config.deadline}
              onChange={handleChange}
              className="w-full p-2 rounded-sm border bg-[var(--input-bg)] text-[var(--input-text)]"
              required
            />
          </div>

          <div>
            <label className="block font-medium">Recap Week</label>
            <input
              type="number"
              name="recapWeek"
              value={config.recapWeek}
              onChange={handleChange}
              className="w-full p-2 rounded-sm border bg-[var(--input-bg)] text-[var(--input-text)]"
              required
            />
          </div>
        </div>

        {/* Game of the Week */}
        <div className="border-t border-[var(--border-color)] pt-4">
          <label className="block font-semibold mb-2">Game of the Week</label>
          <select
            name="gameOfTheWeekId"
            value={config.gameOfTheWeekId || ""}
            onChange={handleChange}
            className="w-full p-2 rounded-sm border bg-[var(--input-bg)] text-[var(--input-text)]"
          >
            <option value="">— None —</option>
            {gamesForWeek.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="text-sm opacity-70 mt-1">
            List shows games for Week {config.week} •{" "}
            {seasonTypeLabel(config.seasonType)} • {config.seasonYear}.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full px-4 py-2 bg-[var(--accent-color)] text-white rounded-sm hover:bg-[var(--accent-hover)]"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <button
        onClick={handleTestNotification}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600"
      >
        Send Test Notification
      </button>

      <button
        onClick={handleResetSeason}
        className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-sm hover:bg-yellow-600"
      >
        🧹 Clear & Archive Season
      </button>

      <button
        onClick={handleLogout}
        className="mt-6 px-4 py-2 bg-red-500 text-white rounded-sm hover:bg-red-600"
      >
        Logout
      </button>
    </div>
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
