# Deploying Rhyza (Vercel + Neon)

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

## 4. Vercel

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

---

## 5. Post-deploy checklist

- [ ] `db:deploy` and `db:seed` have run against the production database
- [ ] Google sign-in works (callback URL matches exactly)
- [ ] First user can create an org and a garden
- [ ] Planting a seed, contributing, and stage-voting persist across reloads
- [ ] A seed crossing the bloom threshold creates a bloom + Sacred Tree entry

---

## Environment variables reference

See [`.env.example`](.env.example) for the complete, commented list.
