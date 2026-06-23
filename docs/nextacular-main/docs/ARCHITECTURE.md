# Architecture

This document explains the moving parts of a Nextacular deployment: how a single Next.js app serves multiple tenants, how authentication maps to workspaces, how custom domains are wired in, and how billing flows from a Stripe webhook back into the session.

Companion docs: [`CONVENTIONS.md`](CONVENTIONS.md) (what every PR should follow), [`RECIPES.md`](RECIPES.md) (how to add common things), [`ENV.md`](ENV.md) (every environment variable).

## Multi-tenancy

A single deployment serves three classes of request:

1. **Marketing and dashboard** at the configured `APP_URL` (e.g. `app.com`, `localhost:3000`).
2. **Tenant subdomain** at `<workspace-slug>.app.com`.
3. **Tenant custom domain** at `customer.com`, attached to a workspace via the Vercel Domains API.

All three are the same Next.js process. The mux happens in `src/middleware.ts`:

```ts
// pseudo-code of the actual middleware
if (pathname.startsWith('/_sites')) return 404;
if (hostname === host) return passThrough; // marketing + dashboard
return rewrite(`/_sites/${hostname}${pathname}`); // tenant
```

The `/_sites/[site]` Next page (`src/pages/_sites/[site]/index.tsx`) receives `params.site` as either the workspace's `slug` or its custom domain. `getStaticProps` resolves it via `getSiteWorkspace(slug, isCustomDomain)` — the workspace lookup matches either by `slug` directly or by a row in the `Domain` table.

### Setting up a custom domain

1. The workspace owner adds `customer.com` from `account/<slug>/settings/domain`.
2. The API route `POST /api/workspace/[slug]/domain` calls the Vercel Domains API (`/v9/projects/<id>/domains`) with the workspace's Vercel project credentials and inserts a `Domain` row with the verification token Vercel returns.
3. The owner adds the TXT / CNAME / A record to their DNS provider using the values shown on the Domain card.
4. `PUT /api/workspace/[slug]/domain` runs the Vercel `verify` endpoint when the owner clicks **Refresh**; on success the `Domain.verified` boolean is flipped.
5. Once verified, a request to `customer.com` is rewritten by Vercel's edge to the same Next.js deployment, hits `src/middleware.ts`, and is forwarded to `/_sites/customer.com` where `getSiteWorkspace` finds the workspace via the Domain join.

### Authorization on workspace-scoped routes

The single most important invariant in the codebase. The helpers in `src/lib/server/authorization.ts`:

| Helper                          | Returns on success      | When to use                                                                 |
| ------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `requireWorkspaceOwner`         | `{ id, name, … }`       | Mutations that only owners may perform (settings, billing, domain, invites) |
| `requireWorkspaceMember`        | `{ id, name, … }`       | Reads any member may perform (member list, domain list, dashboard)          |
| `requireMemberInOwnedWorkspace` | `{ member, workspace }` | Mutations targeting a specific `memberId` (role change, remove)             |

All three:

- Take `(req, res, session, slug | memberId)`
- Verify that `session.user` is the owner / a member / the owner of the workspace owning the target member.
- Return `null` on denial AND emit the response (`403 Unauthorized`).
- Are the only correct way to gate workspace data. `validateSession` only confirms there is **a** session, not that the session belongs to the right tenant.

This pattern was added in v1.4.2 as a security fix for an authorization bypass that affected team and domain routes (`CHANGELOG.md`).

## Authentication

NextAuth 4 with the Prisma adapter and a single `EmailProvider` (magic link). All auth surface lives in:

- `src/lib/server/auth.ts` — `authOptions`
- `src/pages/api/auth/[...nextauth].ts` — the dynamic route
- `src/lib/server/session-check.ts` — middleware that gates protected routes
- `src/config/api-validation/session.ts` — the `validateSession` wrapper everything else imports

### Session shape

