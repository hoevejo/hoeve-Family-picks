# Firestore schema

Firestore has no schema of its own — this is the reference for what's actually
there, since the collections and doc shapes only otherwise live in scattered
job/route code. Keep this in sync when a shape changes; it's a reference, not
a spec enforced anywhere.

Access rules are in [`firestore.rules`](../firestore.rules); this doc covers
shapes and ID conventions, which the rules file doesn't.

## ID & naming conventions — `lib/seasonType.js`

Never hand-roll any of these; import from `lib/seasonType.js`.

- **`seasonType`** is always the lowercase slug `"regular"` or `"postseason"`
  (`normalizeSeasonType(raw)` — accepts any casing/prefix, e.g. `"Postseason"`,
  `"POST"`).
- **`weekKey({ seasonYear, seasonType, week })`** → `"{year}-{seasonType}-week{week}"`
  (e.g. `2026-regular-week5`). Base key for `games`, `picks`, and `history` doc
  IDs.
- **`gameDocId({ ...weekKey fields, gameId })`** → `"{weekKey}-{gameId}"`
- **`picksDocId({ ...weekKey fields, uid })`** → `"{weekKey}-{uid}"`
- **`leaderboardScope(seasonType)`** → `"regular"` | `"postseason"` — which
  `leaderboards/{scope}` a season type accumulates into.

## Collections

### `users/{uid}`

The private, full account doc.

```
uid, firstName, lastName, fullName, displayName, email, createdAt (Timestamp),
profilePicture, isAdmin, notificationsEnabled, theme
```

- Read: owner or admin. Create/update: owner only, and `isAdmin` can't be
  changed by the owner (rules compare `request.resource.data.isAdmin ==
resource.data.isAdmin`) — that's what stops a self-escalation.
- Subcollection **`notificationSubscriptions/{subId}`** — raw Web Push
  subscription objects (`endpoint`, `keys`, …). Owner read/write only.

### `publicProfiles/{uid}`

World-readable subset, so pages don't need the full `users` doc (email,
`isAdmin`) just to show a name/avatar.

```
uid, firstName, lastName, fullName, displayName, profilePicture
```

Read: any signed-in user. Write: owner only.

### `config/config`

Single doc — the active season/week state.

```
week, seasonYear, seasonType, deadline (Timestamp), endOfSeason (Timestamp | null),
recapWeek, gameOfTheWeekId, wagerMaxPoints, lastArchive: { archiveId, createdAt },
lastUpdated (ISO string)
```

Read: signed-in. Write: admin only.

### `games/{gameDocId}`

One doc per game per week. `id` = `gameDocId(...)`.

```
id, name, shortName, date (ISO string), status, seasonType, seasonYear, week,
homeTeam: { id, name, mascot, abbreviation, score, logo, record },
awayTeam: { same shape },
winnerId, hasResult, lastUpdated (ISO string)
```

Read: signed-in. Write: rules always `false` — only the Admin SDK jobs write
here (`jobs/updateGames.js`, `jobs/updateIsCorrect.js`), which bypass rules
entirely.

### `picks/{picksDocId}`

One doc per user per week. `id` = `picksDocId(...)`.

```
userId, seasonYear, seasonType, week, fullName,
predictions: { [gameId]: { teamId, isCorrect: bool | null } },
wager?: { gameId, teamId, points, placedAt (ISO string) },
wagerResult?: { outcome: "win" | "lose" | "push", applied, gradedAt (ISO string) }
```

Read: signed-in. Create/update: only where `request.resource.data.userId ==
request.auth.uid` — enforced via `verifyIdToken()` (`lib/verifyRequest.js`) in
the API routes, not a client-supplied `userId`. Delete: always `false`.

Writing `predictions.{gameId}.isCorrect` **must** go through `.update()`, not
`.set(..., { merge: true })` — merge writes a dotted key as a literal field
name instead of nesting it. `app/api/placeWager/route.js` does a `.set()` to
create the doc, then a separate `.update()` for exactly this reason.

### `leaderboards/{scope}/entries/{uid}`

`scope` ∈ `regular` | `postseason` | `allTime` | `lifetime`.

- **`regular` / `postseason`**:
  `{ uid, totalPoints, lastWeekPoints, lastGradedKey, currentRank, previousRank, positionChange }`
- **`allTime`**: same idea, accumulates across `regular` + `postseason` grading
  within a season; reset alongside them on a season reset.
- **`lifetime`**: `{ uid, totalPoints, seasonsPlayed, lastSeasonPoints, updatedAt }`
  — career total across seasons. Only ever written by
  `jobs/newSeason.js` during a season reset; deliberately **not** reset.

Read: signed-in. Write: always `false` (Admin SDK only —
`jobs/calculateWeeklyResults.js` grades into `regular`/`postseason`/`allTime`;
registration seeds a zeroed entry in each).

`fullName`/`profilePicture` are **not** stored here even on older docs that
still carry them — the UI always joins against `publicProfiles` for display
fields.

### `history/{weekKey}`

One doc per graded week, written by `jobs/calculateWeeklyResults.js`. `id` =
`weekKey(...)` (no trailing `-{uid}` — this is a per-week doc, not per-user).

```
week, seasonType, seasonYear,
leaderboard: [ /* the post-grading leaderboards/{scope}/entries snapshot */ ],
recap: { highestScore, lowestScore, topScorers, lowestScorers, biggestRisers,
         biggestFallers, scores: [{ uid, fullName, score }] },
picks: [ { userId, fullName, predictions, wager?, wagerResult? } ],  // full graded picks, stands alone after a season archive
games: [ { id, name, homeTeam, awayTeam, winnerId } ],               // compact, for the Weekly Matchups view
gameOfTheWeekId, createdAt (Timestamp)
```

Read: signed-in. Write: always `false`.

`weeklyRecap` is a **retired** collection — `app/recap/page.js` reads
`history/{weekKey}.recap` instead. If you find references to `weeklyRecap`,
they're stale.

### `seasonArchives/{archiveId}`

Written once per season reset by `jobs/newSeason.js`.
`archiveId` = `"{seasonYear}-{seasonType}-reset-{Date.now()}"`.

```
createdAt (Date), seasonYear, seasonType, archivedCollections: string[],
docCounts: { [collectionName]: number }
```

- Subcollections **`seasonArchives/{archiveId}/{collectionName}/{docId}`** —
  raw copies of every `games` and `picks` doc, taken right before they're
  deleted from the live collections.
- Read: admin only. Write: always `false`.

## Season reset (`jobs/newSeason.js`)

On reset: `games` and `picks` are archived into `seasonArchives/{archiveId}`
then deleted from the live collections; `leaderboards/allTime` is folded into
`leaderboards/lifetime` (additive, never zeroed); `regular`, `postseason`, and
`allTime` entries are reset to zero. `history` is **not** touched — it's the
permanent record.
