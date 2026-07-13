# ThinkThru — Security, Performance & Scale Review

A full audit (security / performance / reliability) with the path to ~1M concurrent
users. Items marked **[done]** are fixed in code; **[next]** are cheap follow-ups;
**[infra]** need services/budget and aren't worth doing until real traffic warrants.

## Bottom line
Security is fundamentally sound (no auth bypass, no SQL injection, no IDOR, admin
fails closed, uploads/emails/XSS handled). The wall to 1M concurrent is the
**execution model**, not the code correctness: client polling as the real-time
transport, fire-and-forget background work on serverless, single-invocation cron
fan-out, and no observability.

## Fixed (this pass)
- **[done]** Email-directory enumeration via `/addable` — names only + rate-limited.
- **[done]** `allowDangerousEmailAccountLinking` removed from the generic SSO provider (kept on Google only).
- **[done]** Bloom edits require steward; retag/classify are author-or-steward.
- **[done]** Cron auth trusts only the un-forgeable `x-vercel-cron` header (no UA fallback).
- **[done]** AI clients have explicit `timeout`/`maxRetries`.
- **[done]** Cron routes have `maxDuration` (was unset → killed mid-fan-out).
- **[done]** `@@index([seedId, createdAt])` on contributions — the hottest query.
- **[done]** `/api/version` is CDN-cacheable (was `force-dynamic`, polled every 60s/client).
- **[done]** "Added by someone not in your circle → leave?" banner (open discoverability with consent-after-the-fact).
- **[done]** Poll pause on `document.hidden` (sync/polls/status/quorum) — no wasted load on backgrounded tabs.
- **[done]** Nightly retention cron (`/api/cron/cleanup`): bounded deletes of expired rate_limits, old read notifications, old auth/AI-tag events.

## The three walls to 1M concurrent (ranked)

### 1. Polling transport — the dominant DB-load driver
Every open seed has each client polling `sync` (4s), `polls` (4s), `status` (5s),
`quorum` (4s), `deadline` (15s). At 1M concurrent that's ~250k–1M req/s and
**millions of DB queries/s** against one Neon primary (≈1000× capacity). The 4s
`sync` also re-reads the *entire* thread each time (`getSeedSync`, no `since`
cursor).
- **[next]** Incremental sync: `since`/version cursor + reactions/edits delta (return `{version,count}`, fetch bodies only on change). Collapse the 4 polls into one `/sync`. **This is the biggest single win and the riskiest — do it as its own tested pass.**
- **[infra]** Replace polling with SSE or a managed realtime service (Ably/Pusher/Supabase Realtime) + Neon `LISTEN/NOTIFY` or Redis pub/sub. One channel per open seed instead of 4 polls/user.

### 2. Fire-and-forget background work dies on serverless
No `after()`/`waitUntil()` anywhere, so every `void fn()` (kickstart openers,
follow/notify fan-out, mediator sensing) intermittently never completes after the
response is sent — no error, no retry.
- **[next]** Enable Next `experimental.after` (14.2) or `waitUntil` from `@vercel/functions` for the critical ones (kickstart).
- **[infra]** A durable job queue (Inngest / QStash / SQS+worker) for ALL async work, with retry/backoff/dead-letter/idempotency.

### 3. Cron fan-out + no observability
Push/digest fan out inline from a single invocation with hard caps (`take:5000`,
`CAP:20000`) and sequential email sends → time out, silently drop recipients,
lose digests outside the 24h window. Everything else swallows errors to
`console.error` with nothing paged.
- **[infra]** Crons become producers that page a durable cursor and enqueue per-recipient jobs; workers batch push/email. Add Sentry + metrics (delivery rate, queue depth, cron heartbeat, DB error rate) with alerts. Generalize the `auth_events` → admin sev2 pattern.

## Other notable findings
- **[infra]** No connection pooling by default (`NEON_SERVERLESS=1` is off) → connection exhaustion under serverless fan-out. Adopt Prisma Accelerate or Neon pooler-by-default + read replicas.
- **[infra]** No caching layer. Cache the per-seed sync snapshot, feed public/blooms pages, blooms (immutable) in Redis/KV.
- **[infra]** Rate limiter is a Postgres write hotspot that fails open under DB stress. Move to Redis (Upstash) atomic INCR.
- **[next]** Missing indexes: feed "mine" `(orgId/gardenId, lastActivityAt)`; notification read-back `(entityId, anchorId)`; partial indexes on cron opt-in predicates (`users.pushNotify/digestNotify`).
- **[next]** Idempotency: unique/dedupe keys on notifications `(recipientId,type,entityId)`, quorum auto-reveal, `announceJoin` — replicate the bloom `@@unique([seedId,version])` pattern. (Races are rare per-seed but guaranteed across 1M users → duplicate notifications.)
- **[next]** Retention: covering indexes so cron predicates don't join to `users`; extend cleanup to `poll_votes`/`stake_ratings` growth as needed.
- **[infra]** Domain-based org auto-join confers owner to the first `@company.com` arrival with no domain-ownership check — gate behind admin-verified domains before enterprise use.
- **[next]** Private-garden invite links aren't email-scoped (a leaked link joins the org) — apply the same request-to-join gate the private-seed branch uses.

## Suggested sequencing
1. Ship the fixes above (done) + wire observability (**[infra]** Sentry) — makes everything else measurable.
2. Incremental sync + poll consolidation (**[next]**) — ~90% of the polling load, no new infra.
3. When traffic warrants: realtime transport, job queue, Redis, pooling+replicas, CDN (**[infra]**).

**Reality check:** at family/friends scale, the security fixes and the `[next]`
code wins are worth doing; the `[infra]` program is premature until you have real
traffic — but build toward it.
