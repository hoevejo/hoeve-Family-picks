// Single source of truth for seasonType representation and week-scoped doc IDs.
// Historically this app stored seasonType as "Regular" / "Regular Season" /
// "regular" / "Postseason" / "postseason" interchangeably across ~10 files,
// each with its own ad-hoc normalization. Everything should go through here
// instead. Pure string logic, no Firebase imports — safe from both
// "use client" pages and Admin SDK job files.

export const SEASON_TYPES = Object.freeze({
  REGULAR: "regular",
  POSTSEASON: "postseason",
});

export function normalizeSeasonType(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  return s.startsWith("post") ? SEASON_TYPES.POSTSEASON : SEASON_TYPES.REGULAR;
}

export function seasonTypeLabel(rawOrSlug) {
  return normalizeSeasonType(rawOrSlug) === SEASON_TYPES.POSTSEASON
    ? "Postseason"
    : "Regular Season";
}

export function weekKey({ seasonYear, seasonType, week }) {
  return `${seasonYear}-${normalizeSeasonType(seasonType)}-week${week}`;
}

export function gameDocId({ seasonYear, seasonType, week, gameId }) {
  return `${weekKey({ seasonYear, seasonType, week })}-${gameId}`;
}

export function picksDocId({ seasonYear, seasonType, week, uid }) {
  return `${weekKey({ seasonYear, seasonType, week })}-${uid}`;
}

export function leaderboardScope(seasonType) {
  return normalizeSeasonType(seasonType) === SEASON_TYPES.POSTSEASON
    ? "postseason"
    : "regular";
}

// ESPN's own season-type numbering: 2 = Regular season, 3 = Postseason.
export function espnSeasonTypeNum(seasonType) {
  return normalizeSeasonType(seasonType) === SEASON_TYPES.POSTSEASON ? 3 : 2;
}

// Always pass explicit year/seasontype/week — the bare scoreboard endpoint
// returns whatever week ESPN itself considers "current" today, which can
// silently disagree with the week actually being processed.
export function espnScoreboardUrl({ seasonYear, seasonType, week }) {
  const params = new URLSearchParams({
    year: String(seasonYear),
    seasontype: String(espnSeasonTypeNum(seasonType)),
    week: String(week),
  });
  return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?${params}`;
}
