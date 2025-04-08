export async function subscribeUserToPush() {
  if (!("serviceWorker" in navigator)) return console.warn("SW not supported");
  if (!("PushManager" in window)) return console.warn("Push not supported");

  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    return subscription.toJSON(); // Save this on the server (Firestore or backend)
  } catch (error) {
    console.error("Push subscription error:", error);
    return null;
  }
}
