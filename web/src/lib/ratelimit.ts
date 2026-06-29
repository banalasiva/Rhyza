import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Durable fixed-window rate limiter backed by the rate_limits table — no Redis
// needed. The whole increment-and-check is a single atomic SQL upsert, so two
// requests racing on different serverless instances still share one counter.
//
// Fail-open by design: if the limiter table is missing or the query errors, we
// let the request through rather than break the app over an infra hiccup. It's
// a cost/abuse guard, not an auth boundary.
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  let count = 1;
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limits" ("key", "count", "reset_at")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limits"."reset_at" < now() THEN 1
                       ELSE "rate_limits"."count" + 1 END,
        "reset_at" = CASE WHEN "rate_limits"."reset_at" < now()
                          THEN now() + make_interval(secs => ${windowSec})
                          ELSE "rate_limits"."reset_at" END
      RETURNING "count"`;
    count = Number(rows?.[0]?.count ?? 1);
  } catch {
    return; // fail open on limiter-infra error
  }
  if (count > limit) {
    throw new ApiError(
      "RATE_LIMITED",
      "You're doing that a lot. Give it a minute and try again.",
    );
  }
}

// Shared budget for everything that triggers a paid AI completion (mediate,
// summarise, AI vote, @claude / @chatgpt replies). 30 calls per 5 minutes per
// user is generous for real use and caps a hammering script or runaway cost.
export function enforceAiRateLimit(userId: string): Promise<void> {
  return enforceRateLimit(`ai:${userId}`, 30, 300);
}
