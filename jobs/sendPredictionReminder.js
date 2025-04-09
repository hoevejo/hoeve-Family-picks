import { db } from "@/lib/firebaseAdmin";
import { sendNotification } from "@/lib/sendNotification"; // your helper

export async function sendPredictionReminder() {
  const configSnap = await db.doc("config/config").get();
  if (!configSnap.exists) {
    throw new Error("No config found.");
  }

  const { week, seasonType, deadline } = configSnap.data();

  const deadlineDate = deadline.toDate();
  const formattedTime = deadlineDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

  const title = "⏰ Last Chance!";
  const body = `Get your predictions in for ${seasonType} Week ${week} before ${formattedTime} ET.`;

  await sendNotification({ title, body });
  console.log("📣 Sent prediction reminder.");
  return { success: true };
}
