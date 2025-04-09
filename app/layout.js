import { useEffect } from "react";
import { AuthProvider } from "../context/AuthContext";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export default function RootLayout({ children }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("✅ Service Worker registered"))
        .catch((err) =>
          console.error("❌ Service Worker registration failed:", err)
        );
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
      <body className="overflow-x-hidden bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
