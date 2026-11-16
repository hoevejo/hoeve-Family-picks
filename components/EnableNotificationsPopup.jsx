"use client";
import { useState } from "react";

export default function EnableNotificationsPopup({ onConfirm, onDismiss }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      await onConfirm();
    } catch (err) {
      console.error("Notification permission error:", err);
      setError("Failed to enable notifications. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface text-fg border border-line shadow-card p-6">
        <h2 className="text-2xl uppercase mb-2">Enable Notifications?</h2>
        <p className="mb-5 text-sm text-muted">
          Turn on notifications to get reminders and updates when new games are
          available, results are calculated, and more!
        </p>

        {error && <p className="text-danger text-sm mb-3">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDismiss}
            disabled={loading}
            className="py-2.5 rounded-xl bg-surface-2 border border-line text-sm font-semibold hover:bg-accent/10 transition-colors disabled:opacity-60"
          >
            Maybe Later
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60"
          >
            {loading ? "Enabling..." : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}
