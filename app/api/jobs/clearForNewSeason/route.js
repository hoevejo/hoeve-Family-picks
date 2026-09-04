export const runtime = "nodejs"; // ✅ This tells Next.js to use the Node.js runtime

import { resetForNewSeason } from "@/jobs/newSeason";
import { verifyAdminIdToken } from "@/lib/verifyRequest";
import { NextResponse } from "next/server";

export async function GET(req) {
  const uid = await verifyAdminIdToken(req);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resetForNewSeason();
    return NextResponse.json(result); // ✅ Correct usage
  } catch (error) {
    console.error("Error during clearForNewSeason:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
