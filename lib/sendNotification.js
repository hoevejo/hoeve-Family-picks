// lib/sendNotification.js
export async function sendNotificationToUser({ title, body }) {
  return await fetch(`/api/notifications/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTIFICATION_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body }),
  });
}
