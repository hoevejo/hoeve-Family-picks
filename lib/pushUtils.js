import { saveSubscriptionToFirestore } from "./saveSubscription";

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

    await saveSubscriptionToFirestore(user.uid, subscription.toJSON());
  } catch (err) {
    console.error("❌ Push subscription failed:", err);
  }
}
