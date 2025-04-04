"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Toaster } from "react-hot-toast";
import "./globals.css";

function ProtectedLayout({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const authFreeRoutes = ["/login", "/register"];
  const isAuthFree = authFreeRoutes.includes(pathname);

  useEffect(() => {
    if (user === null && !isAuthFree) {
      router.replace("/login");
    }
  }, [user, router, isAuthFree]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      {!isAuthFree && <Header />}

      {/* Scrollable content area between header and footer */}
      {!isAuthFree ? (
        <main className="pt-[64px] pb-[56px] overflow-y-auto h-[calc(100vh-64px-56px)] w-full max-w-screen-xl mx-auto px-4 sm:px-6">
          {children}
        </main>
      ) : (
        // Full-screen pages (login/register)
        <main className="min-h-screen">{children}</main>
      )}

      {!isAuthFree && <Footer />}
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden">
        <AuthProvider>
          <ProtectedLayout>{children}</ProtectedLayout>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
