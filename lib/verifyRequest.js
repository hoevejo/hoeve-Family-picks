import { db, auth } from "./firebaseAdmin";

/**
 * For machine-triggered routes. Vercel auto-attaches this header to its own
 * cron requests once CRON_SECRET exists -- no vercel.json changes needed.
 */
export function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
  );
}

/**
 * For human-triggered admin actions. Verifies the ID token and that
 * users/{uid}.isAdmin is true. Returns the uid, or null.
 */
export async function verifyAdminIdToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.doc(`users/${decoded.uid}`).get();
    if (!userSnap.exists || userSnap.data()?.isAdmin !== true) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * For non-admin actions that just need a real signed-in user (e.g.
 * placeWager). Returns the verified uid, or null.
 */
export async function verifyIdToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
