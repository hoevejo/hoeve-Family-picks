// app/api/notifications/send/route.js
import webpush from "web-push";
export const runtime = "nodejs";

import { db } from "@/lib/firebaseAdmin";
import { getDocs, collectionGroup } from "firebase/firestore";

// Configure VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  // ✅ Check for authorization header
  const authHeader = request.headers.get("authorization");
  const expectedSecret = `Bearer ${process.env.NOTIFICATION_SECRET}`;

  if (authHeader !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Accept title, body, and optional URL
    const { title, body, url } = await request.json();
    const payload = JSON.stringify({ title, body, url });

    // Grab all subscriptions from all users
    const subsSnap = await getDocs(
      collectionGroup(db, "notificationSubscriptions")
    );

    let successCount = 0;
    let errorCount = 0;

    const sendPromises = subsSnap.docs.map(async (docSnap) => {
      const subscription = docSnap.data();

      try {
        await webpush.sendNotification(subscription, payload);
        successCount++;
      } catch (err) {
        console.error("❌ Failed to send push:", err.message);

        // Clean up expired/invalid subscriptions
        if (
          err.statusCode === 410 || // Gone
          err.statusCode === 404 || // Not found
          err.message?.includes("unsubscribed") ||
          err.message?.includes("invalid")
        ) {
          await docSnap.ref.delete();
          console.log("🧹 Deleted expired subscription");
        }

        errorCount++;
      }
    });

    await Promise.allSettled(sendPromises);

    return Response.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      total: subsSnap.size,
    });
  } catch (err) {
    console.error("⚠️ Notification error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
