"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../../../lib/firebaseConfig";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../lib/firebaseConfig";

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState({
    week: "",
    seasonYear: "",
    seasonType: "Regular Season",
    deadline: "",
  });

  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  // ✅ Redirect non-admin users
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/admin/login");
    }
  }, [user, isAdmin, loading, router]);

  // ✅ Fetch Firestore Config (`config/predictionSettings`) only when `isAdmin` is confirmed
  useEffect(() => {
    const fetchConfig = async () => {
      if (loading || !isAdmin) return; // ✅ Wait until isAdmin is loaded

      try {
        console.log("Fetching Firestore config...");
        const configRef = doc(db, "config", "predictionSettings");
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const data = configSnap.data();
          setConfig({
            week: data.week || "",
            seasonYear: data.seasonYear || new Date().getFullYear(),
            seasonType: data.seasonType || "Regular Season",
            deadline: data.deadline?.toDate().toISOString().slice(0, -8) || "",
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
  }, [isAdmin, loading]); // ✅ Fetch only after `isAdmin` is determined

  // ✅ Handle Input Changes
  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  // ✅ Handle Form Submission (Save Config to Firestore)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const userRef = doc(db, "users", user.uid); // Get current user document
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error("❌ User not found in Firestore.");
        setError("User not found. Please try again.");
        return;
      }

      const userData = userSnap.data();
      console.log("👤 User Data from Firestore:", userData);

      // Check if user is an admin
      if (!userData.isAdmin) {
        console.error("❌ User is not an admin. Access denied.");
        setError("You do not have permission to update settings.");
        return;
      }

      // Log the update data
      const updateData = {
        week: parseInt(config.week, 10), // Convert week to a number
        seasonYear: parseInt(config.seasonYear, 10), // Convert seasonYear to number
        seasonType: config.seasonType,
        deadline: Timestamp.fromDate(new Date(config.deadline)),
      };

      console.log("🚀 Updating Firestore with:", updateData);

      const configRef = doc(db, "config", "predictionSettings");
      await updateDoc(configRef, updateData);

      console.log("✅ Firestore Update Successful!");
      alert("Settings updated successfully!");
    } catch (err) {
      console.error("❌ Error updating settings:", err);
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Handle Logout
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || fetching) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {error && <p className="text-red-500">{error}</p>}

      {/* 🔥 Config Update Form */}
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

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* 🔥 Admin Actions */}
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
