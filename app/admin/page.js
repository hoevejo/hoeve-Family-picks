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

  // Fetch config from Firestore
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

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // Handle loading and access
  if (loading || fetching) {
    return <p className="text-center mt-10">Loading...</p>;
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

  // ✅ Admin UI
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      {error && <p className="text-red-500 mt-2">{error}</p>}

      <form
        onSubmit={handleSubmit}
        className="mt-6 bg-white p-6 shadow-md rounded-md w-full max-w-lg"
      >
        <h2 className="text-xl font-semibold mb-4">
          Update Prediction Settings
        </h2>

        <div className="mb-4">
          <label className="block font-medium">Week Number</label>
          <input
            type="number"
            name="week"
            value={config.week}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block font-medium">Season Year</label>
          <input
            type="number"
            name="seasonYear"
            value={config.seasonYear}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block font-medium">Season Type</label>
          <select
            name="seasonType"
            value={config.seasonType}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          >
            <option value="Regular Season">Regular Season</option>
            <option value="Postseason">Postseason</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block font-medium">Deadline</label>
          <input
            type="datetime-local"
            name="deadline"
            value={config.deadline}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block font-medium">Recap Week</label>
          <input
            type="number"
            name="recapWeek"
            value={config.recapWeek}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className="mt-6">
        <button
          onClick={handleLogout}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
