-- Snapshot of the quorum at lock time.
ALTER TABLE "seed_stake" ADD COLUMN "locked_participants" JSONB NOT NULL DEFAULT '[]';

-- Admission requests for newcomers to a locked decision quorum.
CREATE TABLE "stake_admissions" (
    "seed_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stake_admissions_pkey" PRIMARY KEY ("seed_id","candidate_id")
);
CREATE INDEX "stake_admissions_seed_id_idx" ON "stake_admissions"("seed_id");

CREATE TABLE "stake_admission_votes" (
    "seed_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "voter_id" UUID NOT NULL,
    "approve" BOOLEAN NOT NULL,
    "voted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stake_admission_votes_pkey" PRIMARY KEY ("seed_id","candidate_id","voter_id")
);

ALTER TABLE "stake_admissions" ADD CONSTRAINT "stake_admissions_seed_id_fkey" FOREIGN KEY ("seed_id") REFERENCES "seeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stake_admission_votes" ADD CONSTRAINT "stake_admission_votes_admission_fkey" FOREIGN KEY ("seed_id","candidate_id") REFERENCES "stake_admissions"("seed_id","candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
