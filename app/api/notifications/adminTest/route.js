// app/api/notifications/adminTest/route.js
import { sendNotificationToUser } from "@/lib/sendNotification";
import { verifyAdminIdToken } from "@/lib/verifyRequest";

export async function POST(req) {
  const uid = await verifyAdminIdToken(req);
  if (!uid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sendNotificationToUser({
      title: "Test Notification",
      body: "This is a test push notification from the Admin Dashboard.",
      url: "/",
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Error sending admin test notification:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
