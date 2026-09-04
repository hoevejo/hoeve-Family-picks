# NFL Pick'em

A family NFL Pick'em app. Predict weekly game winners, track standings on a
leaderboard, risk points on a weekly Game of the Week wager, and browse past
weeks' recaps and history.

## Features

- User accounts via Firebase Authentication
- Weekly predictions with deadlines, pulled from ESPN's live scoreboard
- Leaderboard with Regular Season, Postseason, and All-Time tabs
- Game of the Week wager — risk points (capped) for a shot at extra ones
- Weekly recaps and a full season/history archive
- Push notifications for reminders and results (PWA-compatible)
- Custom avatar picker and theme support

## Tech stack

- **Frontend**: Next.js (App Router), Tailwind CSS
- **Backend**: Firebase Authentication & Firestore, with `firestore.rules`
  enforcing access
- **Jobs**: Vercel cron (`fetchGames`, `calculateWeeklyResults`) plus an
  externally-scheduled `updateIsCorrect` — see [`CONTRIBUTING.md`](CONTRIBUTING.md#scheduled-jobs)
- **Notifications**: Web Push, Firestore-backed subscriptions
- **Hosting**: Vercel

## Getting started

```bash
pnpm install
vercel env pull .env.local      # or: cp .env.example .env.local and fill in
pnpm run dev                    # http://localhost:3000
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full setup, command
reference, and how the scheduled jobs are wired up.

## Layout

```
app/            pages ("use client", auth-gated) + app/api/ route handlers
jobs/           job logic, uses the Firebase Admin SDK
lib/            firebaseConfig.js (client SDK), firebaseAdmin.js (Admin SDK),
                seasonType.js (canonical week/season-type helpers)
context/        AuthContext.js — auth provider + useAuth
components/     shared UI components
scripts/        one-off Admin SDK scripts (schema migration, season reset)
```

See [`CLAUDE.md`](CLAUDE.md) for more detail on the layout and Firestore model.

---

Built by Jon Hoeve for family and friends.
