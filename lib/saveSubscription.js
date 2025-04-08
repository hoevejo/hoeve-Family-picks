import { doc, collection, addDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export async function saveSubscriptionToFirestore(uid, subscription) {
  try {
    const ref = collection(db, `users/${uid}/notificationSubscriptions`);
    await addDoc(ref, subscription);

    // ✅ Update the user's document to mark notifications as enabled
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      notificationsEnabled: true,
    });

    console.log(
      "🔔 Push subscription saved and notificationsEnabled set to true"
    );
  } catch (error) {
    console.error("❌ Failed to save subscription:", error);
  }
}
