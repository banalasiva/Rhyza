# Rhyza — Data Model

All tables in PostgreSQL. UUIDs as primary keys. Soft deletes (`deleted_at`) throughout.

---

## Core Entities

### users
```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  name            text NOT NULL,
  avatar_url      text,
  bio             text,
  created_at      timestamptz DEFAULT now(),
  last_active_at  timestamptz,
  deleted_at      timestamptz
);
```

### organizations
```sql
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  logo_url    text,
  plan        text DEFAULT 'free',  -- free | pro | enterprise
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE org_members (
  org_id      uuid REFERENCES organizations(id),
  user_id     uuid REFERENCES users(id),
  role        text DEFAULT 'member',  -- member | admin | owner
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
```

---

## Gardens

### gardens
```sql
CREATE TABLE gardens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations(id) NOT NULL,
  module      text DEFAULT 'learning',  -- learning | achievement | help | mentorship | network | explore
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  emoji       text DEFAULT '🌱',
  stage       text DEFAULT 'germinating',  -- germinating | growing | thriving | dormant
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE garden_members (
  garden_id   uuid REFERENCES gardens(id),
  user_id     uuid REFERENCES users(id),
  role        text DEFAULT 'member',  -- member | caretaker | steward
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (garden_id, user_id)
);

-- Full-text search index
CREATE INDEX gardens_fts ON gardens USING gin(
  to_tsvector('english', name || ' ' || coalesce(description, ''))
);
```

---

## Seeds

### seeds
```sql
CREATE TABLE seeds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id       uuid REFERENCES gardens(id) NOT NULL,
  created_by      uuid REFERENCES users(id) NOT NULL,
  title           text NOT NULL,
  content         text NOT NULL,
  stage           text DEFAULT 'seed',
  -- seed | germinating | sprouting | growing | bloomed
  bloom_id        uuid,  -- set when seed blooms (FK to blooms table)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz,

  -- Full-text search vector (updated by trigger)
  fts_vector      tsvector GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || content)
  ) STORED
);

CREATE INDEX seeds_fts ON seeds USING gin(fts_vector);
CREATE INDEX seeds_garden_stage ON seeds(garden_id, stage) WHERE deleted_at IS NULL;
```

### seed_stage_votes
```sql
-- Each user can vote on what stage they perceive the seed to be at
-- The dominant vote determines the displayed stage
CREATE TABLE seed_stage_votes (
  seed_id     uuid REFERENCES seeds(id),
  user_id     uuid REFERENCES users(id),
  stage       text NOT NULL,  -- seed | germinating | sprouting | growing | bloomed
  voted_at    timestamptz DEFAULT now(),
  PRIMARY KEY (seed_id, user_id)
);

-- Aggregate view (materialized and refreshed on vote change)
CREATE MATERIALIZED VIEW seed_stage_distribution AS
SELECT seed_id,
       stage,
       COUNT(*) as votes,
       COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY seed_id) as pct
FROM seed_stage_votes
GROUP BY seed_id, stage;
```

---

## Contributions (The Thread)

### contributions
```sql
CREATE TABLE contributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id         uuid REFERENCES seeds(id) NOT NULL,
  parent_id       uuid REFERENCES contributions(id),  -- NULL = top-level
  author_id       uuid REFERENCES users(id) NOT NULL,
  dimension       text NOT NULL,
  -- foundations | understanding | application | debate | bloom
  content_type    text DEFAULT 'text',
  -- text | image | video | link | code | quote
  content         jsonb NOT NULL,
  -- { text: "...", formatting: {...}, attachments: [{type, url, meta}] }
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz,

  fts_vector      tsvector GENERATED ALWAYS AS (
    to_tsvector('english', content->>'text')
  ) STORED
);

CREATE INDEX contributions_seed_dim ON contributions(seed_id, dimension)
  WHERE deleted_at IS NULL AND parent_id IS NULL;
CREATE INDEX contributions_replies ON contributions(parent_id)
  WHERE parent_id IS NOT NULL;
CREATE INDEX contributions_fts ON contributions USING gin(fts_vector);
```

### contribution_reactions
```sql
-- Extensible: reaction types live in a registry table
CREATE TABLE contribution_reactions (
  contribution_id  uuid REFERENCES contributions(id),
  user_id          uuid REFERENCES users(id),
  reaction_key     text NOT NULL,
  -- clicked | beauty | mind | impl | ref | confuse | (future keys)
  reacted_at       timestamptz DEFAULT now(),
  PRIMARY KEY (contribution_id, user_id, reaction_key)
);

-- Registry of valid reaction types (add rows to extend, no deploy)
CREATE TABLE reaction_types (
  key         text PRIMARY KEY,
  emoji       text NOT NULL,
  label       text NOT NULL,
  module      text DEFAULT 'learning',
  sort_order  int DEFAULT 0,
  is_active   boolean DEFAULT true
);

-- Seed data
INSERT INTO reaction_types VALUES
  ('clicked',  '💥', 'It clicked',        'learning', 1, true),
  ('beauty',   '✨', 'Beautifully said',  'learning', 2, true),
  ('mind',     '🧠', 'Changed thinking',  'learning', 3, true),
  ('impl',     '🛠', 'I tried this',      'learning', 4, true),
  ('ref',      '📚', 'Great reference',   'learning', 5, true),
  ('confuse',  '🤔', 'Still confused',    'learning', 6, true);
```

