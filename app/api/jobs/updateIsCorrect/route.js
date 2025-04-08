import { updateIsCorrectJob } from "@/jobs/updateIsCorrect";

export async function GET() {
  try {
    const result = await updateIsCorrectJob();
    return Response.json(result);
  } catch (error) {
    console.error("Error during updateIsCorrect:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
