import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import fetch from "node-fetch";
import { sendNotificationToUser } from "../lib/sendNotification";

export async function fetchAndStoreGames() {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );
  const data = await res.json();

  const games = data.events || [];
  const week = Number(data.week?.number ?? 0);
  const seasonYear = Number(data.season?.year ?? 0);
  const seasonTypeDisplay = data.season?.type === 3 ? "Postseason" : "Regular";
  const seasonTypeSlug = seasonTypeDisplay.toLowerCase();

  // Skip preseason
  if (data.season?.type === 1) {
    return { success: false, message: "Preseason detected. Skipping fetch." };
  }

  // Stop if season has ended
  const leagueEndDate = new Date(data.leagues?.[0]?.season?.endDate || 0);
  if (Date.now() > leagueEndDate.getTime()) {
    return { success: false, message: "Season is over. Skipping fetch." };
  }

  if (!games.length) {
    return {
      success: false,
      message: "No games found for this scoreboard window.",
    };
  }

  // Earliest kickoff for deadline
  const earliestGame = games.reduce((earliest, cur) =>
    new Date(cur.date) < new Date(earliest.date) ? cur : earliest
  );

  // ----- write games (batch) -----
  const batch = db.batch();

  for (const ev of games) {
    const gameId = String(ev.id);
    const competition = ev.competitions?.[0] || {};
    const competitors = competition.competitors || [];

    const compStatus = competition.status || {};
    const evtStatus = ev.status || {};
    const statusName =
      compStatus?.type?.name || evtStatus?.type?.name || "STATUS_SCHEDULED";
    const isFinal =
      compStatus?.type?.completed === true ||
      compStatus?.type?.state === "post" ||
      evtStatus?.type?.completed === true ||
      statusName === "STATUS_FINAL";

    const home = competitors.find((c) => c?.homeAway === "home") || {};
    const away = competitors.find((c) => c?.homeAway === "away") || {};

    // ESPN sometimes omits `winner`; fallback by score
    let winnerTeam = competitors.find((c) => c && c.winner === true);
    if (!winnerTeam && isFinal && competitors.length >= 2) {
      const [a, b] = competitors;
      const aScore = Number(a?.score ?? a?.score?.value ?? 0);
      const bScore = Number(b?.score ?? b?.score?.value ?? 0);
      if (!Number.isNaN(aScore) && !Number.isNaN(bScore) && aScore !== bScore) {
        winnerTeam = aScore > bScore ? a : b;
      }
    }
    const winnerId = winnerTeam?.team?.id ? String(winnerTeam.team.id) : null;

    const docId = `${seasonYear}-${seasonTypeSlug}-week${week}-${gameId}`;
    const ref = db.doc(`games/${docId}`);

    batch.set(
      ref,
      {
        id: gameId,
        name: ev.name,
        shortName: ev.shortName,
        date: ev.date, // ISO
        status: statusName,
        seasonType: seasonTypeDisplay, // keep display case
        seasonYear,
        week,
        homeTeam: {
          id: String(home?.team?.id || ""),
          name: home?.team?.displayName || "",
          mascot: home?.team?.name || "",
          abbreviation: home?.team?.abbreviation || "",
          score: Number(home?.score ?? home?.score?.value ?? 0),
          logo: home?.team?.logo || "",
          record: home?.records?.[0]?.summary || "",
        },
        awayTeam: {
          id: String(away?.team?.id || ""),
          name: away?.team?.displayName || "",
          mascot: away?.team?.name || "",
          abbreviation: away?.team?.abbreviation || "",
          score: Number(away?.score ?? away?.score?.value ?? 0),
          logo: away?.team?.logo || "",
          record: away?.records?.[0]?.summary || "",
        },
        winnerId,
        hasResult: !!(isFinal && winnerId),
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await batch.commit();

  // ----- config update (keep existing GOTW unless week changed) -----
  const cfgRef = db.doc("config/config");
  const cfgSnap = await cfgRef.get();
  const prev = cfgSnap.exists ? cfgSnap.data() || {} : {};
  const prevWeek = Number(prev.week ?? 0);

  // Choose GOTW if not set for this week (simple heuristic: pick latest kickoff)
  let gameOfTheWeekId = prevWeek === week ? prev.gameOfTheWeekId : null;
  if (!gameOfTheWeekId) {
    const latestGame = games.reduce((latest, cur) =>
      new Date(cur.date) > new Date(latest.date) ? cur : latest
    );
    gameOfTheWeekId = String(latestGame.id);
  }

  await cfgRef.set(
    {
      week,
      seasonType: seasonTypeDisplay,
      seasonYear,
      seasonTypeSlug, // handy for queries
      deadline: Timestamp.fromDate(new Date(earliestGame.date)),
      endOfSeason: Timestamp.fromDate(leagueEndDate),
      recapWeek: Math.max(0, week - 1),
      gameOfTheWeekId,
      lastUpdated: new Date().toISOString(),
    },
    { merge: true }
  );

  return { success: true, count: games.length, week, gameOfTheWeekId };
}
