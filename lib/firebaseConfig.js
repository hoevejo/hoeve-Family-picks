import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDWireDd7Vd4kNrARFny66AYMhE5hf523k",
  authDomain: "hoeve-family-picks.firebaseapp.com",
  projectId: "hoeve-family-picks",
  storageBucket: "hoeve-family-picks.firebasestorage.app",
  messagingSenderId: "688382392464",
  appId: "1:688382392464:web:e555de02be783e838fc015",
  measurementId: "G-MPNXM5CL5W",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
