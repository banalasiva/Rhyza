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

  // 20260713120000_seed_add_notices — its own table (NOT columns on the hot
  // seed_members) so core seed reads never select a column the DB hasn't
  // migrated; read best-effort so a missing table can't lock anyone out.
  {
    label: "seed_add_notices",
    sql: `CREATE TABLE IF NOT EXISTS "seed_add_notices" (
      "seed_id"    UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "user_id"    UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "added_by"   UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "seed_add_notices_pkey" PRIMARY KEY ("seed_id", "user_id")
    )`,
  },

  // 20260714140000_reactions_v2 — expand the reaction palette to two tiers and
  // refresh emoji/order of the existing keys. Idempotent upsert; the app derives
  // signal-vs-expressive from src/lib/reactions.ts, so no column change here.
  {
    label: "reaction_types.v2_palette",
    sql: `INSERT INTO "reaction_types" ("key", "emoji", "label", "sort_order") VALUES
      ('clicked','💥','It clicked',1),
      ('point','💡','Good point',2),
      ('agree','✅','I''m with this',3),
      ('mind','🧠','Changed thinking',4),
      ('fence','⚖️','On the fence',5),
      ('confuse','🤔','Still confused',6),
      ('impl','🛠️','I tried this',7),
      ('ref','📚','Great reference',8),
      ('beauty','✨','Beautifully said',9),
      ('love','❤️','Love',20),
      ('clap','👏','Applause',21),
      ('haha','😂','Haha',22),
      ('fire','🔥','Fire',23),
      ('party','🎉','Celebrate',24),
      ('praise','🙌','Yes!',25)
      ON CONFLICT ("key") DO UPDATE SET
        "emoji" = EXCLUDED."emoji",
        "label" = EXCLUDED."label",
        "sort_order" = EXCLUDED."sort_order"`,
  },

  // 20260714130000_seed_drafts — unsent message drafts per (seed, user). Read
  // best-effort so a missing table never blocks a seed.
  {
    label: "seed_drafts",
    sql: `CREATE TABLE IF NOT EXISTS "seed_drafts" (
      "seed_id"     UUID NOT NULL REFERENCES "seeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "user_id"     UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "text"        TEXT NOT NULL DEFAULT '',
      "attachments" JSONB,
      "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "seed_drafts_pkey" PRIMARY KEY ("seed_id", "user_id")
    )`,
  },
  {
    label: "seed_drafts_user_id_updated_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "seed_drafts_user_id_updated_at_idx" ON "seed_drafts" ("user_id", "updated_at")`,
  },

  // 20260714120000_perf_indexes — cover hot read paths that had no matching index:
  //   • profile/roots counts + personMessages filter contributions by author_id
  //     (the existing (seed_id, author_id) index can't serve an author-only scan);
  //   • roots "blooms helped" scans bloom_contributors by user_id (only a
  //     (bloom_id, user_id) unique existed);
  //   • the unread-bell badge counts notifications per recipient where unread — a
  //     partial index keeps it tiny and fast.
  {
    label: "contributions_author_id_deleted_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "contributions_author_id_deleted_at_idx" ON "contributions" ("author_id", "deleted_at")`,
  },
  {
    label: "bloom_contributors_user_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "bloom_contributors_user_id_idx" ON "bloom_contributors" ("user_id")`,
  },
  {
    label: "notifications_recipient_unread_idx",
    sql: `CREATE INDEX IF NOT EXISTS "notifications_recipient_unread_idx" ON "notifications" ("recipient_id") WHERE "read_at" IS NULL`,
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
        AND "email" NOT LIKE '%@phone.thinkthru.app'
        AND "deleted_at" IS NULL`,
  },

  // Phone sign-in (Twilio Verify). Auth keys the user by a synthetic email so it
  // works with zero schema change; this standalone table is an auxiliary
  // phone → user lookup for the future "people from your network joined" contact
  // graph. Deliberately NO foreign key / relation to "users" — it stays off the
  // hot User/Seed read path (SEV0 discipline), so a missing table can never break
  // core reads, and sign-in writes it best-effort.
  {
    label: "phone_identities",
    sql: `CREATE TABLE IF NOT EXISTS "phone_identities" (
      "phone"      TEXT NOT NULL PRIMARY KEY,
      "user_id"    UUID NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    label: "phone_identities_user_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "phone_identities_user_id_idx" ON "phone_identities" ("user_id")`,
  },

  // Peer recognition for virtues (depth/judgement/taste/empathy), earned on a
  // specific message. Standalone (no FK to the hot users/contributions tables)
  // so a missing table can never break core reads; read best-effort everywhere.
  {
    label: "contribution_recognitions",
    sql: `CREATE TABLE IF NOT EXISTS "contribution_recognitions" (
      "contribution_id" UUID NOT NULL,
      "author_id"       UUID NOT NULL,
      "by_id"           UUID NOT NULL,
      "virtue"          TEXT NOT NULL,
      "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("contribution_id", "by_id", "virtue")
    )`,
  },
  {
    label: "contribution_recognitions_author_virtue_idx",
    sql: `CREATE INDEX IF NOT EXISTS "contribution_recognitions_author_virtue_idx" ON "contribution_recognitions" ("author_id", "virtue")`,
  },
  {
    label: "contribution_recognitions_contribution_idx",
    sql: `CREATE INDEX IF NOT EXISTS "contribution_recognitions_contribution_idx" ON "contribution_recognitions" ("contribution_id")`,
  },

  // Per-seed rolling AI memory (compressed summary of older messages), so the
  // AI can reply with full-thread context without sending the whole transcript.
  // Standalone, read best-effort.
  {
    label: "seed_thread_memory",
    sql: `CREATE TABLE IF NOT EXISTS "seed_thread_memory" (
      "seed_id"          UUID NOT NULL PRIMARY KEY,
      "summary"          TEXT NOT NULL DEFAULT '',
      "summarized_count" INTEGER NOT NULL DEFAULT 0,
      "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },

  // Personal "Keep" bookmarks — a message someone saved for themselves, with a
  // small snapshot so the Kept list renders on its own and survives edits / a
  // bloomed seed. Standalone (no FK to the hot contribution/seed tables) so a
  // missing table can never break the room; read + write best-effort.
  {
    label: "kept_contributions",
    sql: `CREATE TABLE IF NOT EXISTS "kept_contributions" (
      "user_id"         UUID NOT NULL,
      "contribution_id" UUID NOT NULL,
      "seed_id"         UUID NOT NULL,
      "seed_title"      TEXT NOT NULL DEFAULT '',
      "author_name"     TEXT NOT NULL DEFAULT '',
      "preview"         TEXT NOT NULL DEFAULT '',
      "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("user_id", "contribution_id")
    )`,
  },
  {
    label: "kept_contributions_user_id_created_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "kept_contributions_user_id_created_at_idx" ON "kept_contributions" ("user_id", "created_at")`,
  },

  // Per-seed AI on/off switch (owner/admin). Standalone table (no column on the
  // hot seeds model) so a missing table never breaks a seed read; read
  // best-effort, defaults to ON when absent.
  {
    label: "seed_ai_settings",
    sql: `CREATE TABLE IF NOT EXISTS "seed_ai_settings" (
      "seed_id"    UUID NOT NULL PRIMARY KEY,
      "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },

  // Bloom 2.0 — personal reflection on a decision (outcome vs expectation, the
  // biggest lesson, would-you-decide-the-same-today). One row per (bloom, user),
  // editable over time. Standalone table (no FK to hot bloom/user models) so a
  // missing table can never break a bloom read; read + write best-effort.
  {
    label: "bloom_reflections",
    sql: `CREATE TABLE IF NOT EXISTS "bloom_reflections" (
      "bloom_id"          UUID NOT NULL,
      "user_id"           UUID NOT NULL,
      "seed_id"           UUID NOT NULL,
      "outcome"           TEXT,
      "outcome_note"      TEXT,
      "lesson"            TEXT,
      "same_again"        TEXT,
      "changed"           TEXT,
      "outcome_shared"    BOOLEAN NOT NULL DEFAULT false,
      "lesson_shared"     BOOLEAN NOT NULL DEFAULT false,
      "same_again_shared" BOOLEAN NOT NULL DEFAULT false,
      "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("bloom_id", "user_id")
    )`,
  },
  // Per-section share flags — separate ADD COLUMNs so a DB that already created
  // bloom_reflections before these existed still gets them (all idempotent).
  {
    label: "bloom_reflections.outcome_shared",
    sql: `ALTER TABLE "bloom_reflections" ADD COLUMN IF NOT EXISTS "outcome_shared" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    label: "bloom_reflections.lesson_shared",
    sql: `ALTER TABLE "bloom_reflections" ADD COLUMN IF NOT EXISTS "lesson_shared" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    label: "bloom_reflections.same_again_shared",
    sql: `ALTER TABLE "bloom_reflections" ADD COLUMN IF NOT EXISTS "same_again_shared" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    label: "bloom_reflections_user_id_updated_at_idx",
    sql: `CREATE INDEX IF NOT EXISTS "bloom_reflections_user_id_updated_at_idx" ON "bloom_reflections" ("user_id", "updated_at")`,
  },
  {
    label: "bloom_reflections_bloom_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "bloom_reflections_bloom_id_idx" ON "bloom_reflections" ("bloom_id")`,
  },
  // How hard-won the lesson was (very_tough … very_easy), for the lessons mirror.
  {
    label: "bloom_reflections.lesson_weight",
    sql: `ALTER TABLE "bloom_reflections" ADD COLUMN IF NOT EXISTS "lesson_weight" TEXT`,
  },

  // Calibration — an outside person's read of how a decision landed, reached via
  // a per-bloom share token. Standalone (no FK to hot models), best-effort.
  {
    label: "bloom_share_tokens",
    sql: `CREATE TABLE IF NOT EXISTS "bloom_share_tokens" (
      "bloom_id"   UUID NOT NULL PRIMARY KEY,
      "token"      TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    label: "bloom_share_tokens_token_key",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "bloom_share_tokens_token_key" ON "bloom_share_tokens" ("token")`,
  },
  // Google-Docs-style access: "anyone" with the link, or "restricted" to a set
  // of allowed emails.
  {
    label: "bloom_share_tokens.access",
    sql: `ALTER TABLE "bloom_share_tokens" ADD COLUMN IF NOT EXISTS "access" TEXT NOT NULL DEFAULT 'anyone'`,
  },
  {
    label: "bloom_share_tokens.allowed_emails",
    sql: `ALTER TABLE "bloom_share_tokens" ADD COLUMN IF NOT EXISTS "allowed_emails" TEXT[] NOT NULL DEFAULT '{}'`,
  },
  {
    label: "bloom_share_tokens.shared_by",
    sql: `ALTER TABLE "bloom_share_tokens" ADD COLUMN IF NOT EXISTS "shared_by" UUID`,
  },
  {
    label: "bloom_calibrations",
    sql: `CREATE TABLE IF NOT EXISTS "bloom_calibrations" (
      "bloom_id"       UUID NOT NULL,
      "responder_id"   UUID NOT NULL,
      "responder_name" TEXT NOT NULL DEFAULT '',
      "outcome"        TEXT,
      "same_again"     TEXT,
      "note"           TEXT,
      "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("bloom_id", "responder_id")
    )`,
  },
  {
    label: "bloom_calibrations_bloom_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "bloom_calibrations_bloom_id_idx" ON "bloom_calibrations" ("bloom_id")`,
  },

  // 20260719_passkeys — Firebase-free WebAuthn sign-in
  {
    label: "passkeys",
    sql: `CREATE TABLE IF NOT EXISTS "passkeys" (
      "id"           TEXT NOT NULL,
      "user_id"      UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "public_key"   TEXT NOT NULL,
      "counter"      INTEGER NOT NULL DEFAULT 0,
      "transports"   TEXT NOT NULL DEFAULT '',
      "device_type"  TEXT NOT NULL DEFAULT '',
      "backed_up"    BOOLEAN NOT NULL DEFAULT false,
      "name"         TEXT NOT NULL DEFAULT 'Passkey',
      "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "last_used_at" TIMESTAMP(3),
      PRIMARY KEY ("id")
    )`,
  },
  {
    label: "passkeys_user_id_idx",
    sql: `CREATE INDEX IF NOT EXISTS "passkeys_user_id_idx" ON "passkeys" ("user_id")`,
  },
  {
    label: "webauthn_challenges",
    sql: `CREATE TABLE IF NOT EXISTS "webauthn_challenges" (
      "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
      "challenge"  TEXT NOT NULL,
      "kind"       TEXT NOT NULL,
      "user_id"    UUID,
      "expires_at" TIMESTAMP(3) NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("id")
    )`,
  },
];
