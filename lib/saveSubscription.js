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
    const ref = collection(db, `users/${uid}/notificationSubscriptions`);

    // ✅ Optional: check for duplicates
    const q = query(ref, where("endpoint", "==", subscription.endpoint));
    const existing = await getDocs(q);

    if (existing.empty) {
      await addDoc(ref, subscription);
      console.log("✅ New push subscription saved");
    } else {
      console.log("ℹ️ Subscription already exists");
    }

    // ✅ Update user's notification status
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      notificationsEnabled: true,
    });

    return { success: true };
  } catch (error) {
    console.error("❌ Failed to save subscription:", error);
    return { success: false, error };
  }
}
