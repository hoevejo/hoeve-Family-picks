"use client";
import { usePathname, useRouter } from "next/navigation";
import { FaHome, FaHistory, FaListUl, FaClipboardList } from "react-icons/fa";

const tabs = [
  { name: "Home", icon: FaHome, path: "/" },
  { name: "Predictions", icon: FaClipboardList, path: "/week" },
  { name: "Recap", icon: FaListUl, path: "/recap" },
  { name: "History", icon: FaHistory, path: "/history" },
];

export default function Footer() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 w-full pb-[env(safe-area-inset-bottom)] bg-surface/90 backdrop-blur-lg border-t border-line shadow-[0_-8px_24px_-16px_var(--shadow-color)] z-50">
      <div className="max-w-xl mx-auto flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          const Icon = tab.icon;

          return (
            <button
              key={tab.name}
              onClick={() => router.push(tab.path)}
              aria-current={isActive ? "page" : undefined}
              className={`group flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
                isActive ? "text-accent-text" : "text-muted hover:text-fg"
              }`}
            >
              <span
                className={`grid place-items-center h-8 w-14 rounded-full transition-colors ${
                  isActive ? "bg-accent/15" : "group-hover:bg-surface-2"
                }`}
              >
                <Icon className="text-lg" />
              </span>
              <span
                className={`text-[11px] uppercase tracking-wide ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {tab.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
