// app/api/notifications/send/route.js
import webpush from "web-push";
import { db } from "@/lib/firebaseAdmin";
import { getDocs, collectionGroup } from "firebase/firestore";

const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export async function POST(request) {
  // ✅ Secure the route with your secret
  const authHeader = request.headers.get("authorization");
  const expectedSecret = `Bearer ${process.env.NOTIFICATION_SECRET}`;

  if (authHeader !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, body } = await request.json();

    const subsSnap = await getDocs(
      collectionGroup(db, "notificationSubscriptions")
    );

    const sendPromises = subsSnap.docs.map((docSnap) => {
      const sub = docSnap.data();
      return webpush.sendNotification(sub, JSON.stringify({ title, body }));
    });

    await Promise.allSettled(sendPromises);

    return Response.json({ success: true, sent: sendPromises.length });
  } catch (err) {
    console.error("Push send error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
