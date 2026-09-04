export const runtime = "nodejs";

import { calculateWeeklyResults } from "@/jobs/calculateWeeklyResults";
import { updateIsCorrectJob } from "@/jobs/updateIsCorrect";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // updateIsCorrect is the only job that writes winnerId/hasResult back
    // onto game docs (it fetches ESPN's live scoreboard directly) --
    // calculateWeeklyResults has its own ESPN-fallback so it isn't strictly
    // blocked without this, but without it games/picks in the UI stay stuck
    // showing pre-game state and calculateWeeklyResults redundantly re-hits
    // ESPN every run. Vercel Hobby caps cron jobs at 2, already in use by
    // this route + fetchGames, so this runs in-process rather than getting
    // its own schedule.
    const gradingResult = await updateIsCorrectJob();
    const result = await calculateWeeklyResults();
    return NextResponse.json({ gradingResult, ...result });
  } catch (error) {
    console.error("Error during calculateWeeklyResults:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
