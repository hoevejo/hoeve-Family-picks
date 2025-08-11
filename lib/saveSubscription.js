import {
  doc,
  collection,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

export async function saveSubscriptionToFirestore(uid, subscription) {
  try {
    // Validate the subscription data
    if (!subscription.endpoint || !subscription.keys) {
      throw new Error("Invalid subscription data");
    }

    const ref = collection(db, `users/${uid}/notificationSubscriptions`);

    // Check for existing subscription with the same endpoint
    const q = query(ref, where("endpoint", "==", subscription.endpoint));
    const existing = await getDocs(q);

    if (existing.empty) {
      // Add new subscription if it doesn't exist
      await addDoc(ref, subscription);
      console.log("✅ New push subscription saved");
    } else {
      console.log("ℹ️ Subscription already exists");
      return { success: true, message: "Subscription already exists" };
    }

    // Update user's notification status to enabled
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      notificationsEnabled: true,
    });

    return {
      success: true,
      message: "Subscription saved and notifications enabled",
    };
  } catch (error) {
    console.error("❌ Failed to save subscription:", error);
    return { success: false, error: error.message };
  }
}
