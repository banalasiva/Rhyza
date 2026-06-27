-- Garden & Seed visibility
ALTER TABLE "gardens" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "seeds" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';

-- Seed-scoped invites
ALTER TABLE "invites" ADD COLUMN "seed_id" UUID;

-- CreateTable: members of private seeds
CREATE TABLE "seed_members" (
    "seed_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seed_members_pkey" PRIMARY KEY ("seed_id","user_id")
);

-- Foreign keys
ALTER TABLE "seed_members" ADD CONSTRAINT "seed_members_seed_id_fkey" FOREIGN KEY ("seed_id") REFERENCES "seeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seed_members" ADD CONSTRAINT "seed_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_seed_id_fkey" FOREIGN KEY ("seed_id") REFERENCES "seeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
