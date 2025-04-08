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
