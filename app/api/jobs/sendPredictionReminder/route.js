export const runtime = "nodejs";

import { sendPredictionReminder } from "@/jobs/sendPredictionReminder";
import { verifyCronSecret } from "@/lib/verifyRequest";

// Machine-triggered by an external scheduler, same as updateIsCorrect --
// CRON_SECRET, not NOTIFICATION_SECRET (that's for our own server-to-server
// calls to /api/notifications/send).
export async function GET(req) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendPredictionReminder();
    return Response.json(result);
  } catch (err) {
    console.error("Reminder error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
