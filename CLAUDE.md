# NFL Pick'em — project notes for Claude

Family NFL pick'em app. Next.js App Router + Firebase (Auth + Firestore),
deployed on Vercel with cron jobs.

## This repo is mid-cleanup

Active worklist: `../dev-setup/CHECKLIST.md` (sections 5–13). Expect churn in
dependencies, file structure, and the Firestore model. Don't assume how
something "should" work without checking.

## Layout

- `app/` — pages (all `"use client"`, auth-gated) + `app/api/` route handlers
- `app/api/jobs/*` — thin wrappers that call `jobs/*`
- `jobs/` — job logic, uses the **Firebase Admin SDK** (`lib/firebaseAdmin.js`)
- `lib/firebaseConfig.js` — **client** SDK (Auth + Firestore) for the browser
- `context/AuthContext.js` — auth provider + `useAuth`
- Firestore is the source of truth; `config/config` holds the active
  week / deadline / rules

## Watch out

- Don't mix the client and admin SDKs — different APIs.
- `seasonType` is stored inconsistently ("Regular" / "regular" /
  "Regular Season" / "postseason"). Normalizing it is a known task.
- Needs `.env.local` to run (`vercel env pull`). Build works without it.

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- No test suite yet.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
