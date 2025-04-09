export const runtime = "nodejs";

import { calculateWeeklyResults } from "@/jobs/calculateWeeklyResults";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await calculateWeeklyResults();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error during calculateWeeklyResults:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
