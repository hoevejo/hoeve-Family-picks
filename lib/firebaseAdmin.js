import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let cachedDb = null;
let cachedAuth = null;

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
 * Lazily-initialised Admin Firestore handle -- created on first access, not
 * module load, so `next build` doesn't need a service account present.
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

/**
 * Lazily-initialised Admin Auth handle, same rationale as `db` above --
 * used to verify caller-supplied Firebase ID tokens on API routes.
 */
export const auth = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
      const value = cachedAuth[prop];
      return typeof value === "function" ? value.bind(cachedAuth) : value;
    },
  },
);
