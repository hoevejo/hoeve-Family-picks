// /lib/sendNotification.js
export async function sendNotificationToUser({ title, body }) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""); // Remove trailing slash if any

  return await fetch(`${baseUrl}/api/notifications/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTIFICATION_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body }),
  });
}
