"use client";
import { useEffect } from "react";

export default function Modal({ onClose, children }) {
    // Close on ESC key
    useEffect(() => {
        const esc = (e) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", esc);
        return () => document.removeEventListener("keydown", esc);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={onClose}
        >
            <div
                className="relative rounded-lg shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
                style={{
                    backgroundColor: "var(--card-color)",
                    color: "var(--text-color)",
                    border: "1px solid var(--border-color)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-2xl hover:text-red-500"
                    style={{ color: "var(--text-color)" }}
                    aria-label="Close"
                >
                    &times;
                </button>

                {children}
            </div>
        </div>
    );
}
