import { saveSubscriptionToFirestore } from "./saveSubscription";

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

    // Subscribe user to push notifications
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      ),
    });

    // Save subscription to Firestore
    await saveSubscriptionToFirestore(user.uid, subscription.toJSON());

    console.log("Push subscription completed successfully.");
  } catch (err) {
    console.error("Push subscription failed:", err);
  }
}
