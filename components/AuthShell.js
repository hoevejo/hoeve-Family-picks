import { FaFootballBall } from "react-icons/fa";

// Auth pages keep one fixed light look regardless of the theme setting, so
// these use literal colors rather than the theme tokens.
export const authInputClass =
  "w-full p-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0076b6] focus:border-transparent autofill:shadow-[inset_0_0_0_1000px_#fff] autofill:[-webkit-text-fill-color:#111827]";

export const authButtonClass =
  "w-full py-3 rounded-xl bg-[linear-gradient(135deg,#007abd_0%,#004f7c_100%)] text-white font-display text-xl font-extrabold uppercase italic tracking-wide shadow-lg transition hover:brightness-110 disabled:opacity-60 flex justify-center items-center gap-2";

export const authLinkClass = "font-semibold text-[#0071ae] hover:underline";

/** Gradient backdrop, wordmark, and white card shared by /login and /register. */
export default function AuthShell({ title, children, footer }) {
  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#0086cf_0%,#0076b6_40%,#003e62_100%)] text-gray-900 [color-scheme:light] py-10">
      {/* Faint yard lines */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_79px,rgba(255,255,255,0.06)_79px,rgba(255,255,255,0.06)_81px)]" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="flex items-center justify-center gap-2 mb-6 text-white">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-white/15 ring-1 ring-white/25">
            <FaFootballBall className="text-lg -rotate-45" />
          </span>
          <span className="font-display text-3xl font-extrabold uppercase italic tracking-wide leading-none">
            NFL Pick&apos;em
          </span>
        </div>

        <div className="bg-white shadow-2xl rounded-2xl p-8">
          <h1 className="text-3xl uppercase text-center mb-6">{title}</h1>
          {children}
          <p className="text-center text-sm text-gray-700 mt-5">{footer}</p>
        </div>
      </div>
    </div>
  );
}
