export const runtime = "nodejs";

import { updateIsCorrectJob } from "@/jobs/updateIsCorrect";
import { verifyAdminIdToken } from "@/lib/verifyRequest";

export async function GET(req) {
  const uid = await verifyAdminIdToken(req);
  if (!uid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await updateIsCorrectJob();
    return Response.json(result);
  } catch (error) {
    console.error("Error during updateIsCorrect:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
