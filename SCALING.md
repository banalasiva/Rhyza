# Scaling ThinkThru — a runbook to 1M downloads

**Read this first:** "1M downloads" is not "1M concurrent users." A healthy
consumer app sees maybe 20–40% install → active, and of those a low single‑digit
% are online at the same time. So 1M downloads ≈ **5k–20k daily actives** and
**a few hundred concurrent** at peak. That is a very manageable load for this
stack — the architecture is already fundamentally scalable (stateless serverless
+ pooled Postgres). Most of the work below is **configuration and cost**, not
code.

This runbook is ordered: do the top items before you need them; the bottom items
only matter once you actually have the traffic. Each item lists the **signal**
that tells you it's time.

---

## The stack, and how each piece scales

| Layer | Tech | Scales by |
|---|---|---|
| App / API | Next.js on Vercel (serverless) | Automatic — Vercel spins functions up/down. Cost is per‑invocation. |
| Database | Neon Postgres | Compute autoscaling + a connection **pooler**. This is the #1 thing to get right. |
| Auth | Auth.js v5 (JWT sessions) | Stateless — no DB hit to verify a session. Already scalable. |
| Push | Web Push (VAPID) | Fan‑out is the bottleneck; move to a queue at high scale. |
| AI | Anthropic + OpenAI | Rate limits + $ — cap spend, route to cheaper models. Already done. |
| Files | Vercel Blob | CDN‑backed. Scales without work. |
| Static pages | `/about`, `/guidelines`, `/privacy` | Pre‑rendered → served from CDN. Near‑zero cost. |

---

## 1. Database — the one that actually breaks first

Serverless + Postgres has one classic failure mode: **connection exhaustion**.
Every warm function instance holds a DB connection; a traffic spike opens
hundreds at once and Postgres refuses new ones. Two defenses, both already
supported in the code:

- **Use Neon's pooled connection string.** In Vercel env, `DATABASE_URL` must be
  the **`-pooler`** host (PgBouncer), e.g.
  `postgres://…@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require`.
  Keep a **direct** (non‑pooler) URL as `DIRECT_URL` for migrations only.
  ✅ Signal it's wrong: errors like `sorry, too many clients already` or
  `remaining connection slots are reserved`.
- **Or flip on Neon's serverless driver.** Set `NEON_SERVERLESS=1` (see
  `web/src/lib/db.ts`) to connect over Neon's WebSocket proxy instead of a fresh
  TCP+TLS handshake per cold start. Test on a Vercel **preview** first, then
  promote. This also cuts cold‑start latency.

Then:
- **Neon compute:** enable **autoscaling** (min 0.25–1 CU, max grows with load)
  and a sensible **scale‑to‑zero** timeout. Bump the max as DAU grows.
- **Indexes:** the hot paths (feed, notifications, contributions, search FTS,
  seed_topics, quorum) are already indexed — see `web/prisma/migrations` and
  `web/src/lib/pending-ddl.ts`. When you add a new frequent query, add its index
  in the same PR.
- **Read replicas:** only if read load dominates (Explore/feed at high DAU). Neon
  supports replicas; point read‑only queries at them. Not needed until ~50k DAU.

**Cost sketch:** Neon Launch/Scale plans run roughly \$20–\$70/mo at small scale,
climbing with compute‑hours. Autoscaling keeps the idle cost low.

---

## 2. Vercel — mostly automatic, watch the invocation bill

- Functions scale automatically; you pay per invocation + compute time. The
  **Pro** plan is fine well into tens of thousands of DAU; talk to Vercel about
  **Enterprise** only if you hit concurrency limits or want committed pricing.
- **Keep static pages static.** `/about`, `/guidelines`, `/privacy`,
  `/delete-account` have no per‑user data and are pre‑rendered — don't add
  `force-dynamic` to them. The app pages are correctly per‑user dynamic.
- **Set a Vercel spend limit / budget alert** so a spike (or abuse) can't run up
  a surprise bill.
- **Region:** pin the app and Neon to the **same region** (low DB latency). For a
  primarily‑India audience, use an India/Singapore region for both.

---

## 3. Notification fan‑out — the code bottleneck at scale

The instant per‑event path (`deliver()` in `web/src/lib/services/notify.ts`) is
fine — it fans out to the handful of people involved in one seed.

