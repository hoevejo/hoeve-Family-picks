"use client";
import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

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
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create User in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const newUser = userCredential.user;

      // Step 2: Update User Profile in Authentication (Display Name)
      await updateProfile(newUser, {
        displayName: `${form.firstName} ${form.lastName}`,
      });

      // Step 3: Store User Info in Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        firstName: form.firstName,
        lastName: form.lastName,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        profilePicture: "https://via.placeholder.com/150",
        isAdmin: false,
      });

      // Step 4: Add User to the Global Leaderboard
      await setDoc(doc(db, `leaderboard`, newUser.uid), {
        firstName: form.firstName,
        totalPoints: 0, // New users start with 0 points
        lastWeekPoints: 0,
        positionChange: 0,
      });

      // Redirect to homepage after successful registration
      router.replace("/");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Create an Account</h1>
      {error && <p className="text-red-500">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <input
          type="text"
          name="firstName"
          placeholder="First Name"
          className="border p-2 rounded"
          value={form.firstName}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="lastName"
          placeholder="Last Name"
          className="border p-2 rounded"
          value={form.lastName}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="border p-2 rounded"
          value={form.password}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          className="border p-2 rounded"
          value={form.confirmPassword}
          onChange={handleChange}
          required
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <button
        className="mt-4 text-blue-500 underline"
        onClick={() => router.push("/login")}
      >
        Already have an account? Login
      </button>
    </div>
  );
}
