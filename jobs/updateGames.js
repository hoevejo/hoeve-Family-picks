import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import fetch from "node-fetch";
import { sendNotificationToUser } from "../lib/sendNotification";

/**
 * Fetch and store games for a target week.
 * If config.deadline has passed (and no explicit week is provided), it advances to next week.
 *
 * @param {Object} opts
 *   - week?: number
 *   - seasonYear?: number
 *   - seasonType?: "Regular" | "Postseason"
 *   - useNextWeek?: boolean
 */
export async function fetchAndStoreGames(opts = {}) {
  // ---- read current config
  const cfgRef = db.doc("config/config");
  const cfgSnap = await cfgRef.get();
  const cfg = cfgSnap.exists ? cfgSnap.data() || {} : {};

  const cfgSeasonYear = Number(
    opts.seasonYear ?? cfg.seasonYear ?? new Date().getFullYear()
  );
  const cfgSeasonType = String(opts.seasonType ?? cfg.seasonType ?? "Regular"); // "Regular" | "Postseason"
  const cfgWeek = Number(opts.week ?? cfg.week ?? 1);

  // Should we fetch next week?
  const deadlineMs = cfg?.deadline?.toDate
    ? cfg.deadline.toDate().getTime()
    : cfg?.deadline?.seconds
    ? cfg.deadline.seconds * 1000
    : null;
  const deadlinePassed =
    typeof deadlineMs === "number" ? Date.now() > deadlineMs : false;
  const useNextWeek = Boolean(
    opts.useNextWeek || (!opts.week && deadlinePassed)
  );

  const targetWeek = useNextWeek ? cfgWeek + 1 : cfgWeek;
  const targetYear = cfgSeasonYear;
  const seasonTypeNum = cfgSeasonType.toLowerCase() === "postseason" ? 3 : 2; // 2=Regular, 3=Postseason
  const seasonTypeDisplay = seasonTypeNum === 3 ? "Postseason" : "Regular";
  const seasonTypeSlug = seasonTypeDisplay.toLowerCase();

  // ---- ESPN for explicit target
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?year=${targetYear}&seasontype=${seasonTypeNum}&week=${targetWeek}`;
  const res = await fetch(url);
  const data = await res.json();

  const games = data?.events || [];
  if (!games.length) {
    return {
      success: false,
      message: `No games found for year=${targetYear}, type=${seasonTypeNum}, week=${targetWeek}`,
    };
  }

  // End-of-season guard
  const leagueEndDateStr = data?.leagues?.[0]?.season?.endDate;
  const leagueEndDate = leagueEndDateStr ? new Date(leagueEndDateStr) : null;
  if (leagueEndDate && Date.now() > leagueEndDate.getTime()) {
    return { success: false, message: "Season is over. Skipping fetch." };
  }

  // earliest kickoff -> deadline
  const earliestGame = games.reduce((earliest, cur) =>
    new Date(cur.date) < new Date(earliest.date) ? cur : earliest
  );

  // ---- write games (batch)
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

    // derive winner if flag missing but final scores differ
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

    const docId = `${targetYear}-${seasonTypeSlug}-week${targetWeek}-${gameId}`;
    const ref = db.doc(`games/${docId}`);

    batch.set(
      ref,
      {
        id: gameId,
        name: ev.name,
        shortName: ev.shortName,
        date: ev.date, // ISO
        status: statusName,
        seasonType: seasonTypeDisplay,
        seasonYear: targetYear,
        week: targetWeek,
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

  // ---- update config for the TARGET week

  const prev = cfg || {};
  const prevWeek = Number(prev.week ?? 0);

  // Keep existing GOTW if it's the same week; otherwise pick RANDOM
  let gameOfTheWeekId =
    prevWeek === targetWeek && prev.gameOfTheWeekId
      ? String(prev.gameOfTheWeekId)
      : null;

  if (!gameOfTheWeekId) {
    // Seeded random so it’s consistent for a given (year,type,week)
    const seed = `${targetYear}-${seasonTypeSlug}-week${targetWeek}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    // xorshift-ish
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const rand01 = ((h >>> 0) % 1_000_000) / 1_000_000;

    const idx = Math.floor(rand01 * games.length);
    // If you want *true* randomness instead, replace the 3 lines above with:
    // const idx = Math.floor(Math.random() * games.length);

    gameOfTheWeekId = String(games[idx].id);
  }

  await cfgRef.set(
    {
      week: targetWeek,
      seasonYear: targetYear,
      seasonType: seasonTypeDisplay,
      seasonTypeSlug,
      deadline: Timestamp.fromDate(new Date(earliestGame.date)),
      endOfSeason: leagueEndDate
        ? Timestamp.fromDate(leagueEndDate)
        : prev.endOfSeason || null,
      recapWeek: Math.max(0, targetWeek - 1),
      gameOfTheWeekId,
      lastUpdated: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    success: true,
    count: games.length,
    week: targetWeek,
    gameOfTheWeekId,
  };
}
