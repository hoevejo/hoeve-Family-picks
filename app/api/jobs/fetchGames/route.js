export const runtime = "nodejs";

import { fetchAndStoreGames } from "@/jobs/updateGames";
import { verifyCronSecret } from "@/lib/verifyRequest";

export async function GET(req) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fetchAndStoreGames();
    return Response.json(result);
  } catch (error) {
    console.error("FetchGames job failed:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
