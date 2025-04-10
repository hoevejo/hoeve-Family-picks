export async function subscribeUserToPush() {
  if (!("serviceWorker" in navigator)) return console.warn("SW not supported");
  if (!("PushManager" in window)) return console.warn("Push not supported");

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
  };

  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ),
    });

    return subscription.toJSON(); // You send this to Firestore
  } catch (error) {
    console.error("Push subscription error:", error);
    return null;
  }
}
