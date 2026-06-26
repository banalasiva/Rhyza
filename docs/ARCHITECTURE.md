# Rhyza — Architecture Guide

> Written for engineers building Rhyza from this prototype. Assumes the team is 2–5 engineers and the product will evolve significantly. Optimized for speed of iteration, not premature optimization.

---

## Core Principle

**Build for change, not for completeness.**

Rhyza's feature set will evolve rapidly. The Learning module is module 1 of 6 (Learn, Achieve, Help, Help-others, Meet, Explore). Reactions, thread types, media types, and dimensions will be added without warning. Architect for extension, not for prediction.

---

## Recommended Stack

### Frontend
```
Next.js 14 (App Router)
  ├── React 18 (Server + Client components)
  ├── Tailwind CSS (utility-first, easy to maintain across contributors)
  ├── Framer Motion (animations — plant growth, bloom celebration, panel transitions)
  ├── tiptap (rich text editor — replaces the contentEditable prototype)
  └── Zustand (lightweight client state — no Redux overhead)

Mobile:
  ├── PWA first (service worker, offline seeds, push notifications)
  └── React Native (Expo) for native app when PWA coverage is insufficient
      — share business logic and API client between web and native
```

### Backend
```
Node.js + Fastify (or Bun + Hono for performance)
  ├── tRPC (type-safe API — eliminates REST/GraphQL boilerplate)
  ├── Prisma (ORM — schema-first, migrations, type safety)
  └── Zod (runtime validation — shared with frontend)

Real-time:
  └── Ably or Soketi (WebSocket pub/sub)
      — do NOT use Supabase Realtime for this; it can't handle the
        bloom broadcast patterns cleanly at scale
```

### Database
```
PostgreSQL (primary — all structured data)
  ├── pgvector extension (semantic search on seeds, blooms, contributions)
  └── Full-text search (tsvector on seed titles, content, bloom summaries)

Redis (ephemeral)
  ├── Watcher counts (seed viewers, garden online count)
  ├── Bloom vote aggregates (fast reads during voting surge)
  └── Rate limiting, session cache

Object Storage (S3-compatible)
  └── Attachments, images, videos uploaded to contributions
```

### Search
```
PostgreSQL FTS + pgvector hybrid:
  ├── Lexical search: tsvector on seeds.title, seeds.content, blooms.summary
  ├── Semantic search: pgvector embeddings (OpenAI text-embedding-3-small)
  └── Unified /search endpoint: re-ranks by (BM25 score × 0.4) + (cosine similarity × 0.6)

Search scope:
  ├── Gardens (name, description)
  ├── Seeds (title, content, contributions)
  ├── Blooms (title, summary, version content)
  ├── Members (name, recognition labels)
  └── Cross-module (when other modules launch)

UI: Cmd+K global search modal, results grouped by type.
```

### AI
```
Anthropic Claude (claude-3-5-haiku for speed, claude-3-5-sonnet for quality)
  ├── Bloom synthesis: streams summary as contributions accumulate
  ├── Convergence signal: classifies discussion as converging/diverging
  ├── Dimension classifier: auto-tags new contributions by dimension type
  └── Smart notifications: summarizes what you missed since last visit

Trigger: background jobs (not blocking the write path)
  └── BullMQ (Redis-backed job queue) for AI tasks
```

---

## Real-Time Architecture

### The Bloom Broadcast Problem

When a seed crosses the bloom threshold, **every user viewing that seed** must see the animation fire simultaneously. This is the hardest real-time requirement.

```
User votes → POST /seeds/:id/stage-votes
  → DB write
  → Check threshold
  → If met: publish to Ably channel `seed:{id}:bloom`
      → All connected clients receive event
      → Each client fires bloom animation independently
      → Toast: "X's vote tipped this seed into Bloom"
```

### Channel Architecture (Ably)

```
garden:{gardenId}                    // Garden-level events
  ├── presence                       // Who's online in this garden
  ├── seed.created                   // New seed planted
  └── bloom.created                  // New bloom added to Sacred Tree

seed:{seedId}                        // Seed-level events
  ├── presence                       // Watcher count
  ├── contribution.created           // New contribution in any dimension
  ├── reaction.toggled               // Reaction count update
  ├── stage-vote.cast                // Stage vote distribution update
  └── bloom                          // THE moment — fires for all viewers

user:{userId}                        // Personal channel
  ├── notification                   // Incoming notification
  └── endorsement.received           // Someone endorsed you
```

### Watcher Count (Ephemeral)

```
On seed page mount:  POST /seeds/:id/presence/enter  → Redis INCR
On seed page unmount: POST /seeds/:id/presence/leave  → Redis DECR
Polling: GET /seeds/:id/presence every 5s (or Ably presence)
```

---

