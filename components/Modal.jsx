// components/Modal.jsx
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4 relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-white"
                >
                    &times;
                </button>
                {children}
            </div>
        </div>
    );
}
