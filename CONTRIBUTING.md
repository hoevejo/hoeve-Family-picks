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

`/api/jobs/clearForNewSeason` is manual — destructive, admin-triggered from
the "Clear & Archive Season" button, gated on the calling admin's Firebase ID
token. `sendPredictionReminder` isn't wired to anything yet (tracked
separately, not part of the Firestore schema cleanup).

## Known follow-ups

Tracked in `dev-setup/CHECKLIST.md`: the notifications overhaul (`notifications/send`
mixes the client and Admin SDKs; `sendPredictionReminder` isn't scheduled),
writing the Firestore schema down as a doc, and adding a test suite.
