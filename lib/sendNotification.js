export async function sendNotificationToUser({ title, body, url }) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTIFICATION_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, url }),
    }
  );

  return res.json(); // Optional: return parsed response
}
