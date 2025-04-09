import { saveSubscriptionToFirestore } from "./saveSubscription";
import { sendNotificationToUser } from "./sendNotification"; // Assuming you export this

export async function subscribeToPushNotifications(user) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push not supported on this browser.");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    // Save subscription in Firestore
    await saveSubscriptionToFirestore(user.uid, subscription.toJSON());

    // Send test notification
    await sendNotificationToUser(user.uid, {
      title: "You're subscribed!",
      body: "You’ll now get reminders for your weekly picks. 🏈",
    });
  } catch (err) {
    console.error("❌ Push subscription failed:", err);
  }
}
