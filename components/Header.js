"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { FaFootballBall } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import Image from "next/image";

export default function Header() {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-[var(--accent-color)] text-white shadow-md z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
        {/* Left: Logo + Title */}
        <div
          className="flex items-center space-x-2 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <FaFootballBall className="text-xl" />
          <h1 className="text-xl font-bold tracking-wide">NFL Pick&apos;em</h1>
        </div>

        {/* Right: User Info Dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center space-x-2 hover:opacity-90 transition-opacity"
            >
              <span className="hidden sm:inline font-medium">
                {user.displayName}
              </span>
              <Image
                src={user.profilePicture || "/default-avatar.png"}
                alt="Profile"
                width={32}
                height={32}
                className="rounded-full object-cover border border-white"
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--card-color)] text-[var(--text-color)] border border-[var(--border-color)] rounded-lg shadow-lg z-50 transition-all">
                <button
                  onClick={() => {
                    router.push("/profile");
                    setDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-[var(--accent-color)] hover:text-white transition-colors"
                >
                  Profile
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      router.push("/admin");
                      setDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-[var(--accent-color)] hover:text-white transition-colors"
                  >
                    Admin
                  </button>
                )}

                <button
                  onClick={() => {
                    window.location.reload();
                    setDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-[var(--accent-color)] hover:text-white transition-colors"
                >
                  <FiRefreshCw className="text-sm" />
                  Refresh
                </button>

                <button
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-red-500 hover:bg-[var(--accent-hover)] hover:text-white transition-colors rounded-b-md"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
