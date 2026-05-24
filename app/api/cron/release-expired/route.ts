import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/expiry";

// this route is called by Vercel Cron on a schedule (see vercel.json)
// it runs independent of user traffic so expired reservations are always
// cleaned up even when the app is idle
export async function GET(req: NextRequest) {
  // simple secret header check to prevent unauthorized calls
  const secret = req.headers.get("x-cron-secret");
  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await releaseExpiredReservations();

  return NextResponse.json({
    ok: true,
    released: count,
    timestamp: new Date().toISOString(),
  });
}
