# Deploying ThinkThru (Vercel + Neon)

This guide takes the app from zero to a live deployment. It needs accounts you
own — a Neon database, a Vercel project, and a Google Cloud project for OAuth.
Optionally, an enterprise IdP for SSO.

---

## 1. Database — Neon Postgres

1. Create a project at <https://neon.tech>. Pick a region close to your Vercel
   region.
2. From the dashboard, copy **two** connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL` (used for migrations)
3. Keep `?sslmode=require` on both.

Apply the schema and load registries (run locally once, pointing at Neon):

```bash
cd web
DATABASE_URL=... DIRECT_URL=... npm run db:deploy   # applies migrations
DATABASE_URL=... DIRECT_URL=... npm run db:seed     # reaction + recognition rows
```

> First time only: generate the initial migration with
> `npm run db:migrate -- --name init` against a dev database, commit the
> `prisma/migrations` folder, then `db:deploy` runs it everywhere.

---

## 2. Google OAuth (personal sign-in)

1. <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → OAuth consent screen** → configure (External, add your
   domain, add the `email`, `profile`, `openid` scopes).
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized redirect URI:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Prod: `https://YOUR-APP.vercel.app/api/auth/callback/google`
5. Copy the Client ID/Secret → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

---

## 3. Enterprise SSO

The app ships a generic **OIDC** provider that lights up when `AUTH_SSO_*` env
vars are set. Most enterprise IdPs (Okta, Azure AD / Entra ID, Google
Workspace, Auth0, OneLogin) speak OIDC directly.

### OIDC IdP (recommended)

1. In your IdP, register a new OIDC web app.
2. Set the redirect URI to `https://YOUR-APP.vercel.app/api/auth/callback/sso`.
3. Collect the issuer URL, client ID, and client secret. Set:
   ```
   AUTH_SSO_ISSUER=https://your-org.okta.com
   AUTH_SSO_CLIENT_ID=...
   AUTH_SSO_CLIENT_SECRET=...
   AUTH_SSO_NAME=Okta
   ```
4. A **"Continue with {name}"** button appears on the login page automatically.

To auto-place SSO users into an org by email domain, set that org's
`ssoDomain` (e.g. `acme.com`) — matching users join on first sign-in.

### SAML-only IdP

