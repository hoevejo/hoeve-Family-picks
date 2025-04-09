import { saveSubscriptionToFirestore } from "./saveSubscription";
import { sendNotificationToUser } from "./sendNotification";

// Helper to convert VAPID public key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPushNotifications(user) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push not supported on this browser.");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ),
    });

    // Save the subscription to Firestore
    await saveSubscriptionToFirestore(user.uid, subscription.toJSON());

    // Send a test notification
    await sendNotificationToUser(user.uid, {
      title: "You're subscribed! 🎉",
      body: "You’ll now get reminders for your weekly picks. 🏈",
    });

    console.log("✅ Push subscription completed successfully.");
  } catch (err) {
    console.error("❌ Push subscription failed:", err);
  }
}
