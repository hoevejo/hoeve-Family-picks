import { db } from "@/lib/firebaseAdmin";
import { sendNotificationToUser } from "@/lib/sendNotification";
import { seasonTypeLabel, weekKey } from "@/lib/seasonType";

// Hit every 15-30 min by an external scheduler -- only actually sends once
// the deadline is within this window, and at most once per week (tracked
// via config.lastReminderSentFor).
const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function sendPredictionReminder() {
  const configSnap = await db.doc("config/config").get();
  if (!configSnap.exists) throw new Error("Config not found");
  const cfg = configSnap.data();
  if (!cfg) throw new Error("Config doc exists but has no data");

  const { seasonYear, seasonType, week, deadline, lastReminderSentFor } = cfg;
  if (!deadline?.toDate) {
    return { success: true, skipped: "no deadline set" };
  }

  const thisWeekKey = weekKey({ seasonYear, seasonType, week });
  if (lastReminderSentFor === thisWeekKey) {
    return { success: true, skipped: "already sent for this week" };
  }

  const msUntilDeadline = deadline.toDate().getTime() - Date.now();
  if (msUntilDeadline <= 0 || msUntilDeadline > REMINDER_WINDOW_MS) {
    return { success: true, skipped: "not in reminder window" };
  }

  const formattedTime = deadline.toDate().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

  await sendNotificationToUser({
    title: "Last chance to pick!",
    body: `Get your ${seasonTypeLabel(seasonType)} Week ${week} picks in before ${formattedTime} ET.`,
    url: "/week",
  });

  await db
    .doc("config/config")
    .set({ lastReminderSentFor: thisWeekKey }, { merge: true });

  console.log(`Sent prediction reminder for ${thisWeekKey}.`);
  return { success: true, sent: true };
}
