"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebaseConfig";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState({
    week: "",
    seasonYear: "",
    seasonType: "Regular Season",
    deadline: "",
    recapWeek: "",
  });

  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      if (loading || !isAdmin) return;

      try {
        const configRef = doc(db, "config", "config");
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const data = configSnap.data();
          setConfig({
            week: data.week || "",
            seasonYear: data.seasonYear || new Date().getFullYear(),
            seasonType: data.seasonType || "Regular Season",
            deadline: data.deadline?.toDate().toISOString().slice(0, -8) || "",
            recapWeek: data.recapWeek || "",
          });
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

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User not found. Please try again.");
        return;
      }

      const userData = userSnap.data();
      if (!userData.isAdmin) {
        setError("You do not have permission to update settings.");
        return;
      }

      const updateData = {
        week: parseInt(config.week, 10),
        seasonYear: parseInt(config.seasonYear, 10),
        seasonType: config.seasonType,
        deadline: Timestamp.fromDate(new Date(config.deadline)),
        recapWeek: parseInt(config.recapWeek, 10),
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

      if (res.ok) {
        alert("Test notification sent!");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      alert("Failed to send test notification.");
    }
  };

  const handleResetSeason = async () => {
    const confirmed = confirm(
      "Are you sure you want to clear and archive the current season?\n\nThis will delete all picks, games, and weekly recaps. It cannot be undone."
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/jobs/clearForNewSeason", {
        method: "GET",
      });

      if (res.ok) {
        alert("✅ Season cleared and archived!");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Unknown error");
      }
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
        className="w-full max-w-lg bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl shadow-md p-6 space-y-4"
      >
        <h2 className="text-xl font-semibold mb-2">
          Update Prediction Settings
        </h2>

        <div>
          <label className="block font-medium">Week Number</label>
          <input
            type="number"
            name="week"
            value={config.week}
            onChange={handleChange}
            className="w-full p-2 rounded border bg-[var(--input-bg)] text-[var(--input-text)]"
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
            className="w-full p-2 rounded border bg-[var(--input-bg)] text-[var(--input-text)]"
            required
          />
        </div>

        <div>
          <label className="block font-medium">Season Type</label>
          <select
            name="seasonType"
            value={config.seasonType}
            onChange={handleChange}
            className="w-full p-2 rounded border bg-[var(--input-bg)] text-[var(--input-text)]"
            required
          >
            <option value="Regular Season">Regular Season</option>
            <option value="Postseason">Postseason</option>
          </select>
        </div>

        <div>
          <label className="block font-medium">Deadline</label>
          <input
            type="datetime-local"
            name="deadline"
            value={config.deadline}
            onChange={handleChange}
            className="w-full p-2 rounded border bg-[var(--input-bg)] text-[var(--input-text)]"
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
            className="w-full p-2 rounded border bg-[var(--input-bg)] text-[var(--input-text)]"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full px-4 py-2 bg-[var(--accent-color)] text-white rounded hover:bg-[var(--accent-hover)]"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <button
        onClick={handleTestNotification}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Send Test Notification
      </button>

      <button
        onClick={handleResetSeason}
        className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
      >
        🧹 Clear & Archive Season
      </button>

      <button
        onClick={handleLogout}
        className="mt-6 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      >
        Logout
      </button>
    </div>
  );
}
