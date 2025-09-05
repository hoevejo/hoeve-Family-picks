// app/api/placeWager/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { userId, seasonYear, seasonType, week, teamId, points } =
      await req.json();

    if (!userId || !seasonYear || !seasonType || !week || !teamId)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const cfgSnap = await db.doc("config/config").get();
    const cfg = cfgSnap.data() || {};
    const gotwId = String(cfg.gameOfTheWeekId || "");
    if (!gotwId)
      return NextResponse.json(
        { error: "GOTW not configured" },
        { status: 400 }
      );

    // ✅ enforce “only up to user’s points”
    const lbCollection =
      String(seasonType).toLowerCase() === "postseason"
        ? "leaderboardPostseason"
        : "leaderboard";
    const lbSnap = await db.doc(`${lbCollection}/${userId}`).get();
    const userTotal = Number((lbSnap.data() || {}).totalPoints || 0);

    const wagerPts = Number(points);
    if (!Number.isInteger(wagerPts) || wagerPts < 1 || wagerPts > userTotal) {
      return NextResponse.json(
        { error: `Points must be 1..${userTotal}` },
        { status: 400 }
      );
    }

    // validate GOTW game + not locked
    const seasonTypeSlug = String(seasonType).toLowerCase();
    const fullGameId = `${seasonYear}-${seasonTypeSlug}-week${week}-${gotwId}`;
    const gameSnap = await db.doc(`games/${fullGameId}`).get();
    if (!gameSnap.exists)
      return NextResponse.json(
        { error: "GOTW game not found" },
        { status: 400 }
      );

    const game = gameSnap.data() || {};
    const kickoff = game?.date ? new Date(game.date).getTime() : 0;
    if (!kickoff || Date.now() >= kickoff) {
      return NextResponse.json(
        { error: "Wager window is locked" },
        { status: 400 }
      );
    }

    const homeId = String(game?.homeTeam?.id || "");
    const awayId = String(game?.awayTeam?.id || "");
    const team = String(teamId);
    if (team !== homeId && team !== awayId) {
      return NextResponse.json(
        { error: "Team must be home or away" },
        { status: 400 }
      );
    }

    // upsert to picks doc (merge) + sync GOTW prediction
    const picksId = `${seasonYear}-${seasonType}-week${week}-${userId}`;
    const picksRef = db.doc(`picks/${picksId}`);
    await picksRef.set(
      {
        userId,
        seasonYear,
        seasonType,
        week,
        wager: {
          gameId: gotwId,
          teamId: team,
          points: wagerPts,
          placedAt: new Date().toISOString(),
        },
        [`predictions.${gotwId}.teamId`]: team,
        [`predictions.${gotwId}.isCorrect`]: null,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, maxAllowed: userTotal });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
