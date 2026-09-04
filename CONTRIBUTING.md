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

`vercel.json` runs two crons (UTC):

| Endpoint                           | When      | Purpose                                                          |
| ---------------------------------- | --------- | ---------------------------------------------------------------- |
| `/api/jobs/fetchGames`             | Wed 10:00 | pull the week's games from ESPN, set deadline + Game of the Week |
| `/api/jobs/calculateWeeklyResults` | Tue 07:00 | grade picks, apply wagers, update leaderboards, write the recap  |

`updateIsCorrect`, `sendPredictionReminder`, `clearForNewSeason` are manual.
Notification/cron endpoints expect `Authorization: Bearer $NOTIFICATION_SECRET`.

## Known follow-ups

Tracked in `dev-setup/CHECKLIST.md` §8–13: dependency upgrades (Next 16, Firebase
12, Tailwind 4), the broken push-notification + season-reset jobs, Firestore
security rules, the ad-hoc data model, and adding a test suite.
