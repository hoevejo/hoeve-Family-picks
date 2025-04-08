import { doc, collection, addDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export async function saveSubscriptionToFirestore(uid, subscription) {
  try {
    const ref = collection(db, `users/${uid}/notificationSubscriptions`);
    await addDoc(ref, subscription);
    console.log("🔔 Push subscription saved to Firestore");
  } catch (error) {
    console.error("❌ Failed to save subscription:", error);
  }
}