If your IdP only supports SAML, bridge it to OIDC with
[SAML Jackson](https://github.com/boxyhq/jackson) (self-host or BoxyHQ cloud).
Jackson exposes a standard OIDC endpoint; point the `AUTH_SSO_*` vars at
Jackson instead of the IdP. (Hooking Jackson up is the one piece that needs
infra beyond this repo — the auth layer itself is already SSO-ready.)

---

## 4. Vercel (deploys + preview URLs)

1. Import the GitHub repo at <https://vercel.com/new>.
2. **Root Directory → `web`** (the app is not at the repo root).
3. Framework preset: **Next.js** (build command `npm run build` is already set
   and runs `prisma generate` first).
4. Add environment variables (from `.env.example`):
   - `DATABASE_URL`, `DIRECT_URL`
   - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
   - `AUTH_SSO_*` (optional)
5. Deploy. After the first deploy, add the production callback URLs to Google
   (and your SSO IdP), then redeploy if you changed env vars.

Once imported, Vercel's **Git integration** is automatic: every push to `main`
ships to production, and every PR gets a preview URL. No deploy workflow needed
on the GitHub side.

---

## 5. CI/CD (GitHub Actions)

Two workflows live in `.github/workflows`:

- **`ci.yml`** — on every PR and push to `main`: installs, generates the Prisma
  client, typechecks, and builds. This is the quality gate that runs alongside
  Vercel's preview deploy.
- **`migrate.yml`** — on push to `main`: runs `prisma migrate deploy` against
  your production database.

### Repo secrets (Settings → Secrets and variables → Actions)

| Secret         | Value                                  |
| -------------- | -------------------------------------- |
| `DATABASE_URL` | Neon **pooled** connection string      |
| `DIRECT_URL`   | Neon **direct** connection string      |

### One-time: create the initial migration

The repo uses Prisma Migrate in production. Generate the first migration once,
locally, against a dev database (a Neon branch is ideal), then commit it:

```bash
cd web
npm run db:migrate -- --name init     # creates prisma/migrations/…/migration.sql
git add prisma/migrations && git commit -m "Add initial migration"
```

After that, `migrate.yml` applies migrations automatically on every merge to
`main`. (For quick experiments without migration history, `npm run db:push`
syncs the schema directly — but prefer committed migrations for production.)

> Ordering note: `migrate.yml` and Vercel's deploy both trigger on push to
> `main` and run concurrently. For v1 with no production data this is fine; if
> you later need strict "migrate-before-deploy" ordering, gate the Vercel
> deploy on the Action via a deploy hook.

---

## 5b. Invites & email (Resend) — optional

Invite *links* work with no setup (the UI shows a copyable link). To have the
app **send invite emails**, configure Resend:

1. Create an account at <https://resend.com> → **API Keys** → create one →
   set `RESEND_API_KEY`.
2. Sender address (`RESEND_FROM`):
   - **Testing:** use `ThinkThru <onboarding@resend.dev>` (Resend's shared sender) —
     works immediately, can only email your own verified address.
   - **Production:** **Domains** → add and verify your domain (SPF/DKIM DNS
     records) → use e.g. `ThinkThru <invites@yourdomain.com>`.
3. Set `APP_URL` to your deployed URL so invite links point at the right place
   (e.g. `https://your-app.vercel.app`).

Add `RESEND_API_KEY`, `RESEND_FROM`, and `APP_URL` to `.env` (local) and Vercel
(prod). Without `RESEND_API_KEY`, invites still work as shareable links.

---

## 5c. Claude AI (Anthropic) — optional but recommended

Two features are powered by Claude:

- **AI bloom synthesis** — when a seed blooms, Claude distills the whole thread
  into the durable summary (instead of a deterministic concatenation).
- **@claude participant** — tagging `@claude` in any contribution gets a reply,
  posted as a contribution by the "Claude" system user.

Setup: create a key at <https://console.anthropic.com/settings/keys> and set
`ANTHROPIC_API_KEY` in `.env` (local) and Vercel (prod). If it's unset, blooms
fall back to a deterministic summary and `@claude` mentions go unanswered — the
app still works either way.

---

## 5d. File uploads (Vercel Blob) — optional

Lets members attach images, videos, and screenshots to contributions.

1. In Vercel → your project → **Storage** → **Create** a **Blob** store and
   connect it. Vercel sets `BLOB_READ_WRITE_TOKEN` on the project automatically.
2. For local dev, copy that token into `.env`.

If `BLOB_READ_WRITE_TOKEN` is unset, the **📎 Attach** button is hidden and
everything else works normally. Uploads go straight from the browser to Blob
(so large videos aren't limited by the serverless body size); max 100 MB.

---

## 6. Post-deploy checklist

- [ ] `migrate.yml` (or a local `db:deploy`) and `db:seed` have run against the production database
- [ ] Google sign-in works (callback URL matches exactly)
- [ ] First user can create an org and a garden
- [ ] Planting a seed, contributing, and stage-voting persist across reloads
- [ ] A seed crossing the bloom threshold creates a bloom + Sacred Tree entry

---

## Environment variables reference

See [`.env.example`](.env.example) for the complete, commented list.

---

## Performance: why the first load can be slow (and the fixes)

The first page after sign-in (`/`) waits on the database before it can paint —
that's the pulsing emblem ("splash"). On a warm function this is fast; the slow
case is a **cold start**, and almost all of it is the database, in this order of
impact:

1. **Neon compute auto-suspend (biggest).** On Neon's free/launch tier the
   Postgres compute suspends after ~5 min idle. The first visitor after a quiet
   spell waits for Postgres itself to boot (often 1–3 s). Fix in the Neon
   dashboard → your project → **Compute** → either raise the *Suspend timeout*
   (or disable it) on a paid plan, or accept the first-hit cost. This single
   setting usually explains a multi-second splash.

2. **Vercel ↔ Neon region mismatch.** If the Vercel function region isn't the
   same as the Neon region, every query crosses the continent — and the home
   page does two of them in series. Check Neon (project → **Settings** → region)
   and Vercel (Project → **Settings** → **Functions** → region), then pin them
   to match by adding to `vercel.json`:

   ```json
   { "regions": ["<neon-region, e.g. bom1 / iad1 / sin1>"] }
   ```

   Use the Vercel region code closest to your Neon region. This is free and can
   be the largest win if they're currently mismatched.

3. **Cold connection handshake → Neon serverless driver.** Classic Prisma opens
   a fresh TCP+TLS connection on every cold invocation. The Neon serverless
   driver connects over a WebSocket proxy instead, which is faster to establish.
   It's already wired and ships **off** by default. To turn it on safely:
   - Set `NEON_SERVERLESS=1` as an env var on a **Preview** environment first.
   - Open a preview deploy, confirm pages load normally.
   - Then add the same var to **Production** and redeploy.
   (`DATABASE_URL` must be a Neon connection string — it is.)

Already shipped in code: the home page now issues two serial DB round-trips
instead of three before first paint.
