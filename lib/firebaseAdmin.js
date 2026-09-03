import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let cachedDb = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env variable");
  }
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
}

function getAdminApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(getServiceAccount()) });
}

/**
 * Lazily-initialised Admin Firestore handle. The underlying app is created on
 * first property access, not at module load, so `next build` can import every
 * route module during page-data collection without a service account present.
 */
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!cachedDb) cachedDb = getFirestore(getAdminApp());
      const value = cachedDb[prop];
      return typeof value === "function" ? value.bind(cachedDb) : value;
    },
  },
);
