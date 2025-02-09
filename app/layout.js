"use client";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "./globals.css";
import Header from "../components/Header";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function ProtectedLayout({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to login if not authenticated & not on login/register pages
  useEffect(() => {
    if (user === null && pathname !== "/login" && pathname !== "/register") {
      router.replace("/login");
    }
  }, [user, router, pathname]);

  // Hide Header on login & register pages
  const hideHeader = pathname === "/login" || pathname === "/register";

  return (
    <div>
      {!hideHeader && <Header />}
      <main className="container mx-auto px-6">{children}</main>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="pt-16">
        <AuthProvider>
          <ProtectedLayout>{children}</ProtectedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
