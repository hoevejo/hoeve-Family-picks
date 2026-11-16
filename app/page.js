"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebaseConfig";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import EnableNotificationsPopup from "@/components/EnableNotificationsPopup";
import { subscribeToPushNotifications } from "@/lib/pushUtils";
import { leaderboardScope } from "@/lib/seasonType";
import { FaTrophy } from "react-icons/fa";

export default function Leaderboard() {
  const { user } = useAuth();

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Regular Season");
  const [showPopup, setShowPopup] = useState(false);

  const tabs = useMemo(() => ["Regular Season", "Postseason", "All-Time"], []);

  // Pick default tab from config.seasonType ("Regular", "regular", etc.)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "config"));
        if (!snap.exists()) return;
        const scope = leaderboardScope((snap.data() || {}).seasonType);
        setActiveTab(scope === "postseason" ? "Postseason" : "Regular Season");
      } catch (e) {
        console.warn("Failed to load config:", e);
      }
    };
    fetchConfig();
  }, []);

  const collectionName = useMemo(() => {
    if (activeTab === "Postseason") return "leaderboards/postseason/entries";
    if (activeTab === "All-Time") return "leaderboards/allTime/entries";
    return "leaderboards/regular/entries";
  }, [activeTab]);

  // Realtime leaderboard; ignore cache-only first emission to avoid stale data
  useEffect(() => {
    setLoading(true);

    const collRef = collection(db, collectionName);

    const unsub = onSnapshot(
      collRef,
      { includeMetadataChanges: true },
      async (snap) => {
        // If this is a cache-only snapshot (no pending writes), wait for server data
        if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;

        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // publicProfiles, not users -- avoids scanning private fields.
        // Fetched fresh (server) so names/avatars update immediately.
        let usersSnap;
        try {
          usersSnap = await getDocsFromServer(collection(db, "publicProfiles"));
        } catch {
          usersSnap = await getDocs(collection(db, "publicProfiles")); // fallback
        }

        const userMap = {};
        usersSnap.forEach((u) => {
          const ud = u.data();
          if (ud?.uid) userMap[ud.uid] = ud;
        });

        const rows = raw.map((e) => {
          const u = userMap[e.uid] || {};
          return {
            ...e,
            uid: e.uid,
            profilePicture: u.profilePicture || "/default-avatar.png",
            firstName: u.firstName || u.fullName || e.uid || "Unknown",
            totalPoints: Number(e.totalPoints || 0),
            currentRank:
              typeof e.currentRank === "number" && e.currentRank > 0
                ? e.currentRank
                : null,
            positionChange: Number(e.positionChange || 0),
          };
        });

        // Fill in registered users with no leaderboard doc yet at 0 points
        // instead of an empty table -- display-only, writes nothing.
        const presentUids = new Set(rows.map((r) => r.uid));
        for (const u of Object.values(userMap)) {
          if (!u?.uid || presentUids.has(u.uid)) continue;
          rows.push({
            uid: u.uid,
            profilePicture: u.profilePicture || "/default-avatar.png",
            firstName: u.firstName || u.fullName || u.uid || "Unknown",
            totalPoints: 0,
            currentRank: null,
            positionChange: 0,
          });
        }

        // Sort
        let sorted;
        if (activeTab === "All-Time") {
          sorted = [...rows].sort((a, b) => b.totalPoints - a.totalPoints);
        } else {
          sorted = [...rows].sort((a, b) => {
            const ra = a.currentRank ?? Infinity;
            const rb = b.currentRank ?? Infinity;
            if (ra !== rb) return ra - rb;
            // tie-breaker: higher total first
            return b.totalPoints - a.totalPoints;
          });
        }

        setLeaderboard(sorted);
        setLoading(false);
      },
      (err) => {
        console.error("Leaderboard onSnapshot error:", err);
        setLeaderboard([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [collectionName, activeTab]);

  // Optional: show notifications prompt after login
  useEffect(() => {
    if (user && user.notificationsEnabled !== true) {
      const t = setTimeout(() => setShowPopup(true), 5000);
      return () => clearTimeout(t);
    }
  }, [user]);

  const getRankDisplay = (index, entry) => {
    if (activeTab === "All-Time") return index + 1;
    return entry.currentRank || index + 1;
  };

  const isAllTime = activeTab === "All-Time";
  const podium = leaderboard.length >= 3 ? leaderboard.slice(0, 3) : [];
  const rest = podium.length ? leaderboard.slice(3) : leaderboard;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-4xl uppercase italic leading-none flex items-center gap-2">
          <FaTrophy className="text-accent-text text-3xl not-italic" />
          Leaderboard
        </h1>
      </div>

      {/* Season scope switch */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 border border-line">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "bg-accent text-white shadow-card"
                : "text-muted hover:text-fg"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="Loading leaderboard">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-surface border border-line animate-pulse"
            />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <p className="text-center text-muted py-10">No players yet.</p>
      ) : (
        <>
          {podium.length > 0 && (
            <section className="rounded-2xl bg-accent-gradient text-white shadow-card px-3 pt-6 overflow-hidden">
              <div className="grid grid-cols-3 items-end gap-2">
                {[1, 0, 2].map((pos) => (
                  <PodiumSpot
                    key={podium[pos].uid || podium[pos].id || pos}
                    entry={podium[pos]}
                    place={pos}
                    rank={getRankDisplay(pos, podium[pos])}
                    isCurrentUser={user?.uid === podium[pos].uid}
                    showChange={!isAllTime}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <ol className="rounded-2xl bg-surface border border-line shadow-card overflow-hidden divide-y divide-line">
              {rest.map((entry, i) => {
                const index = i + podium.length;
                const isCurrentUser = user?.uid === entry.uid;

                return (
                  <li
                    key={entry.uid || entry.id || index}
                    className={`relative flex items-center gap-3 px-4 py-3 ${
                      isCurrentUser ? "bg-accent/10" : ""
                    }`}
                  >
                    {isCurrentUser && (
                      <span className="absolute left-0 inset-y-0 w-1 bg-accent" />
                    )}
                    <span className="w-7 text-center font-display text-xl font-bold text-muted tabular-nums">
                      {getRankDisplay(index, entry)}
                    </span>
                    <Image
                      src={entry.profilePicture}
                      alt={entry.firstName}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-semibold truncate">
                        {entry.firstName}
                      </span>
                      {isCurrentUser && <YouTag />}
                    </span>
                    {!isAllTime && (
                      <ChangeBadge change={entry.positionChange || 0} />
                    )}
                    <span className="w-16 text-right">
                      <span className="font-display text-2xl font-bold tabular-nums">
                        {entry.totalPoints}
                      </span>
                      <span className="ml-1 text-xs text-muted">pts</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      {showPopup && user && (
        <EnableNotificationsPopup
          onConfirm={async () => {
            await subscribeToPushNotifications(user);
            setShowPopup(false);
          }}
          onDismiss={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}

// Gold / silver / bronze, indexed by podium position (0 = first).
const MEDALS = [
  { ring: "ring-[#f5b301]", badge: "bg-[#f5b301] text-black", block: "h-24" },
  { ring: "ring-[#c0c7d1]", badge: "bg-[#c0c7d1] text-black", block: "h-16" },
  { ring: "ring-[#cd7f32]", badge: "bg-[#cd7f32] text-white", block: "h-12" },
];

function PodiumSpot({ entry, place, rank, isCurrentUser, showChange }) {
  const medal = MEDALS[place];
  const size = place === 0 ? 72 : 56;

  return (
    <div className="flex flex-col items-center min-w-0">
      <div className="relative">
        <Image
          src={entry.profilePicture}
          alt={entry.firstName}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className={`rounded-full object-cover ring-4 ${medal.ring}`}
        />
        <span
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 grid place-items-center h-6 min-w-6 px-1 rounded-full text-xs font-bold shadow ${medal.badge}`}
        >
          {rank}
        </span>
      </div>
      <span className="mt-3 max-w-full truncate font-semibold text-sm">
        {entry.firstName}
        {isCurrentUser && " (You)"}
      </span>
      <span
        className={`font-display font-extrabold tabular-nums leading-none ${
          place === 0 ? "text-4xl" : "text-3xl"
        }`}
      >
        {entry.totalPoints}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
        pts
      </span>
      {showChange && (
        <span className="mt-1 h-5">
          <ChangeBadge change={entry.positionChange || 0} onDark />
        </span>
      )}
      <div
        className={`mt-2 w-full rounded-t-xl bg-white/15 ring-1 ring-white/20 ${medal.block}`}
      />
    </div>
  );
}

function ChangeBadge({ change, onDark = false }) {
  if (change === 0) {
    return (
      <span
        className={`inline-block w-10 text-center text-sm ${onDark ? "text-white" : "text-muted"}`}
      >
        —
      </span>
    );
  }
  const up = change > 0;
  const tone = onDark
    ? "bg-black/25 text-white"
    : up
      ? "bg-success/15 text-success"
      : "bg-danger/15 text-danger";

  return (
    <span
      className={`inline-flex items-center justify-center gap-0.5 w-10 py-0.5 rounded-full text-xs font-bold ${tone}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(change)}
    </span>
  );
}

function YouTag() {
  return (
    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-accent text-white text-[10px] font-bold uppercase tracking-wider">
      You
    </span>
  );
}
