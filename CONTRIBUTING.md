# Contributing

General branch / commit / PR conventions and the session routine live in the
`dev-setup` repo (`docs/workflow.md`, `docs/session-routine.md`). This file is
the pickem-specific bits.

## Setup

Requires **Node 22** (see `.nvmrc` — `fnm` switches automatically) and
**pnpm** (see `package.json` → `packageManager` — `corepack enable` picks up
the pinned version automatically).

```bash
pnpm install
vercel env pull .env.local      # or: cp .env.example .env.local and fill in
pnpm run dev                    # http://localhost:3000
```

`pnpm run build` works without `.env.local`; `pnpm run dev` needs the real
values to actually sign in or read data.

## Commands

|                                     |                                                        |
| ----------------------------------- | ------------------------------------------------------ |
| `pnpm run dev`                      | dev server                                             |
| `pnpm run build` / `pnpm run start` | production build / serve                               |
| `pnpm run lint`                     | ESLint                                                 |
| `pnpm run format`                   | Prettier write (the pre-commit hook also does this)    |
| `pnpm run check`                    | `format:check` + `lint` + `build` — run before pushing |

## Layout

See [`CLAUDE.md`](CLAUDE.md) for the map (app / jobs / lib split, the client vs
Admin SDK boundary, Firestore collections).

## Scheduled jobs

`vercel.json` runs two crons (UTC) — Vercel's Hobby plan caps a project at 2
cron jobs, each at most once/day, so that's the whole budget:

| Endpoint                           | When      | Purpose                                                                                                 |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `/api/jobs/fetchGames`             | Wed 10:00 | pull the week's games from ESPN, set deadline + Game of the Week                                        |
| `/api/jobs/calculateWeeklyResults` | Tue 07:00 | runs `updateIsCorrect` first, then grades picks, applies wagers, updates leaderboards, writes `history` |

Both are gated on `CRON_SECRET` — Vercel auto-attaches
`Authorization: Bearer $CRON_SECRET` to its own cron-triggered requests once
that env var exists, no extra wiring needed.

`/api/jobs/updateIsCorrect` marks individual games final and grades their
predictions as results come in — it's what makes picks show
correct/incorrect live during the week, before Tuesday's full grading run.
It needs to run repeatedly through game days (Thu/Sun/Mon), which doesn't
fit in the 2-cron budget above, so it's meant to be called by an **external**
scheduler — e.g. [cron-job.org](https://cron-job.org) (free, no account
limits that matter here): point it at
`https://<your-domain>/api/jobs/updateIsCorrect`, every 15–30 min, with
header `Authorization: Bearer <CRON_SECRET>`. It's a cheap no-op when
nothing's changed, so a simple always-on interval (no day/hour restriction)
is fine. Also gated on `CRON_SECRET`, same as the two Vercel crons.

`/api/jobs/sendPredictionReminder` needs the same external-scheduler setup as
`updateIsCorrect` — a second cron-job.org entry at
`https://<your-domain>/api/jobs/sendPredictionReminder`, every 15–30 min,
header `Authorization: Bearer <CRON_SECRET>`. It only actually sends a push
once the deadline is within 1 hour, and at most once per week (tracked on
`config/config.lastReminderSentFor`), so the frequent polling is cheap.

`/api/jobs/clearForNewSeason` is manual — destructive, admin-triggered from
the "Clear & Archive Season" button, gated on the calling admin's Firebase ID
token.

## Push notifications

Three triggers, each firing from the job that causes the underlying event —
not on their own schedule:

| When                            | Where it's sent from                         |
| ------------------------------- | -------------------------------------------- |
| Predictions open for a new week | `jobs/updateGames.js`, only on a week change |
| Deadline approaching            | `jobs/sendPredictionReminder.js`             |
| Weekly results calculated       | `jobs/calculateWeeklyResults.js`             |

All three call `lib/sendNotification.js`'s `sendNotificationToUser()`, which
POSTs to `/api/notifications/send` (gated on `NOTIFICATION_SECRET`, a
server-to-server call — not the same secret as the cron routes above). That
route sends via `web-push` to every subscription in the
`notificationSubscriptions` collection group, pruning any that come back
expired/invalid.

## Known follow-ups

Tracked in `dev-setup/CHECKLIST.md`: writing the Firestore schema down as a
doc, and adding a test suite.
