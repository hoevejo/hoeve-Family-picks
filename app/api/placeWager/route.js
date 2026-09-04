// app/api/placeWager/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  normalizeSeasonType,
  gameDocId,
  picksDocId,
  leaderboardScope,
} from "@/lib/seasonType";
import { verifyIdToken } from "@/lib/verifyRequest";

export async function POST(req) {
  try {
    // The caller's own verified identity -- this used to trust a
    // body-supplied userId, letting anyone wager on any known uid.
    const userId = await verifyIdToken(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      seasonYear,
      seasonType: rawSeasonType,
      week,
      teamId,
      points,
    } = await req.json();

    if (!seasonYear || !rawSeasonType || !week || !teamId) {
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

    // Capped at wagerMaxPoints regardless of standing, not just userTotal --
    // stops a leader from dumping their whole lead into one bet. Defaults
    // to 5 if unset so it's protective before anyone configures it.
    const lbCollection = `leaderboards/${leaderboardScope(seasonType)}/entries`;
    const lbSnap = await db.doc(`${lbCollection}/${userId}`).get();
    const userTotal = Number((lbSnap.data() || {}).totalPoints || 0);
    const wagerMaxPoints = Math.max(1, Number(cfg.wagerMaxPoints) || 5);
    const maxAllowed = Math.min(userTotal, wagerMaxPoints);

    const wagerPts = Number(points);
    if (!Number.isInteger(wagerPts) || wagerPts < 1 || wagerPts > maxAllowed) {
      return NextResponse.json(
        { error: `Points must be 1..${maxAllowed}` },
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

    // Two writes, not one: .set(merge) doesn't nest dotted-string keys like
    // .update() does, so the doc's created first, then predictions updated.
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

    return NextResponse.json({ success: true, maxAllowed });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