The **cron fan‑out** (the daily "Good morning 🌱" in `web/src/lib/services/morning.ts`)
is the thing that eventually can't finish in one function run, because it pushes
to *every* user. It's now hardened with **bounded concurrency** (`mapLimit`) and
a **cap** (`PUSH_FANOUT_CAP`, default 20k) that **logs** instead of silently
dropping. Tuning knobs (Vercel env):
- `PUSH_FANOUT_CONCURRENCY` (default 24) — how many pushes in flight at once.
- `PUSH_FANOUT_CAP` (default 20000) — max recipients per run.

**When DAU pushes past the cap** (you'll see the `[morning] hit fan-out cap`
warning), move the fan‑out to a **queue**:
1. Cron enqueues user‑id chunks (e.g. **Upstash QStash** or **Vercel Queues**).
2. A worker route drains a chunk per invocation, pushing with `mapLimit`.
3. This makes fan‑out horizontal and immune to the function timeout.

Also prune dead push subscriptions: on a `410/404` from the push service, delete
that subscription row (keeps fan‑out from wasting work on uninstalled devices).

---

## 4. AI — protect cost and rate limits

Already in place: Haiku routing for cheap/frequent tasks, bounded `max_uses` on
web search, a monthly AI‑tag meter, and hard spend caps at the provider. To stay
safe at scale:
- Keep **hard spend caps** set at Anthropic and OpenAI (you did this).
- Per‑user **rate limiting** on the AI‑tag and image endpoints (there's a
  `rate_limits` table + `enforceRateLimit`). Apply it to any new AI route.
- If AI‑tagging becomes the paid tier, the monthly per‑user limit doubles as a
  cost ceiling.
- Watch provider **rate limits** (RPM/TPM); request a limit increase before a
  launch push, not during it.

---

## 5. Abuse & safety at scale

More users → more spam/abuse surface.
- **Rate‑limit** sign‑ups, seed/garden creation, and AI calls (table already
  exists) so one actor can't flood.
- The **reports queue** + guidelines + owner/app‑owner moderation are already
  built. At scale, add a lightweight **auto‑flag** for public content and a
  **user‑ban** capability (schema hook: `users.deletedAt` already gates access).
- Keep CSAM reporting posture as documented in the guidelines.

---

## 6. Observability — you can't scale what you can't see

Before a big launch, wire up:
- **Error tracking** (Sentry) on the app + cron routes.
- **Uptime + latency** monitoring on `/`, `/api/health` (add one), and a DB
  ping.
- **Neon dashboard** alerts on connection count and compute saturation.
- **Vercel** usage + spend alerts.
- A simple **admin metrics** view (you already have members/AI stats on `/admin`)
  — add DAU/WAU when you want product signal.

---

## Do‑now checklist (before the Play launch scales)

- [ ] `DATABASE_URL` points at the **Neon pooler**; `DIRECT_URL` set for migrations.
- [ ] Neon **autoscaling** on; app + DB in the **same region**.
- [ ] Vercel **spend limit / budget alerts** on.
- [ ] Anthropic + OpenAI **hard spend caps** on (done).
- [ ] `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, VAPID keys, `CRON_SECRET`,
      `BLOB_READ_WRITE_TOKEN` all set in **Production**.
- [ ] Google OAuth consent screen **published** (In production), not Testing.
- [ ] **Sentry** (or similar) on app + crons.
- [ ] Load‑test the feed + a hot seed with a few hundred virtual users (k6) once,
      to confirm the pooler + Neon autoscaling hold.

## Later (only when the signals say so)

- [ ] Move morning/nudge fan‑out to a **queue** (QStash / Vercel Queues) — when
      you see the `[morning] hit fan-out cap` warning.
- [ ] Neon **read replica** for feed/Explore — around ~50k DAU.
- [ ] Vercel **Enterprise** — only if you hit concurrency ceilings.
- [ ] Prune dead push subscriptions on 410/404.
- [ ] Auto‑flag for public content + user‑ban.

---

_The short version: get the **Neon pooler**, **autoscaling**, **spend caps**, and
**monitoring** in place now — the app code is already stateless and scalable. The
only piece that needs real re‑architecting for true mass scale is the daily push
fan‑out, and that's a queue swap you make exactly when the cap‑warning fires, not
before._
