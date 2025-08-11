"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import LoadingScreen from "../components/LoadingScreen";
import { Toaster } from "react-hot-toast";
import "./globals.css";

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Use useMemo to optimize auth-free route checking
  const authFreeRoutes = useMemo(() => ["/login", "/register"], []);

  const isAuthFree = authFreeRoutes.includes(pathname);

  useEffect(() => {
    // Redirect if not loading, user is null, and not on an auth-free route
    if (!loading && user === null && !isAuthFree) {
      router.replace("/login");
    }
  }, [user, loading, router, isAuthFree]);

  // 🌀 Show loading screen while checking auth
  if (loading) return <LoadingScreen />;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      {!isAuthFree && <Header />}

      {!isAuthFree ? (
        <main className="pt-[64px] pb-[56px] overflow-y-auto h-[calc(100vh-64px-56px)] w-full max-w-screen-xl mx-auto px-4 sm:px-6">
          {children}
        </main>
      ) : (
        <main className="min-h-screen">{children}</main>
      )}

      {!isAuthFree && <Footer />}
    </div>
  );
}

export default function RootLayout({ children }) {
  useEffect(() => {
    // ✅ Register Service Worker if not already registered
    if ("serviceWorker" in navigator) {
      if (navigator.serviceWorker.controller) return; // If already registered, skip

      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("Service Worker registered"))
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
          toast.error("Service Worker registration failed.");
        });
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#0076b6" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <title>NFL Pick&apos;em</title>
        <meta name="description" content="Family NFL Pick'em App" />
      </head>
      <body className="overflow-x-hidden">
        <AuthProvider>
          <ProtectedLayout>{children}</ProtectedLayout>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
