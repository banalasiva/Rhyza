import { PrismaClient } from "@prisma/client";

// Prisma singleton — avoids exhausting DB connections during dev hot-reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build the client. With NEON_SERVERLESS=1 we connect through Neon's
// serverless driver (a WebSocket proxy) instead of opening a fresh TCP+TLS
// connection on every cold serverless invocation — this is the dominant cost
// of the first page load after the function (or Neon's compute) has gone idle.
//
// It ships OFF by default so the proven TCP path stays the production default.
// Flip the flag on a Vercel *preview* deployment, confirm pages load, then
// promote it to production. require() is lazy so the driver packages are only
// touched when the flag is on.
function buildClient(): PrismaClient {
  const log = process.env.NODE_ENV === "development" ? (["error", "warn"] as const) : (["error"] as const);

  if (process.env.NEON_SERVERLESS === "1" && process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool, neonConfig } = require("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaNeon } = require("@prisma/adapter-neon");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    neonConfig.webSocketConstructor = require("ws");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter, log: [...log] });
  }

  return new PrismaClient({ log: [...log] });
}

export const db = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
