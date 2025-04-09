// ✅ Force Vercel to use Node.js runtime instead of Edge (Edge can't handle certain packages)
export const runtime = "nodejs";

import { calculateWeeklyResults } from "@/jobs/calculateWeeklyResults";

export async function GET() {
  try {
    const result = await calculateWeeklyResults();
    return Response.json(result);
  } catch (error) {
    console.error("❌ Error running calculateWeeklyResults:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
