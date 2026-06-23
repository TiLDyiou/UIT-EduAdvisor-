# Contributing to Nextacular

Thanks for your interest in improving Nextacular. This guide explains how to set up the project locally, the standards we expect for code changes, and how to submit a pull request.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). For security-related reports, please follow our [Security Policy](SECURITY.md) instead of opening a public issue.

## Prerequisites

- **Node.js 22** (Active LTS). The version is pinned in `.nvmrc`; if you use `nvm`, run `nvm use` from the repo root.
- **npm** (bundled with Node). We do not commit a `yarn.lock` or `pnpm-lock.yaml`.
- **Docker** with Docker Compose v2 — used to run Postgres and Mailpit locally. You can substitute a hosted Postgres if you prefer (Supabase, Neon, Railway), but Docker is the recommended path.

## Quick start

```sh
# 1. Fork, clone, and pin Node
git clone https://github.com/<your-handle>/nextacular.git
cd nextacular
nvm use   # or: fnm use / volta install

# 2. Install dependencies (also runs `prisma generate`)
npm install

# 3. Copy the env template — the defaults match docker-compose.yml
cp .env.sample .env

# 4. Start Postgres + Mailpit + Adminer in the background
npm run db:up

# 5. Apply migrations and seed the demo workspace
npx prisma migrate deploy
npm run seed

# 6. Run the dev server
npm run dev
```

The app is now on <http://localhost:3000>. Sign in by entering the seeded admin email (`admin@nextacular.test` by default) — the magic-link email appears in [Mailpit](http://localhost:8025) within seconds.

| Service          | URL                                             |
| ---------------- | ----------------------------------------------- |
| App              | <http://localhost:3000>                         |
| Mailpit          | <http://localhost:8025>                         |
| Adminer (DB GUI) | <http://localhost:8080> (use server `postgres`) |
| Prisma Studio    | `npm run db:studio` → <http://localhost:5555>   |

## Environment variables

The minimum-viable `.env` is set up by `cp .env.sample .env` — it just works against `docker compose`. Stripe, Vercel custom domains, and Google Analytics are all opt-in: leave them commented out until you need them.

See [`docs/ENV.md`](docs/ENV.md) for the full list with usage notes and "where to get this value" for every variable.

## Scripts

| Command                | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Start the Next.js dev server with hot reload               |
| `npm run build`        | Production build                                           |
| `npm run start`        | Run the production build                                   |
| `npm run lint`         | Run ESLint                                                 |
| `npm run format`       | Run Prettier on the codebase                               |
| `npm run format:check` | Verify formatting without writing                          |
| `npm run typecheck`    | Run TypeScript in `--noEmit` mode                          |
| `npm run db:up`        | Start the Docker stack (Postgres + Mailpit + Adminer)      |
| `npm run db:down`      | Stop the Docker stack (data is preserved)                  |
| `npm run db:reset`     | Tear the stack down (volumes too), re-migrate, and re-seed |
| `npm run db:logs`      | Tail Postgres logs                                         |
| `npm run db:studio`    | Open Prisma Studio at <http://localhost:5555>              |
| `npm run seed`         | Run the seed script against the current `DATABASE_URL`     |

## Project conventions

The short list — the **rules we won't merge a PR that violates**:

- **Authorization on workspace-scoped routes.** Every API route that reads or mutates workspace data must verify authorization with `requireWorkspaceOwner`, `requireWorkspaceMember`, or `requireMemberInOwnedWorkspace` from `src/lib/server/authorization.ts` **before** touching the database. Session presence alone (`validateSession`) is not sufficient — see the v1.4.2 security release notes in `CHANGELOG.md`.
- **Error response shape.** Use `{ errors: { <field>: { msg: '...' } } }` so existing client-side toast handling continues to work.
- **Server-only code.** Lives under `src/lib/server/`. Anything imported from there must never end up in a client bundle. Treat the boundary like a hard constraint.
- **Prisma services.** Live under `prisma/services/`. They are the single layer that talks to the database — routes and pages should never import `@prisma/client` directly.
- **TypeScript.** `strict: true` and `noUncheckedIndexedAccess: true`. No `any`, no `@ts-ignore` without a comment explaining why.

The full list with rationale and examples lives in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

## Architecture and recipes

If this is your first PR, read these in order:

1. [`CLAUDE.md`](CLAUDE.md) — the operating guide for AI assistants and humans. The fastest way to get oriented.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — multi-tenancy, auth, billing, the data model.
3. [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — the rules above plus the rest.
4. [`docs/RECIPES.md`](docs/RECIPES.md) — copy-paste guides for "add an API route", "add a page", "add a Prisma model", etc.

For AI assistants: this repo also ships [`AGENTS.md`](AGENTS.md) (vendor-neutral pointer) and [`.cursorrules`](.cursorrules) (condensed for Cursor).

## Submitting a pull request

1. Create a branch from `main`. Use a short, descriptive name (`fix/team-role-bypass`, `feat/sso-google`, `chore/upgrade-prisma`).
2. Make focused changes. One concern per PR is much easier to review than a sprawling change.
3. Run `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run build` locally.
4. Update `CHANGELOG.md` for user-facing changes.
5. Open a PR against `main` and fill out the template. CI will run lint, typecheck, format check, and build automatically.
6. For security fixes, **do not open a public PR first** — coordinate via the process in [SECURITY.md](SECURITY.md).

## Reporting bugs

Open a GitHub issue with:

- A short summary
- Steps to reproduce
- What you expected vs. what happened
- Your environment (Node version, OS, browser if relevant)
- Logs or screenshots if useful

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
