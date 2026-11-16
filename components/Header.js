"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { FaFootballBall } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import Image from "next/image";

const menuItem =
  "w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-accent/10 transition-colors";

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
    <header className="fixed top-0 left-0 w-full pt-[env(safe-area-inset-top)] bg-accent-gradient text-white shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex justify-between items-center">
        {/* Left: Logo + Title */}
        <button
          type="button"
          className="flex items-center gap-2"
          onClick={() => router.push("/")}
        >
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/15 ring-1 ring-white/25">
            <FaFootballBall className="text-base -rotate-45" />
          </span>
          <span className="font-display text-2xl font-extrabold uppercase italic tracking-wide leading-none">
            NFL Pick&apos;em
          </span>
        </button>

        {/* Right: User Info Dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full pl-3 pr-1 py-1 hover:bg-white/10 transition-colors"
            >
              <span className="hidden sm:inline font-medium">
                {user.displayName}
              </span>
              <Image
                src={user.profilePicture || "/default-avatar.png"}
                alt="Profile"
                width={32}
                height={32}
                className="rounded-full object-cover ring-2 ring-white/50"
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 py-1 bg-surface text-fg border border-line rounded-xl shadow-card overflow-hidden z-50">
                <button
                  onClick={() => {
                    router.push("/profile");
                    setDropdownOpen(false);
                  }}
                  className={menuItem}
                >
                  Profile
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      router.push("/admin");
                      setDropdownOpen(false);
                    }}
                    className={menuItem}
                  >
                    Admin
                  </button>
                )}

                <button
                  onClick={() => {
                    window.location.reload();
                    setDropdownOpen(false);
                  }}
                  className={menuItem}
                >
                  <FiRefreshCw className="text-sm" />
                  Refresh
                </button>

                <div className="my-1 border-t border-line" />

                <button
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                  }}
                  className={`${menuItem} text-danger hover:bg-danger/10`}
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
