import { saveSubscriptionToFirestore } from "./saveSubscription";
import { sendNotificationToUser } from "./sendNotification";

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

  // Ask permission if needed
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("🚫 Notification permission denied by user.");
      return;
    }
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ),
    });

    await saveSubscriptionToFirestore(user.uid, subscription.toJSON());

    await sendNotificationToUser({
      title: "You're subscribed! 🎉",
      body: "You’ll now get reminders for your weekly picks. 🏈",
      url: "/profile",
    });

    console.log("✅ Push subscription completed successfully.");
  } catch (err) {
    console.error("❌ Push subscription failed:", err);
  }
}
