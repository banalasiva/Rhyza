import { db } from "@/lib/db";

// Vercel attaches `Authorization: Bearer $CRON_SECRET` to a cron request ONLY
// when a CRON_SECRET env var is set. If it was never set (or got dropped), the
// real scheduled request arrives WITHOUT that header — and a handler that hard-
// requires the secret then 401s its own scheduler, so the job silently never
// runs. (Meanwhile manual/admin triggers use a different auth path and keep
// working, which makes this look like "push is broken" when it isn't.)
//
// To be safe either way:
//   • CRON_SECRET set   → require the matching Bearer (the secure path).
//   • CRON_SECRET unset → trust Vercel's own `x-vercel-cron` marker so the job
//     still runs, and warn so we know to lock it down.
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;

  const isVercelCron =
    req.headers.get("x-vercel-cron") != null ||
    (req.headers.get("user-agent") ?? "").toLowerCase().includes("vercel-cron");
  if (isVercelCron) {
    console.warn("[cron] fired without CRON_SECRET set — set it in Vercel env to lock this down.");
  }
  return isVercelCron;
}

// Record that a cron slot ran, so /admin can show "morning cron last ran …" and
// we can tell a firing-but-empty cron from one that never fires — without having
// to dig through Vercel function logs. Best-effort: never let it break the job.
export async function markCronRun(name: string, detail: string): Promise<void> {
  try {
    await db.cronRun.upsert({
      where: { name },
      create: { name, detail, lastRunAt: new Date() },
      update: { detail, lastRunAt: new Date() },
    });
  } catch {
    /* cron_runs not migrated yet — heartbeat is best-effort */
  }
}
