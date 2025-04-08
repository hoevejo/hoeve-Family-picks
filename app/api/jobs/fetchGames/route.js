import { fetchAndStoreGames } from "@/jobs/updateGames";

export async function GET() {
  try {
    const result = await fetchAndStoreGames();
    return Response.json(result);
  } catch (error) {
    console.error("FetchGames job failed:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
