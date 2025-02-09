"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

export default function Login() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ✅ Ensure `isAdmin` is determined before redirecting
  useEffect(() => {
    if (!loading && user !== null && isAdmin !== null) {
      if (isAdmin) {
        console.log("✅ Redirecting admin to /admin/dashboard");
        router.push("/admin/dashboard");
      } else {
        console.log("✅ Redirecting user to /");
        router.push("/");
      }
    }
  }, [user, isAdmin, loading, router]);

  // ✅ Handle Login with Email/Password
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const loggedInUser = userCredential.user;

      // ✅ Fetch `isAdmin` status after login
      const userRef = doc(db, "users", loggedInUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log("🔹 Admin Check After Login:", userData);

        if (userData.isAdmin) {
          console.log("✅ Redirecting to Admin Dashboard");
          router.push("/admin/dashboard");
        } else {
          console.log("✅ Redirecting to Home");
          router.push("/");
        }
      } else {
        console.warn("User document not found in Firestore.");
        setError("Authentication successful, but user data not found.");
      }
    } catch (err) {
      setError("Invalid email or password.");
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 shadow-md rounded-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Login</h1>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block font-medium">Email</label>
            <input
              type="email"
              className="w-full p-2 border rounded-md"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block font-medium">Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded-md"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
