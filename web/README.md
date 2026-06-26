# Rhyza — Web App

The real Learning module, built from the design prototype in `../prototype`.
This is a fresh Next.js 14 application with a real database, authentication, and
API — no hardcoded demo content.

## Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS              |
| Auth     | Auth.js v5 (NextAuth) — Google OAuth + enterprise OIDC SSO   |
| Data     | PostgreSQL via Prisma                                        |
| Hosting  | Vercel + Neon Postgres (see `DEPLOY.md`)                     |

Real-time (Ably), AI bloom synthesis, media uploads, and the other five
modules are deferred to phase 2 — see `../docs/ARCHITECTURE.md`.

## What works in v1

The full Learn vertical slice, on real persisted data:

- **Sign in** with Google or enterprise SSO
- **Onboarding** — create your organization on first run
- **Gardens** — create gardens, browse your org's gardens
- **Seeds** — plant a question, contribute across the five dimensions
  (Foundations · Understanding · Application · Debate · Bloom), react, and vote
  on the seed's stage
- **Bloom** — when stage votes cross the threshold, the seed blooms into a
  permanent knowledge record with attributed contributors
- **Sacred Tree** — every bloom the community has grown, remembered forever

Reaction types and recognition labels live in the database (`prisma/seed.ts`),
so they extend by inserting rows — not by shipping code.

## Local development

Prerequisites: Node 20+, a Postgres database (local Docker or a Neon branch),
and Google OAuth credentials.

```bash
cd web
cp .env.example .env          # then fill in DATABASE_URL, AUTH_SECRET, Google creds
npm install                   # runs `prisma generate`
npm run db:push               # create tables (or `npm run db:migrate` for migrations)
npm run db:seed               # load reaction + recognition registries
npm run dev                   # http://localhost:3000
```

> Note: `npm install` and `prisma generate` need network access to npm and
> Prisma's binary host. In a locked-down sandbox these may be blocked — run the
> install on an unrestricted machine or in CI/Vercel.

## Project layout

```
web/
├── prisma/
│   ├── schema.prisma      # full data model (docs/DATA_MODEL.md)
│   └── seed.ts            # registries only — no demo user data
├── src/
│   ├── app/              # App Router pages + /api route handlers
│   ├── components/       # client components (forms, the Seed room)
│   ├── lib/
│   │   ├── services/     # domain logic shared by pages and API routes
│   │   ├── authz.ts      # membership/authorization checks
│   │   ├── auth.ts       # NextAuth instance (Node runtime, Prisma adapter)
│   │   └── ...
│   ├── auth.config.ts    # edge-safe auth config (providers, callbacks)
│   └── middleware.ts     # route protection
└── DEPLOY.md             # Neon + Vercel + Google + enterprise SSO setup
```

## API

REST route handlers under `src/app/api` mirror `../docs/API.md` for the v1
surface (gardens, seeds, contributions, reactions, stage votes, blooms, sacred
tree, users/me, notifications). All writes are Zod-validated and gated by org /
garden membership. Errors use the `{ error: { code, message, status } }`
envelope from the spec.
