"use client";

import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword)
      return toast.error("Passwords do not match!");

    setLoading(true);
    const toastId = "register-toast";
    toast.loading("Creating account...", { id: toastId });

    const fullName = `${form.firstName} ${form.lastName}`;
    const avatarUrl = `https://api.dicebear.com/7.x/initials/png?seed=${form.firstName}%20${form.lastName}`;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const newUser = userCredential.user;

      await updateProfile(newUser, { displayName: fullName });

      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        firstName: form.firstName,
        lastName: form.lastName,
        fullName,
        displayName: fullName,
        email: newUser.email,
        createdAt: serverTimestamp(),
        profilePicture: avatarUrl,
        totalPoints: 0,
        weeklyPoints: {},
        isAdmin: false,
        theme: "theme-light",
      });

      const leaderboardData = {
        uid: newUser.uid,
        fullName,
        firstName: form.firstName,
        lastName: form.lastName,
        profilePicture: avatarUrl,
        totalPoints: 0,
        currentRank: 0,
        previousRank: 0,
        positionChange: 0,
      };

      await setDoc(doc(db, "leaderboard", newUser.uid), leaderboardData);
      await setDoc(
        doc(db, "leaderboardPostseason", newUser.uid),
        leaderboardData
      );
      await setDoc(doc(db, "leaderboardAllTime", newUser.uid), leaderboardData);

      toast.success("Account created! Redirecting...", { id: toastId });
      router.replace("/");
    } catch (err) {
      toast.error(err.message || "Registration failed.", { id: toastId });
    }

    setLoading(false);
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/football-background.png')" }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 z-0" />

      {/* Padded outer container to avoid edge clipping */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white shadow-2xl rounded-xl p-8 backdrop-blur-md">
          <h1 className="text-3xl font-bold text-blue-800 text-center mb-6">
            Register
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              name="firstName"
              placeholder="First Name"
              value={form.firstName}
              onChange={handleChange}
              required
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              name="lastName"
              placeholder="Last Name"
              value={form.lastName}
              onChange={handleChange}
              required
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition flex justify-center items-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Registering..." : "Register"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-700 mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
