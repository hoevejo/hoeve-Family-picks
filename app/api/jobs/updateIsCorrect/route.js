export const runtime = "nodejs";

import { updateIsCorrectJob } from "@/jobs/updateIsCorrect";
import { verifyCronSecret } from "@/lib/verifyRequest";

// Hit repeatedly through the week by an external scheduler, not a Vercel
// cron (Hobby's 2-job cap is spent) -- see CONTRIBUTING.md's setup notes.
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
