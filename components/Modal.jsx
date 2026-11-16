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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-surface text-fg border border-line shadow-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 grid place-items-center h-8 w-8 rounded-full text-2xl leading-none text-muted hover:text-fg hover:bg-surface-2 transition-colors"
          aria-label="Close"
        >
          &times;
        </button>

        {children}
      </div>
    </div>
  );
}
