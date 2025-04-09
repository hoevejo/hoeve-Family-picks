"use client";

import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import LoadingScreen from "../../components/LoadingScreen";

export default function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <Header />
      <main className="pt-[64px] pb-[56px] overflow-y-auto h-[calc(100vh-64px-56px)] w-full max-w-screen-xl mx-auto px-4 sm:px-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
