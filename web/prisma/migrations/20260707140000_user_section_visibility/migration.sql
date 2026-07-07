CREATE TABLE IF NOT EXISTS "user_section_visibility" (
  "user_id" UUID    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "section" TEXT    NOT NULL,
  "public"  BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "user_section_visibility_pkey" PRIMARY KEY ("user_id", "section")
);
