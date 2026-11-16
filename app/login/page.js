"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import AuthShell, {
  authButtonClass,
  authInputClass,
  authLinkClass,
} from "../../components/AuthShell";

export default function Login() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!loading && user) router.push("/");
  }, [user, loading, router]);

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return toast.error("Please enter a valid email address.");
    }

    setIsLoggingIn(true);
    const toastId = "login-toast";
    toast.loading("Logging in...", { id: toastId });

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back!", { id: toastId });
    } catch (err) {
      toast.error("Invalid email or password.", { id: toastId });
      setIsLoggingIn(false);
    }
  };

  return (
    <AuthShell
      title="Login"
      footer={
        <>
          Don’t have an account?{" "}
          <a href="/register" className={authLinkClass}>
            Register
          </a>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="Email"
          className={authInputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="Password"
          className={authInputClass}
        />
        <button
          type="submit"
          disabled={isLoggingIn}
          className={authButtonClass}
        >
          {isLoggingIn && (
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isLoggingIn ? "Logging in..." : "Login"}
        </button>
      </form>
    </AuthShell>
  );
}
