// Single source of truth for seasonType and week-scoped doc IDs -- used to
// be stored 5 different ways across the app. No Firebase imports, safe from
// both "use client" pages and Admin SDK job files.

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

// Explicit params -- the bare endpoint returns whatever week ESPN
// considers "current," which can disagree with the week being processed.
export function espnScoreboardUrl({ seasonYear, seasonType, week }) {
  const params = new URLSearchParams({
    year: String(seasonYear),
    seasontype: String(espnSeasonTypeNum(seasonType)),
    week: String(week),
  });
  return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?${params}`;
}
