import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health — a tiny liveness + DB check for uptime monitors and load
// balancers. Public (no auth) and cheap: one trivial round-trip to Postgres.
// Returns 200 when the app can reach the DB, 503 when it can't.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
