"use client";

import { useEffect, useState } from "react";
import { subscribeToPushNotifications } from "@/lib/pushUtils";

export default function DebugPushPage() {
  const [permission, setPermission] = useState("unknown");
  const [subscription, setSubscription] = useState(null);
  const [log, setLog] = useState([]);

  const logLine = (msg) => setLog((prev) => [...prev, msg]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      logLine("❌ Service workers not supported.");
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => {
        logLine("✅ Service worker is ready.");
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (sub) {
          logLine("✅ Push subscription exists.");
          setSubscription(sub.toJSON());
        } else {
          logLine("❌ No push subscription found.");
        }
      });

    setPermission(Notification.permission);
  }, []);

  const testLocalNotification = async () => {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification("🔔 Test Notification (Local)", {
      body: "This is a direct test via showNotification().",
      icon: "/icons/app-icon.png",
      data: { url: "/" },
    });
    logLine("✅ Local notification triggered.");
  };

  const resubscribe = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("authUser")); // or use your real user object
      if (!user?.uid) {
        logLine("❌ No user found. You must be logged in.");
        return;
      }

      await subscribeToPushNotifications(user);
      logLine("✅ Re-subscribed and saved to Firestore.");
    } catch (err) {
      logLine("❌ Failed to re-subscribe: " + err.message);
    }
  };

  return (
    <div className="p-6 text-[var(--text-color)]">
      <h1 className="text-2xl font-bold mb-4">🔍 Push Debug Page</h1>

      <p>
        <strong>Notification permission:</strong> {permission}
      </p>
      <p>
        <strong>Subscription:</strong>
      </p>
      <pre className="bg-gray-100 text-sm p-2 rounded-sm mb-4 max-w-full overflow-auto text-black">
        {subscription ? JSON.stringify(subscription, null, 2) : "None"}
      </pre>

      <div className="flex gap-4 mb-4">
        <button
          onClick={testLocalNotification}
          className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600"
        >
          Trigger Local Notification
        </button>
        <button
          onClick={resubscribe}
          className="px-4 py-2 bg-green-500 text-white rounded-sm hover:bg-green-600"
        >
          Re-subscribe to Push
        </button>
      </div>

      <div className="mt-4 bg-gray-200 p-3 rounded-sm text-black">
        <p className="font-semibold mb-2">Debug Log:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
