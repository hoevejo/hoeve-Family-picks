export const runtime = "nodejs";

import { updateIsCorrectJob } from "@/jobs/updateIsCorrect";
import { verifyCronSecret } from "@/lib/verifyRequest";

// Machine-triggered, not human-triggered: meant to be hit repeatedly
// through the week (as games go final) by an external scheduler -- Vercel
// Hobby's 2-cron-job cap is already spent on fetchGames +
// calculateWeeklyResults, so this isn't a vercel.json cron. See
// CONTRIBUTING.md's "Scheduled jobs" section for how it's wired up.
// CRON_SECRET, same as the other two job routes, not an admin ID token.
export async function GET(req) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await updateIsCorrectJob();
    return Response.json(result);
  } catch (error) {
    console.error("Error during updateIsCorrect:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
