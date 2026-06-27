-- Stake-weighted quorum: peer-assessed stake ratings + per-seed stake config.

-- CreateTable: one rater's read of one person's stake in a seed.
CREATE TABLE "stake_ratings" (
    "seed_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "ratee_id" UUID NOT NULL,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stake_ratings_pkey" PRIMARY KEY ("seed_id","rater_id","ratee_id")
);

CREATE INDEX "stake_ratings_seed_id_idx" ON "stake_ratings"("seed_id");

ALTER TABLE "stake_ratings" ADD CONSTRAINT "stake_ratings_seed_id_fkey" FOREIGN KEY ("seed_id") REFERENCES "seeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stake_ratings" ADD CONSTRAINT "stake_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stake_ratings" ADD CONSTRAINT "stake_ratings_ratee_id_fkey" FOREIGN KEY ("ratee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: per-seed stake configuration (one row per seed).
CREATE TABLE "seed_stake" (
    "seed_id" UUID NOT NULL,
    "active_dimensions" JSONB NOT NULL DEFAULT '[]',
    "opt_outs" JSONB NOT NULL DEFAULT '[]',
    "phase" TEXT NOT NULL DEFAULT 'collecting',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seed_stake_pkey" PRIMARY KEY ("seed_id")
);

ALTER TABLE "seed_stake" ADD CONSTRAINT "seed_stake_seed_id_fkey" FOREIGN KEY ("seed_id") REFERENCES "seeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
