import { db, auth } from "./firebaseAdmin";

/**
 * For machine-triggered routes (Vercel cron). Vercel automatically attaches
 * `Authorization: Bearer $CRON_SECRET` to requests it makes to a project's
 * own cron-registered paths once an env var literally named CRON_SECRET
 * exists -- no vercel.json changes needed.
 */
export function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
  );
}

/**
 * For human-triggered admin actions. Verifies the caller's Firebase ID
 * token and that the underlying user has isAdmin === true on their
 * users/{uid} doc. Returns the verified uid, or null if the request isn't
 * from a signed-in admin.
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
 * For human-triggered, non-admin actions where the request just needs to be
 * tied to a real signed-in user (e.g. placeWager). Returns the verified
 * uid, or null.
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