## Module System

Rhyza is **not** one app. It is 6 worlds that share:
- Identity (users, profiles, recognition)
- Gardens (the container primitive)
- Notifications
- Search
- Sacred Tree (cross-module knowledge)

```
/modules
  ├── learning/     ← This prototype. Seeds → Blooms → Sacred Tree.
  ├── achievement/  ← "I want to achieve." Projects, milestones, progress.
  ├── help/         ← "I need help." Matchmaking, async Q&A, office hours.
  ├── mentorship/   ← "I want to help." Mentor matching, session booking.
  ├── network/      ← "I want to meet people." Discovery, introductions.
  └── explore/      ← "I want to explore." Serendipity, surprise connections.
```

Each module is a Next.js route group: `/(learning)`, `/(achievement)`, etc. They share:
- `/components/shared/` — Avatar, Garden card, Notification panel, Profile
- `/lib/api/` — API client (tRPC)
- `/lib/realtime/` — Ably hooks
- `/lib/search/` — Search client

### Contribution Type Registry

Reaction emojis, contribution types (Foundations, Understanding, etc.), and dimension labels are **not hardcoded**. They live in the database:

```sql
CREATE TABLE contribution_types (
  id         uuid PRIMARY KEY,
  module_id  uuid REFERENCES modules(id),
  emoji      text,
  label      text,
  description text,
  sort_order  int,
  is_active   boolean DEFAULT true
);
```

When a new emoji or dimension is added, insert a row. No deploy needed.

---

## Mobile Strategy

### PWA First
```
- Installable (manifest.json, service worker)
- Offline: cache garden home + seed content for last 3 visited seeds
- Push notifications: Web Push for bloom events, stage changes
- Bottom navigation: Intent · Gardens · Notifications · Profile
- Bottom sheet pattern for dimension threads (prototype shows this)
```

### Responsive Breakpoints
```
mobile:  < 700px  → stacked layout, bottom tab bar, sheet modals
tablet:  700–1024px → hybrid (side panel as drawer, not fixed)
desktop: > 1024px → 2-column seed view, persistent side panel
```

### Touch Interactions
```
- Long-press contribution → reaction picker (iOS-style)
- Swipe left on seed card → quick vote options
- Pull-to-refresh on garden home
- Haptic feedback on bloom vote (navigator.vibrate([100, 50, 200, 50, 100]))
```

---

## Media Support Roadmap

### Phase 1 (now): Text + Images
```
- Rich text: bold, italic, code, blockquote, links (tiptap)
- Image upload: drag-drop or picker → S3 → CDN URL stored in contribution.attachments[]
- Link unfurl: OG metadata fetched server-side, rendered as card
```

### Phase 2: Video
```
- Upload: chunked upload to S3 (tus protocol)
- Transcode: FFmpeg via background job → 360p/720p/1080p HLS
- Player: Video.js or Plyr (lightweight)
- Inline in contributions: thumbnail + duration chip
```

### Phase 3: Video Calls (Learning Circles)
```
- Daily.co or Livekit (WebRTC, self-hostable)
- "Learning Circle" = scheduled video session within a Garden
- Recording → auto-transcribed → stored as contribution in the relevant seed
- Transcript becomes searchable, quotable, linkable
```

---

## Open Source Structure

```
rhyza/
├── apps/
│   ├── web/          ← Next.js app
│   └── mobile/       ← Expo (React Native)
├── packages/
│   ├── api/          ← tRPC router, Prisma schema
│   ├── ui/           ← Shared component library (Storybook)
│   ├── realtime/     ← Ably hooks and channel constants
│   └── config/       ← ESLint, Prettier, TypeScript base configs
├── infra/
│   ├── docker/       ← Local dev: Postgres, Redis, Ably self-host
│   └── terraform/    ← Production infrastructure (optional)
└── design/
    └── handoff/      ← This package
```

### Turborepo (monorepo)
```bash
pnpm install         # install all workspaces
pnpm dev             # run web + api in parallel
pnpm db:migrate      # run Prisma migrations
pnpm db:seed         # seed demo data (Kubernetes garden)
```

---

## Security

```
Auth:    Better Auth or NextAuth v5 (SSO via SAML for enterprise, OAuth for personal)
Authz:   Row-level security in Postgres (garden membership gates all reads)
Content: No LLM output shown without human review in production Bloom synthesis
Files:   Signed S3 URLs (15min expiry), virus scan on upload
Rate:    Redis sliding window on all write endpoints
```

---

## Performance Targets

```
LCP (Largest Contentful Paint):  < 1.8s on 4G mobile
Bloom animation:                 60fps (requestAnimationFrame, not CSS timeout)
Search results:                  < 200ms p95
WebSocket event delivery:        < 100ms p95
```
