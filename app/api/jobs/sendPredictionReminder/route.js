export const runtime = "nodejs";

import { sendPredictionReminder } from "@/jobs/sendPredictionReminder";

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.NOTIFICATION_SECRET;

  if (authHeader !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const result = await sendPredictionReminder();
    return Response.json(result);
  } catch (err) {
    console.error("Reminder error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
