import { resetForNewSeason } from "@/jobs/newSeason";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await resetForNewSeason();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error during clearForNewSeason:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
