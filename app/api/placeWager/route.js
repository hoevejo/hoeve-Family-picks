// app/api/placeWager/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  normalizeSeasonType,
  gameDocId,
  picksDocId,
  leaderboardScope,
} from "@/lib/seasonType";

export async function POST(req) {
  try {
    const {
      userId,
      seasonYear,
      seasonType: rawSeasonType,
      week,
      teamId,
      points,
    } = await req.json();

    if (!userId || !seasonYear || !rawSeasonType || !week || !teamId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const seasonType = normalizeSeasonType(rawSeasonType);

    const cfgSnap = await db.doc("config/config").get();
    const cfg = cfgSnap.data() || {};
    const gotwId = String(cfg.gameOfTheWeekId || "");
    if (!gotwId) {
      return NextResponse.json(
        { error: "GOTW not configured" },
        { status: 400 },
      );
    }

    // ✅ enforce “only up to user’s points”
    const lbCollection = `leaderboards/${leaderboardScope(seasonType)}/entries`;
    const lbSnap = await db.doc(`${lbCollection}/${userId}`).get();
    const userTotal = Number((lbSnap.data() || {}).totalPoints || 0);

    const wagerPts = Number(points);
    if (!Number.isInteger(wagerPts) || wagerPts < 1 || wagerPts > userTotal) {
      return NextResponse.json(
        { error: `Points must be 1..${userTotal}` },
        { status: 400 },
      );
    }

    // validate GOTW game + not locked
    const fullGameId = gameDocId({
      seasonYear,
      seasonType,
      week,
      gameId: gotwId,
    });
    const gameSnap = await db.doc(`games/${fullGameId}`).get();
    if (!gameSnap.exists) {
      return NextResponse.json(
        { error: "GOTW game not found" },
        { status: 400 },
      );
    }

    const game = gameSnap.data() || {};
    const kickoff = game?.date ? new Date(game.date).getTime() : 0;
    if (!kickoff || Date.now() >= kickoff) {
      return NextResponse.json(
        { error: "Wager window is locked" },
        { status: 400 },
      );
    }

    const homeId = String(game?.homeTeam?.id || "");
    const awayId = String(game?.awayTeam?.id || "");
    const team = String(teamId);
    if (team !== homeId && team !== awayId) {
      return NextResponse.json(
        { error: "Team must be home or away" },
        { status: 400 },
      );
    }

    // upsert to picks doc (merge) + sync GOTW prediction.
    // Two writes, not one: .set(...,{merge:true}) only merges based on real
    // object nesting -- a dotted-string key like `predictions.${gotwId}.teamId`
    // in that call lands as a literal top-level field, not nested under
    // `predictions`. Guarantee the doc exists first via .set(), then use
    // .update() (which does parse dotted keys as nested field paths) for the
    // prediction fields.
    const picksId = picksDocId({ seasonYear, seasonType, week, uid: userId });
    const picksRef = db.doc(`picks/${picksId}`);
    const profileSnap = await db.doc(`publicProfiles/${userId}`).get();
    const fullName = profileSnap.data()?.fullName || "";
    await picksRef.set(
      {
        userId,
        seasonYear,
        seasonType,
        week,
        fullName,
        wager: {
          gameId: gotwId,
          teamId: team,
          points: wagerPts,
          placedAt: new Date().toISOString(),
        },
      },
      { merge: true },
    );
    await picksRef.update({
      [`predictions.${gotwId}.teamId`]: team,
      [`predictions.${gotwId}.isCorrect`]: null,
    });

    return NextResponse.json({ success: true, maxAllowed: userTotal });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
