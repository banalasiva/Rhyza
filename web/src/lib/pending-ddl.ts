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

  // 20260629220000_notification_nudged_at
  {
    label: "notifications.nudged_at",
    sql: `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "nudged_at" TIMESTAMP(3)`,
  },

  // 20260630060000_quorum_template
  {
    label: "quorum_state.template",
    sql: `ALTER TABLE "quorum_state" ADD COLUMN IF NOT EXISTS "template" TEXT NOT NULL DEFAULT 'decide'`,
  },
  // 20260630070000_quorum_observations
  {
    label: "quorum_state.observations",
    sql: `ALTER TABLE "quorum_state" ADD COLUMN IF NOT EXISTS "observations" JSONB`,
  },

  // 20260630050000_perf_indexes
  {
    label: "notifications_emailed_at_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "notifications_emailed_at_created_at_idx" ON "notifications" ("emailed_at", "created_at")`,
  },
  {
    label: "notifications_read_at_nudged_at_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "notifications_read_at_nudged_at_created_at_idx" ON "notifications" ("read_at", "nudged_at", "created_at")`,
  },
  {
    label: "contributions_seed_id_author_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "contributions_seed_id_author_id_idx" ON "contributions" ("seed_id", "author_id")`,
  },

  // 20260629230000_explore_topics_interests
  {
    label: "seed_topics",
    sql: `CREATE TABLE IF NOT EXISTS "seed_topics" (
      "seed_id" UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "topic"   TEXT NOT NULL,
      PRIMARY KEY ("seed_id", "topic")
    )`,
  },
  {
    label: "seed_topics_topic_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_topics_topic_idx" ON "seed_topics" ("topic")`,
  },
  {
    label: "user_interests",
    sql: `CREATE TABLE IF NOT EXISTS "user_interests" (
      "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "topic"   TEXT NOT NULL,
      PRIMARY KEY ("user_id", "topic")
    )`,
  },
  {
    label: "user_interests_topic_idx",
    sql: `CREATE INDEX IF NOT EXISTS "user_interests_topic_idx" ON "user_interests" ("topic")`,
  },

  // 20260701120000_daily_quotes
  {
    label: "daily_quotes",
    sql: `CREATE TABLE IF NOT EXISTS "daily_quotes" (
      "id"         UUID NOT NULL,
      "text"       TEXT NOT NULL,
      "author"     TEXT,
      "active"     BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "daily_quotes_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: "daily_quotes_active_idx",
    sql: `CREATE INDEX IF NOT EXISTS "daily_quotes_active_idx" ON "daily_quotes" ("active")`,
  },

  // 20260703120000_search_fts
  {
    label: "contributions_text_fts",
    sql: `CREATE INDEX IF NOT EXISTS "contributions_text_fts" ON "contributions" USING GIN (to_tsvector('english', coalesce("content"->>'text', '')))`,
  },

  // 20260703170000_ai_tag_events
  {
    label: "ai_tag_events",
    sql: `CREATE TABLE IF NOT EXISTS "ai_tag_events" (
      "id"         UUID NOT NULL,
      "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "provider"   TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ai_tag_events_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: "ai_tag_events_user_id_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "ai_tag_events_user_id_created_at_idx" ON "ai_tag_events" ("user_id", "created_at")`,
  },
  {
    label: "ai_tag_events_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "ai_tag_events_created_at_idx" ON "ai_tag_events" ("created_at")`,
  },

  // 20260703190000_user_topics
  {
    label: "user_topics",
    sql: `CREATE TABLE IF NOT EXISTS "user_topics" (
      "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "topic"      TEXT NOT NULL,
      "manual"     BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_topics_pkey" PRIMARY KEY ("user_id", "topic")
    )`,
  },
  {
    label: "user_topics_user_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "user_topics_user_id_idx" ON "user_topics" ("user_id")`,
  },

  // 20260707120000_user_reflections
  {
    label: "user_reflections",
    sql: `CREATE TABLE IF NOT EXISTS "user_reflections" (
      "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "summary"    TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_reflections_pkey" PRIMARY KEY ("user_id")
    )`,
  },

  // 20260707140000_user_section_visibility
  {
    label: "user_section_visibility",
    sql: `CREATE TABLE IF NOT EXISTS "user_section_visibility" (
      "user_id" UUID    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "section" TEXT    NOT NULL,
      "public"  BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT "user_section_visibility_pkey" PRIMARY KEY ("user_id", "section")
    )`,
  },

  // 20260708120000_daily_quote_action
  {
    label: "daily_quotes.action",
    sql: `ALTER TABLE "daily_quotes" ADD COLUMN IF NOT EXISTS "action" TEXT`,
  },

  // 20260708160000_seed_follow_level
  {
    label: "seed_follows.level",
    sql: `ALTER TABLE "seed_follows" ADD COLUMN IF NOT EXISTS "level" TEXT NOT NULL DEFAULT 'all'`,
  },

  // 20260708190000_user_follows
  {
    label: "user_follows",
    sql: `CREATE TABLE IF NOT EXISTS "user_follows" (
      "follower_id"  UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "following_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_follows_pkey" PRIMARY KEY ("follower_id", "following_id")
    )`,
  },
  {
    label: "user_follows_following_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "user_follows_following_id_idx" ON "user_follows" ("following_id")`,
  },

  // 20260709120000_daily_answers
  {
    label: "daily_answers",
    sql: `CREATE TABLE IF NOT EXISTS "daily_answers" (
      "day"        TEXT NOT NULL,
      "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "choice"     INTEGER NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "daily_answers_pkey" PRIMARY KEY ("day", "user_id")
    )`,
  },
  {
    label: "daily_answers_day_idx",
    sql: `CREATE INDEX IF NOT EXISTS "daily_answers_day_idx" ON "daily_answers" ("day")`,
  },

  // 20260710120000_cron_runs
  {
    label: "cron_runs",
    sql: `CREATE TABLE IF NOT EXISTS "cron_runs" (
      "name"        TEXT NOT NULL,
      "last_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "detail"      TEXT,
      CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("name")
    )`,
  },

  // 20260710140000_seed_asks
  {
    label: "seed_asks",
    sql: `CREATE TABLE IF NOT EXISTS "seed_asks" (
      "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
      "seed_id"     UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "asker_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "asked_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "answered_at" TIMESTAMP(3),
      CONSTRAINT "seed_asks_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: "seed_asks_seed_id_asked_id_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "seed_asks_seed_id_asked_id_key" ON "seed_asks" ("seed_id", "asked_id")`,
  },
  {
    label: "seed_asks_asked_id_answered_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_asks_asked_id_answered_at_idx" ON "seed_asks" ("asked_id", "answered_at")`,
  },
  {
    label: "seed_asks_seed_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_asks_seed_id_idx" ON "seed_asks" ("seed_id")`,
  },

  // 20260710160000_feedback
  {
    label: "feedback",
    sql: `CREATE TABLE IF NOT EXISTS "feedback" (
      "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
      "user_id"    UUID REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "kind"       TEXT NOT NULL DEFAULT 'bug',
      "message"    TEXT NOT NULL,
      "path"       TEXT,
      "user_agent" TEXT,
      "status"     TEXT NOT NULL DEFAULT 'open',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: "feedback_status_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "feedback_status_created_at_idx" ON "feedback" ("status", "created_at")`,
  },

  // 20260710170000_feedback_github_url
  {
    label: "feedback.github_url",
    sql: `ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "github_url" TEXT`,
  },

  // 20260711120000_seed_join_requests
  {
    label: "seed_join_requests",
    sql: `CREATE TABLE IF NOT EXISTS "seed_join_requests" (
      "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
      "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "status"     TEXT NOT NULL DEFAULT 'pending',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "decided_at" TIMESTAMP(3),
      CONSTRAINT "seed_join_requests_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: "seed_join_requests_seed_id_user_id_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "seed_join_requests_seed_id_user_id_key" ON "seed_join_requests" ("seed_id", "user_id")`,
  },
  {
    label: "seed_join_requests_seed_id_status_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_join_requests_seed_id_status_idx" ON "seed_join_requests" ("seed_id", "status")`,
  },

  // 20260711140000_connections
  {
    label: "connections",
    sql: `CREATE TABLE IF NOT EXISTS "connections" (
      "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
      "requester_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "addressee_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "status"       TEXT NOT NULL DEFAULT 'pending',
      "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "responded_at" TIMESTAMP(3),
      CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: "connections_requester_id_addressee_id_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "connections_requester_id_addressee_id_key" ON "connections" ("requester_id", "addressee_id")`,
  },
  {
    label: "connections_addressee_id_status_idx",
    sql: `CREATE INDEX IF NOT EXISTS "connections_addressee_id_status_idx" ON "connections" ("addressee_id", "status")`,
  },
  {
    label: "connections_requester_id_status_idx",
    sql: `CREATE INDEX IF NOT EXISTS "connections_requester_id_status_idx" ON "connections" ("requester_id", "status")`,
  },

  // 20260711160000_seed_mediator_nudges
  {
    label: "seed_mediator_nudges",
    sql: `CREATE TABLE IF NOT EXISTS "seed_mediator_nudges" (
      "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "mode"       TEXT,
      "reason"     TEXT,
      "sensed_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "seed_mediator_nudges_pkey" PRIMARY KEY ("seed_id")
    )`,
  },

  // 20260712120000_seed_deadlines
  {
    label: "seed_deadlines",
    sql: `CREATE TABLE IF NOT EXISTS "seed_deadlines" (
      "seed_id"          UUID    NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "mode"             TEXT    NOT NULL DEFAULT 'paced',
      "discuss_by"       TIMESTAMP(3),
      "decide_by"        TIMESTAMP(3),
      "set_by"           UUID    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "last_followup_at" TIMESTAMP(3),
      "followup_stage"   TEXT,
      "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "seed_deadlines_pkey" PRIMARY KEY ("seed_id")
    )`,
  },
  {
    label: "seed_deadlines_decide_by_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_deadlines_decide_by_idx" ON "seed_deadlines" ("decide_by")`,
  },

  // 20260712140000_auth_events
  {
    label: "auth_events",
    sql: `CREATE TABLE IF NOT EXISTS "auth_events" (
      "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
      "code"       TEXT NOT NULL,
      "email"      TEXT,
      "detail"     TEXT,
      "user_agent" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: "auth_events_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "auth_events_created_at_idx" ON "auth_events" ("created_at")`,
  },

  // 20260712160000_suggestion_dismissals
  {
    label: "suggestion_dismissals",
    sql: `CREATE TABLE IF NOT EXISTS "suggestion_dismissals" (
      "user_id"      UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "dismissed_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "suggestion_dismissals_pkey" PRIMARY KEY ("user_id", "dismissed_id")
    )`,
  },
  {
    label: "suggestion_dismissals_user_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "suggestion_dismissals_user_id_idx" ON "suggestion_dismissals" ("user_id")`,
  },

  // 20260712180000_contrib_seed_created_idx — the hottest query (thread reads +
  // 4s sync poll) filters seed_id and orders by created_at. CONCURRENTLY can't
  // run inside the admin migrate transaction, so this is a plain CREATE; on a
  // large existing table prefer running the CONCURRENTLY variant by hand.
  {
    label: "contributions_seed_id_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "contributions_seed_id_created_at_idx" ON "contributions" ("seed_id", "created_at")`,
  },

  // 20260712190000_seed_member_added_by
  {
    label: "seed_members.added_by",
    sql: `ALTER TABLE "seed_members" ADD COLUMN IF NOT EXISTS "added_by" UUID`,
  },
  {
    label: "seed_members.added_by_stranger",
    sql: `ALTER TABLE "seed_members" ADD COLUMN IF NOT EXISTS "added_by_stranger" BOOLEAN NOT NULL DEFAULT false`,
  },

  // One-time data backfill (idempotent): give people who joined via the email
  // magic-link — and so have an empty name — a readable display name derived
  // from their email ("siva.prasad@x" → "Siva Prasad"). Only touches rows whose
  // name is still blank, so re-running is a harmless no-op. Going forward the
  // first-sign-in NamePrompt asks new users directly.
  {
    label: "users.name_backfill_from_email",
    sql: `UPDATE "users"
      SET "name" = initcap(regexp_replace(split_part("email", '@', 1), '[._+-]+', ' ', 'g'))
      WHERE COALESCE("name", '') = ''
        AND "email" IS NOT NULL AND "email" <> ''
        AND "deleted_at" IS NULL`,
  },
];
