export async function sendNotificationToUser({ title, body, url }) {
  try {
    console.log("Sending notification:", { title, body, url });

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

    if (!res.ok) {
      throw new Error(`Failed to send notification: ${res.statusText}`);
    }

    const responseJson = await res.json();
    console.log("Notification response:", responseJson);

    return responseJson; // Return the parsed response
  } catch (error) {
    console.error("Error sending notification:", error);
    return { success: false, message: error.message }; // Return error message
  }
}
