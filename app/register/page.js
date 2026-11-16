"use client";

import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import AuthShell, {
  authButtonClass,
  authInputClass,
  authLinkClass,
} from "../../components/AuthShell";

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

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePasswordStrength = (password) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return regex.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword)
      return toast.error("Passwords do not match!");

    if (!validateEmail(form.email)) {
      return toast.error("Please enter a valid email address.");
    }

    if (!validatePasswordStrength(form.password)) {
      return toast.error(
        "Password must be at least 8 characters long and contain both letters and numbers.",
      );
    }

    setLoading(true);
    const toastId = "register-toast";
    toast.loading("Creating your account...", { id: toastId });

    const fullName = `${form.firstName} ${form.lastName}`;
    const avatarUrl = `https://api.dicebear.com/7.x/initials/png?seed=${form.firstName}%20${form.lastName}`;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password,
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
        isAdmin: false,
        notificationsEnabled: false,
        theme: "system",
      });

      // World-readable display fields only, so other pages don't have to
      // pull the full users/{uid} doc (email, isAdmin, etc.) for a name/avatar.
      await setDoc(doc(db, "publicProfiles", newUser.uid), {
        uid: newUser.uid,
        firstName: form.firstName,
        lastName: form.lastName,
        fullName,
        displayName: fullName,
        profilePicture: avatarUrl,
      });

      // No fullName (dead field, UI joins against publicProfiles) and no
      // "lifetime" entry (only ever written by the season-reset job).
      const rankedEntry = {
        uid: newUser.uid,
        totalPoints: 0,
        currentRank: 0,
        previousRank: 0,
        positionChange: 0,
      };
      const allTimeEntry = { uid: newUser.uid, totalPoints: 0 };

      try {
        await Promise.all([
          setDoc(
            doc(db, "leaderboards/regular/entries", newUser.uid),
            rankedEntry,
          ),
          setDoc(
            doc(db, "leaderboards/postseason/entries", newUser.uid),
            rankedEntry,
          ),
          setDoc(
            doc(db, "leaderboards/allTime/entries", newUser.uid),
            allTimeEntry,
          ),
        ]);
      } catch (error) {
        console.error("Error creating leaderboard documents:", error);
        toast.error("Failed to set leaderboard data. Please try again.");
      }

      toast.success("Account created! Redirecting...", { id: toastId });
      router.replace("/");
    } catch (err) {
      toast.error(err.message || "Registration failed.", { id: toastId });
    }

    setLoading(false);
  };

  return (
    <AuthShell
      title="Register"
      footer={
        <>
          Already have an account?{" "}
          <a href="/login" className={authLinkClass}>
            Login
          </a>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="firstName"
          placeholder="First Name"
          value={form.firstName}
          onChange={handleChange}
          required
          autoFocus
          className={authInputClass}
        />
        <input
          name="lastName"
          placeholder="Last Name"
          value={form.lastName}
          onChange={handleChange}
          required
          className={authInputClass}
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
          className={authInputClass}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
          className={authInputClass}
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={handleChange}
          required
          className={authInputClass}
        />

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading && (
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {loading ? "Creating your account..." : "Register"}
        </button>
      </form>
    </AuthShell>
  );
}