### contribution_endorsements
```sql
-- Different from reactions: endorsements recognize the contributor's ROLE
CREATE TABLE contribution_endorsements (
  contribution_id  uuid REFERENCES contributions(id),
  endorser_id      uuid REFERENCES users(id),
  endorsed_at      timestamptz DEFAULT now(),
  PRIMARY KEY (contribution_id, endorser_id)
);
```

---

## Blooms

### blooms
```sql
CREATE TABLE blooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id       uuid REFERENCES gardens(id) NOT NULL,
  seed_id         uuid REFERENCES seeds(id) NOT NULL,
  version         int NOT NULL DEFAULT 1,
  title           text NOT NULL,
  summary         text NOT NULL,
  content         jsonb NOT NULL,    -- full bloom document (rich text)
  ai_synthesized  boolean DEFAULT true,
  bloomed_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES users(id),  -- who cast the tipping vote

  fts_vector  tsvector GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || summary)
  ) STORED,

  UNIQUE (seed_id, version)
);

-- Version history: each bloom is immutable; new discussion → new version
-- A seed can have bloom v1, v2, v3... each with its own contributors

CREATE INDEX blooms_garden ON blooms(garden_id, bloomed_at DESC);
CREATE INDEX blooms_fts ON blooms USING gin(fts_vector);
```

### bloom_contributors
```sql
-- Permanent lineage: who contributed to this specific bloom version
CREATE TABLE bloom_contributors (
  bloom_id      uuid REFERENCES blooms(id),
  user_id       uuid,        -- can be NULL if added manually (external person)
  email         text,        -- for manually added people
  name          text,
  role          text NOT NULL,
  contribution_type text,    -- seed_planter | explainer | practitioner | debater | mentor | community
  sort_order    int DEFAULT 0,
  added_by      uuid REFERENCES users(id),
  added_at      timestamptz DEFAULT now(),
  PRIMARY KEY (bloom_id, COALESCE(user_id::text, email))
);
```

### bloom_contributor_endorsements
```sql
CREATE TABLE bloom_contributor_endorsements (
  bloom_id      uuid REFERENCES blooms(id),
  contributor_user_id uuid,
  contributor_email text,
  endorser_id   uuid REFERENCES users(id),
  endorsed_at   timestamptz DEFAULT now()
);
```

---

## Recognition

### recognition_labels
```sql
-- Community-assigned labels (not self-declared, not AI-inferred)
CREATE TABLE recognition_labels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE,  -- thinker | explainer | practitioner | amplifier | mentor | explorer | debater
  emoji       text,
  label       text,
  description text
);

CREATE TABLE user_recognition (
  user_id     uuid REFERENCES users(id),
  label_key   text REFERENCES recognition_labels(key),
  garden_id   uuid REFERENCES gardens(id),  -- recognition is garden-scoped
  awarded_by  uuid REFERENCES users(id),
  awarded_at  timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, label_key, garden_id, awarded_by)
);

-- Aggregated view for profile display
CREATE VIEW user_recognition_summary AS
SELECT user_id, label_key, garden_id, COUNT(*) as endorsement_count,
       COUNT(*) * 100.0 / MAX(COUNT(*)) OVER (PARTITION BY user_id) as relative_pct
FROM user_recognition
GROUP BY user_id, label_key, garden_id;
```

---

## Notifications

### notifications
```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    uuid REFERENCES users(id) NOT NULL,
  type            text NOT NULL,
  -- stage_change | bloom | contribution | member_joined | endorsement | mention
  title           text NOT NULL,
  body            text,
  entity_type     text,   -- seed | bloom | garden | contribution
  entity_id       uuid,
  actor_id        uuid REFERENCES users(id),
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX notifications_recipient ON notifications(recipient_id, created_at DESC)
  WHERE read_at IS NULL;
```

---

## Search (Unified)

```sql
-- Search logs for analytics and ranking improvement
CREATE TABLE search_queries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id),
  org_id      uuid REFERENCES organizations(id),
  query       text NOT NULL,
  results_count int,
  clicked_entity_type text,
  clicked_entity_id   uuid,
  searched_at timestamptz DEFAULT now()
);
```

### Vector Embeddings (pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,   -- seed | bloom | contribution
  entity_id     uuid NOT NULL,
  embedding     vector(1536),    -- OpenAI text-embedding-3-small
  created_at    timestamptz DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops);
```

---

## Media Attachments

```sql
CREATE TABLE attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid REFERENCES contributions(id),
  uploader_id   uuid REFERENCES users(id),
  type          text NOT NULL,  -- image | video | file | link
  url           text NOT NULL,  -- CDN URL (signed for private orgs)
  thumbnail_url text,
  filename      text,
  file_size     bigint,
  mime_type     text,
  width         int,
  height        int,
  duration_sec  int,           -- for video
  og_title      text,          -- for link unfurls
  og_description text,
  og_image_url  text,
  created_at    timestamptz DEFAULT now()
);
```

---

## Key Indexes Summary

```sql
-- Fast garden home load
CREATE INDEX seeds_garden_recent ON seeds(garden_id, created_at DESC)
  WHERE deleted_at IS NULL AND stage != 'bloomed';

-- Bloom threshold check (called frequently during voting surge)
CREATE INDEX stage_votes_bloom ON seed_stage_votes(seed_id)
  WHERE stage = 'bloomed';

-- Real-time watcher presence (Redis, not Postgres)
-- Key: presence:seed:{seedId}  Value: SET of user_ids
-- TTL: 60s (refreshed by heartbeat every 30s)
```
