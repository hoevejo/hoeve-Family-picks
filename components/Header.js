"use client";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 w-full bg-blue-600 text-white shadow-md z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo or Title */}
        <h1
          className="text-xl font-bold cursor-pointer"
          onClick={() => router.push("/")}
        >
          NFL Pick'em
        </h1>

        {/* Hamburger Menu (Mobile) */}
        <button
          className="md:hidden focus:outline-none"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {/* Hamburger Icon */}
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </button>

        {/* Navigation Links (Desktop) */}
        <nav className="hidden md:flex space-x-6">
          <button
            onClick={() => router.push("/week")}
            className="hover:underline"
          >
            This Week's Picks
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="hover:underline"
          >
            Profile
          </button>
          <button onClick={logout} className="hover:underline text-red-400">
            Logout
          </button>
        </nav>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-blue-700 text-white py-2 px-4 space-y-2">
          <button
            onClick={() => router.push("/week")}
            className="block w-full text-left hover:underline"
          >
            This Week's Picks
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="block w-full text-left hover:underline"
          >
            Profile
          </button>
          <button
            onClick={logout}
            className="block w-full text-left text-red-400 hover:underline"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
