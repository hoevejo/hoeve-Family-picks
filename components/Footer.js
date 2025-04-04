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
    <nav className="fixed bottom-0 left-0 w-full h-14 bg-[var(--card-color)] border-t border-[var(--border-color)] z-50">
      <div className="flex justify-around items-center h-full text-[var(--text-color)]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          const Icon = tab.icon;

          return (
            <button
              key={tab.name}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 transition-colors ${
                isActive
                  ? "text-[var(--accent-color)] font-semibold"
                  : "text-[var(--text-color)]"
              }`}
            >
              <Icon className="text-lg" />
              <span className="text-xs">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
