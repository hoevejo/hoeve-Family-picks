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
                className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-xl text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                    aria-label="Close"
                >
                    &times;
                </button>

                {children}
            </div>
        </div>
    );
}
