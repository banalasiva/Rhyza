// Idempotent, additive DDL that mirrors the hand-written migrations exactly.
// The owner-only /api/admin/migrate endpoint runs these one at a time so the
// schema can be brought up to date from anywhere (e.g. a phone) without a
// laptop + `prisma migrate deploy`. Every statement is CREATE … IF NOT EXISTS
// or ADD COLUMN IF NOT EXISTS, so running it when the schema is already current
// is a harmless no-op, and a later `migrate deploy` of the same files is too.
//
// RULE: only ever append additive, idempotent statements here. Never DROP,
// never rename, never anything that loses data — this runs over an HTTP call.

export const PENDING_DDL: { label: string; sql: string }[] = [
  // 20260628210000_notification_anchor
  {
    label: "notifications.anchor_id",
    sql: `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "anchor_id" UUID`,
  },

  // 20260629120000_quorum_v2
  {
    label: "quorum_ballots",
    sql: `CREATE TABLE IF NOT EXISTS "quorum_ballots" (
      "seed_id"    UUID    NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "rater_id"   UUID    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "dimension"  TEXT    NOT NULL,
      "ranking"    JSONB   NOT NULL DEFAULT '[]',
      "submitted"  BOOLEAN NOT NULL DEFAULT false,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("seed_id", "rater_id", "dimension")
    )`,
  },
  {
    label: "quorum_ballots_seed_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "quorum_ballots_seed_id_idx" ON "quorum_ballots" ("seed_id")`,
  },
  {
    label: "quorum_hardcodes",
    sql: `CREATE TABLE IF NOT EXISTS "quorum_hardcodes" (
      "seed_id"    UUID    NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "dimension"  TEXT    NOT NULL,
      "by_id"      UUID    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "shares"     JSONB   NOT NULL DEFAULT '{}',
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("seed_id", "dimension")
    )`,
  },
  {
    label: "quorum_hardcodes_seed_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "quorum_hardcodes_seed_id_idx" ON "quorum_hardcodes" ("seed_id")`,
  },
  {
    label: "quorum_state",
    sql: `CREATE TABLE IF NOT EXISTS "quorum_state" (
      "seed_id"    UUID    NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "phase"      TEXT    NOT NULL DEFAULT 'collecting',
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("seed_id")
    )`,
  },

  // 20260629140000_rate_limits
  {
    label: "rate_limits",
    sql: `CREATE TABLE IF NOT EXISTS "rate_limits" (
      "key"      TEXT    NOT NULL,
      "count"    INTEGER NOT NULL DEFAULT 0,
      "reset_at" TIMESTAMP(3) NOT NULL,
      PRIMARY KEY ("key")
    )`,
  },

  // 20260629160000_push_user_agent
  {
    label: "push_subscriptions.user_agent",
    sql: `ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_agent" TEXT`,
  },

  // 20260629210000_explore_public_seeds
  {
    label: "seeds.listed",
    sql: `ALTER TABLE "seeds" ADD COLUMN IF NOT EXISTS "listed" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    label: "seeds.last_activity_at",
    sql: `ALTER TABLE "seeds" ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  },
  {
    label: "seeds_listed_last_activity_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seeds_listed_last_activity_at_idx" ON "seeds" ("listed", "last_activity_at")`,
  },
  {
    label: "seed_follows",
    sql: `CREATE TABLE IF NOT EXISTS "seed_follows" (
      "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("seed_id", "user_id")
    )`,
  },
  {
    label: "seed_follows_user_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_follows_user_id_idx" ON "seed_follows" ("user_id")`,
  },
  {
    label: "seed_reports",
    sql: `CREATE TABLE IF NOT EXISTS "seed_reports" (
      "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
      "seed_id"         UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "contribution_id" UUID,
      "reporter_id"     UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "reason"          TEXT NOT NULL,
      "status"          TEXT NOT NULL DEFAULT 'open',
      "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("id")
    )`,
  },
  {
    label: "seed_reports_status_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_reports_status_created_at_idx" ON "seed_reports" ("status", "created_at")`,
  },
  {
    label: "seed_reports_seed_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_reports_seed_id_idx" ON "seed_reports" ("seed_id")`,
  },
];