The session is augmented in two places. `src/types/next-auth.d.ts` declares the shape, and the `callbacks.session` callback in `auth.ts` fills it in on every request:

```ts
interface Session {
  user: {
    userId: string; // copied from user.id; non-standard NextAuth field
    email: string;
    name?: string | null;
    image?: string | null;
    subscription?: SubscriptionType; // FREE / STANDARD / PREMIUM
  };
}
```

`subscription` is hydrated from the `CustomerPayment` table on every session read. If a route gates a feature on plan tier, it should read `session.user.subscription` (after checking the session exists).

### Sign-in flow

1. User enters their email on `/auth/login`.
2. `signIn('email', { email })` from `next-auth/react` posts to `/api/auth/signin/email`.
3. NextAuth's `EmailProvider.sendVerificationRequest` calls `sendMail` (`src/lib/server/mail.ts`), which sends the templated `signin` email through nodemailer.
4. The user clicks the link in the email (in local dev: in Mailpit at <http://localhost:8025>).
5. The link verifies the token, NextAuth's `events.signIn` callback runs:
   - If this is a new user OR has no `CustomerPayment` row yet, `createPaymentAccount(email, user.id)` creates a Stripe Customer and a `CustomerPayment` row. (No subscription is charged here.)
6. NextAuth issues a JWT session.

The `events.signIn` step is why the magic link works end-to-end even in fresh installs — a fresh sign-up automatically gets a `CustomerPayment` row and is enrolled at `FREE`.

## Workspaces, members, and teams

```
User ──creates──> Workspace ──has many──> Member ──linked to──> User
                              ──has many──> Domain
                              ──owns one──> creator (User)
```

A `Member` row connects a `User` to a `Workspace` and carries the `teamRole` (OWNER / MEMBER) and `status` (PENDING / ACCEPTED / DECLINED). The user that **creates** a workspace gets a Member row with `teamRole = OWNER` and `status = ACCEPTED` written in the same transaction.

`@@unique([workspaceId, email])` on `Member` means a single email cannot have two rows in the same workspace. The seed script and `joinWorkspace` use the composite key `workspaceId_email` for upserts.

### Joining a workspace

Three paths:

1. **Owner invites by email** at `account/<slug>/settings/team` → `POST /api/workspace/[slug]/invite` → `inviteUsers()` creates `User` rows (`skipDuplicates: true`) and `Member` rows in PENDING state, and sends invitation emails.
2. **Invitee clicks the invitation email** → lands on `/teams/invite?code=<inviteCode>` → server resolves the code → if signed in, the **Join Workspace** button hits `POST /api/workspace/team/join` → `joinWorkspace(workspaceCode, email)` upserts the Member to ACCEPTED.
3. **Invitee accepts from their pending-invitations dashboard** at `/account` → `PUT /api/workspace/team/accept` or `/decline` → `updateStatus(memberId, ACCEPTED | DECLINED)`.

## Billing

Stripe Checkout for subscription purchase, Stripe webhooks for state sync.

### Subscribe

1. User clicks **Upgrade** on `/account/billing` → modal lists Stripe products.
2. Button click → `POST /api/payments/subscription/[priceId]` creates a Stripe Checkout session and returns its `sessionId`.
3. Client calls `redirectToCheckout(sessionId)` from `@/lib/client/stripe`.
4. After payment, Stripe redirects to `${APP_URL}/account/payment?status=success` (or `cancelled`).

### Webhook

`POST /api/payments/hooks` receives Stripe events. The raw body is read with `readRawBody` from `@/lib/server/raw-body` (replaces the deprecated `micro` package), then signature-verified against `PAYMENTS_SIGNING_SECRET`.

Currently handled: `charge.succeeded`. The event's `metadata.customerId` and `metadata.type` (a `SubscriptionType`) are passed to `updateSubscription`, which writes back to `CustomerPayment.subscriptionType`. That field is then surfaced via the NextAuth session on the next request.

To handle additional events (e.g. `customer.subscription.deleted` to downgrade), add a case to the switch and a corresponding service function.

### Plan rules

`src/config/subscription-rules/index.ts` declares per-plan quotas:

| Plan     | customDomains | members | workspaces |
| -------- | ------------- | ------- | ---------- |
| FREE     | 1             | 1       | 1          |
| STANDARD | 3             | 5       | 5          |
| PREMIUM  | 5             | 10      | 10         |

These aren't enforced anywhere yet — they're a contract for forkers to wire up where it matters in their product. See [`RECIPES.md` → "Add a billing-gated feature"](RECIPES.md#add-a-billing-gated-feature).

## Data model

The schema is small. From `prisma/schema.prisma`:

```
User ──┬── Account[]                        (NextAuth OAuth accounts; unused today)
       ├── Session[]                        (NextAuth sessions)
       ├── membership: Member[]             (workspaces this user belongs to, by email)
       ├── invitedMembers: Member[]         (members this user has invited)
       ├── createdWorkspace: Workspace[]    (workspaces this user created)
       ├── customerPayment: CustomerPayment? (1:1 — Stripe-backed billing)
       └── domains: Domain[]                (workspace domains this user added)

Workspace ──┬── creator: User
            ├── members: Member[]
            └── domains: Domain[]

Member (User × Workspace × email)
  status: InvitationStatus  (PENDING / ACCEPTED / DECLINED)
  teamRole: TeamRole        (MEMBER / OWNER)
  @@unique([workspaceId, email])

CustomerPayment (1:1 with User)
  paymentId       (Stripe Customer id)
  customerId      (mirrors User.id; the Stripe metadata field)
  subscriptionType: SubscriptionType  (FREE / STANDARD / PREMIUM)

VerificationToken     (NextAuth magic-link tokens)
Account / Session     (NextAuth standard tables)
```

### Soft delete

Most tables have a nullable `deletedAt`. Services consistently filter `where: { deletedAt: null }` and write `data: { deletedAt: new Date() }` rather than calling `.delete()`. There is no global middleware enforcing this — it's a convention you have to remember when adding new queries. If you add a new model that should support soft delete, mirror the existing pattern.

### Indexes

The schema is currently underindexed for queries by `slug`, `email`, and `workspaceId`. PostgreSQL handles the unique constraints automatically (which doubles as an index for those exact lookups), but composite `findFirst` queries on `(deletedAt, slug)` and `(workspaceId, email)` would benefit from explicit `@@index` directives at scale. Worth adding when traffic justifies it.

## App boot order

What happens when a request comes in on `app.com/account`:

1. Vercel (or `next start`) receives the request.
2. `src/middleware.ts` runs. Hostname matches `APP_URL.host`, so it returns `NextResponse.next()`.
3. Next.js matches `/account` to `src/pages/account/index.tsx`.
4. `_app.tsx` initialises NextAuth's `SessionProvider`, SWR config, theme, the workspace context, and i18n.
5. `AccountLayout` checks `useSession()`:
   - `loading` → render nothing
   - `unauthenticated` → `router.replace('/auth/login')`
   - `authenticated` → render Sidebar + Header + page content
6. The page itself fetches data via SWR hooks; their fetcher hits `/api/...` routes which call `validateSession` → service → Prisma.

## Things this architecture does NOT do (yet)

- Rate limiting on public or authenticated endpoints. Adding a request-fingerprinting middleware is the recommended pattern.
- Workspace-scoped feature flags. The closest thing is plan tier, which is global per user.
- Audit logging. Soft-delete history is preserved but not surfaced.
- Background jobs. There is no job queue — long-running work (sending bulk invites, processing webhooks) runs inline in the request.

These are intentional omissions for boilerplate scope. Forkers tend to want to choose their own answers (Inngest vs Trigger.dev, Upstash vs Redis, etc.). The architecture above leaves enough seams that any of these can be added without restructuring.
