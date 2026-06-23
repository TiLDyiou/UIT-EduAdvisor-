# Security Policy

## Supported Versions

We actively support the latest minor release of Nextacular. Older releases may receive security fixes at the maintainers' discretion.

| Version | Supported |
| ------- | --------- |
| 1.4.x   | Yes       |
| < 1.4   | No        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

We prefer reports through GitHub's private vulnerability disclosure system:

1. Open the [Security tab](https://github.com/nextacular/nextacular/security) on this repository.
2. Click **Report a vulnerability**.
3. Provide a clear description, reproduction steps, and the impact you've observed.

Alternatively, you can email the maintainers at **teamnextacular@gmail.com** with the same information. Please use a subject line that starts with `[security]`.

## What to expect

- We will acknowledge your report within **72 hours**.
- We will confirm the vulnerability and determine its severity within **7 days**.
- We will work on a fix in a private branch and coordinate disclosure with you.
- We will credit you in the release notes unless you ask to remain anonymous.

## Scope

In scope:

- Authentication, authorization, and session handling
- Workspace, team, and member access control
- Multi-tenant data isolation (subdomain and custom domain routing)
- Stripe webhook and billing flows
- API routes under `src/pages/api/`
- Prisma data access patterns

Out of scope:

- Vulnerabilities that require physical access to a user's device
- Vulnerabilities in third-party services (Vercel, Stripe, Supabase) — please report those to the respective vendors
- Self-XSS or social engineering
- Issues in example or demo content
