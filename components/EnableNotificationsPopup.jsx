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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div className="bg-[var(--card-color)] text-[var(--text-color)] p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl font-semibold mb-2">Enable Notifications?</h2>
                <p className="mb-4 text-sm">
                    Turn on notifications to get reminders and updates when new games are
                    available, results are calculated, and more!
                </p>

                {error && (
                    <p className="text-red-500 text-sm mb-2">{error}</p>
                )}

                <div className="flex justify-end space-x-4">
                    <button
                        onClick={onDismiss}
                        disabled={loading}
                        className="px-4 py-2 rounded bg-gray-300 text-sm text-black hover:bg-gray-400"
                    >
                        Maybe Later
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="px-4 py-2 rounded bg-[var(--accent-color)] text-white text-sm hover:bg-[var(--accent-hover)]"
                    >
                        {loading ? "Enabling..." : "Enable"}
                    </button>
                </div>
            </div>
        </div>
    );
}
