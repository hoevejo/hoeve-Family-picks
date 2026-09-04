export const runtime = "nodejs";

import { calculateWeeklyResults } from "@/jobs/calculateWeeklyResults";
import { updateIsCorrectJob } from "@/jobs/updateIsCorrect";
import { verifyCronSecret } from "@/lib/verifyRequest";
import { NextResponse } from "next/server";

export async function GET(req) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // In-process, not its own cron -- Vercel Hobby caps at 2, already used
    // by this route + fetchGames. Also marks games final before grading.
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
