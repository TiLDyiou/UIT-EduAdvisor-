# CLAUDE.md

Operating guide for Claude Code, Cursor, GitHub Copilot, and any other AI assistant working on this repository. Humans should read it too — it's the fastest way to get oriented.

This file is mirrored by `AGENTS.md` (vendor-neutral pointer) and a condensed `.cursorrules`. Keep this file as the canonical source of truth and treat the others as derived.

## What this project is

Nextacular is an **open-source multi-tenant SaaS boilerplate** for Next.js. Users (typically indie hackers and small teams) fork it to skip the standard "auth + workspaces + teams + billing + custom domains" plumbing and jump straight to product code.

Optimize every change for **downstream forkers**, not just for this repo. Don't break the conventions in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md); don't add features that only make sense to one consumer.

## Tech stack

| Layer        | Choice                                                | Version  |
| ------------ | ----------------------------------------------------- | -------- |
| Framework    | Next.js (Pages Router)                                | 13.5.x   |
| Language     | TypeScript with `strict` + `noUncheckedIndexedAccess` | 5.6      |
| UI           | React 18 + Tailwind CSS 3 + Headless UI 1.7           | —        |
| Data         | Prisma + PostgreSQL                                   | Prisma 6 |
| Auth         | NextAuth 4 (Email magic link + Prisma adapter)        | 4.24     |
| Validation   | Zod (server) + `validator/` (client)                  | Zod 4    |
| Payments     | Stripe SDK + Stripe Checkout                          | 10.x     |
| Custom DNS   | Vercel Domains API                                    | —        |
| Email        | nodemailer; Mailpit for local capture                 | 7.x      |
| i18n         | i18next + react-i18next                               | 23.x     |
| Tests        | _not yet wired up_                                    | —        |
| Local infra  | Docker Compose (Postgres + Mailpit + Adminer)         | —        |
| Node runtime | 22 (Active LTS); pinned in `.nvmrc` and `engines`     | —        |

Major upgrades currently in scope for the next release (see `CHANGELOG.md` → Unreleased and the v2.0 plan in PRs/issues): Next 13 → 15, Pages Router → App Router, Headless UI 1 → 2, shadcn/ui adoption, NextAuth 4 → Auth.js v5. None of these have landed yet. Write code against the current stack.

## File map

```
prisma/
  schema.prisma          ← source of truth for the data model
  seed.ts                ← demo workspace + admin + teammates (run via `npm run seed`)
  services/              ← *the only place* `@prisma/client` is imported from
src/
  config/
    api-validation/      ← one Zod schema per API endpoint, re-exported from index.ts
    email-templates/     ← html() + text() generators per outgoing email type
    menu/                ← sidebar menu trees (workspace-scoped vs static)
    swr/                 ← SWR global config (fetcher + onError)
    subscription-rules/  ← per-plan quotas (FREE / STANDARD / PREMIUM)
  components/            ← presentational React: Button, Card, Modal, Sidebar, etc.
  hooks/
    data/                ← thin useSWR wrappers, one per data resource
  layouts/               ← AccountLayout, AuthLayout, LandingLayout, PublicLayout
  lib/
    client/              ← code safe to import from client components
    common/              ← code safe to import from either side
    server/              ← *server-only*; never import from client components
      authorization.ts   ← `requireWorkspaceOwner` / `requireWorkspaceMember`
      auth.ts            ← NextAuth `authOptions`
      raw-body.ts        ← Stripe webhook raw body reader
      stripe.ts          ← server Stripe client
      mail.ts            ← nodemailer transport + sendMail
      validate.ts        ← `parseBody(schema, body, res)`
  messages/              ← i18n catalogs (`en.json` only today)
  middleware.ts          ← subdomain → /_sites/[site] rewrite
  pages/
    api/                 ← all API routes (Pages Router)
    _sites/[site]/       ← rendered when the request comes in on a tenant subdomain
    account/             ← authenticated app pages (uses AccountLayout)
    auth/                ← login/magic-link UI
    teams/invite.tsx     ← join-by-link landing page
    index.tsx            ← marketing landing page
    _app.tsx             ← global providers (Session, SWR, Theme, Workspace, i18n)
  providers/             ← React context providers (currently: `workspace`)
  sections/              ← landing-page composition: Hero, Features, Pricing, etc.
  styles/globals.css     ← Tailwind directives + NProgress overrides
  types/                 ← global.d.ts (window.gtag), next-auth.d.ts (Session shape)
docs/
  ARCHITECTURE.md        ← multi-tenancy, auth, billing, data model
  CONVENTIONS.md         ← code conventions enforced across the repo
  RECIPES.md             ← copy-paste guides for common tasks
  ENV.md                 ← every environment variable, required vs optional
```

## Architecture in one paragraph

Each customer of a Nextacular-based app is a **Workspace**. A user creates workspaces and is automatically their `OWNER`; other users join via an invite link or are added via email. Workspaces can attach custom domains (via the Vercel API), so the same app serves the marketing page at `app.com`, the dashboard at `app.com/account/<slug>`, the tenant's subdomain at `<slug>.app.com`, and an optional custom domain `customer.com`. The middleware rewrites tenant requests into `/_sites/[site]` and the marketing/dashboard requests are served normally. Authentication is NextAuth magic-link email; sessions carry `userId` and an optional `subscription` field hydrated from the Stripe-backed `CustomerPayment` table.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full version.

## Conventions you must follow

These are enforced by either CI (lint, typecheck, format) or convention (we won't merge a PR that violates them).

1. **Authorization on workspace-scoped routes.** Any API route that reads or writes data belonging to a workspace MUST call `requireWorkspaceOwner`, `requireWorkspaceMember`, or `requireMemberInOwnedWorkspace` from `src/lib/server/authorization.ts` before touching the database. `validateSession` alone is insufficient — that authorization gap was the v1.4.2 CVE.
2. **Server-only code stays server-only.** Anything under `src/lib/server/` MUST NOT be imported from a file that runs on the client. The Stripe secret, email transport, and Prisma client live here. Importing `@prisma/client` from outside `prisma/services/` is also disallowed.
3. **No raw `@prisma/client` in pages or API routes.** Routes call services; services call Prisma. This is the only way we keep query intent reviewable.
4. **Error response shape.** Every API error response uses `{ errors: { <field>: { msg: '<message>' } } }`. The existing `toast.error(response.errors[k].msg)` pattern on the client depends on this.
5. **Validate at the boundary with Zod.** Every API route that consumes a body parses it with `parseBody(schema, req.body, res)` from `src/lib/server/validate.ts`. Schemas live in `src/config/api-validation/`.
6. **TypeScript strictness.** `strict: true` and `noUncheckedIndexedAccess: true`. No `any`, no `@ts-ignore` without a comment that names the underlying issue.
7. **Imports.** Use the `@/...` path aliases declared in `tsconfig.json`. Never use deep relative imports (`../../../`).
8. **No defaultProps.** Use destructured default parameters (React 18 deprecates `defaultProps` on function components).
9. **Translation strings** go through `useTranslation()`. New keys go in `src/messages/en.json`.

Full list with rationale and examples: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

## When you add things

| Adding…                    | Read this                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| A new API route            | [`docs/RECIPES.md` → "Add an API route"](docs/RECIPES.md#add-an-api-route)                       |
| A workspace-scoped page    | [`docs/RECIPES.md` → "Add a workspace-scoped page"](docs/RECIPES.md#add-a-workspace-scoped-page) |
| A data hook                | [`docs/RECIPES.md` → "Add a data hook"](docs/RECIPES.md#add-a-data-hook)                         |
| A Prisma model + service   | [`docs/RECIPES.md` → "Add a Prisma model"](docs/RECIPES.md#add-a-prisma-model)                   |
| A billing-gated feature    | [`docs/RECIPES.md` → "Add a billing-gated feature"](docs/RECIPES.md#add-a-billing-gated-feature) |
| A landing-page section     | [`docs/RECIPES.md` → "Add a landing section"](docs/RECIPES.md#add-a-landing-section)             |
| A new environment variable | [`docs/ENV.md`](docs/ENV.md) AND update `.env.sample`                                            |
| A new translation string   | `src/messages/en.json` (single source today; future locales go beside it)                        |

If the task isn't covered, find a similar existing file and follow its shape. Symmetry across the codebase matters more than micro-optimizations.

## Commands you'll use most

```sh
# Local dev
npm run db:up         # Postgres + Mailpit + Adminer in Docker
npx prisma migrate deploy
npm run seed
npm run dev

# Before committing
npm run lint
npm run format
npm run typecheck

# Inspecting state
npm run db:studio     # Prisma Studio at :5555
docker compose logs -f postgres
```

Full table in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## What NOT to do

- **Don't introduce a state-management library.** The app uses React state + SWR for server state and one Context for the active workspace. Adding Redux/Zustand/Jotai violates the surface area expected by forkers.
- **Don't reach for a new UI library.** Headless UI + Tailwind is the contract until the planned shadcn/ui migration (Phase E of the v2.0 work). Don't introduce Material UI, Chakra, etc.
- **Don't add ORM helpers outside of `prisma/services/`.** No raw SQL, no Drizzle, no Kysely.
- **Don't disable `strict` or `noUncheckedIndexedAccess` "temporarily."** They've already caught real null-deref bugs (see B3 commit messages). If a check is genuinely impossible to satisfy, name the bug and use a narrow `as` cast with a comment.
- **Don't push secrets.** `.env` is gitignored; `.env.sample` is the only file that should contain key names. If you regenerate `NEXTAUTH_SECRET` for an example, paste a placeholder — never a real value.
- **Don't bypass CI.** No `--no-verify`, no `--force` without a clear reason.
- **Don't speculatively refactor.** The boilerplate's value is its readable, minimal surface area. Three similar lines beats a premature abstraction.

## Files to read first if you're new

1. This file.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how multi-tenancy and auth fit together.
3. `prisma/schema.prisma` — the data model is small (8 models).
4. `src/lib/server/authorization.ts` — the central authorization helpers; everything else depends on these.
5. `src/middleware.ts` — the multi-tenancy entry point.
6. `src/pages/api/workspace/[workspaceSlug]/index.ts` — a representative workspace-scoped route.
7. `CHANGELOG.md` — what changed recently and why.

## Reporting security issues

[`SECURITY.md`](SECURITY.md). Do not open a public GitHub issue for a vulnerability.
