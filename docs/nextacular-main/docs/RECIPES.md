# Recipes

Step-by-step guides for common tasks. Each recipe is a copy-paste-friendly skeleton — adapt the names, then the rest of the structure should work as-is.

If you're new to the codebase, read [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`CONVENTIONS.md`](CONVENTIONS.md) first.

## Add an API route

For a route that doesn't touch workspace data (e.g. an authenticated-user lookup):

1. **Create the file** under `src/pages/api/...`. Pages Router uses the file path as the URL.
2. **Pick a method** and add the skeleton:

   ```ts
   // src/pages/api/widgets/index.ts
   import type { NextApiRequest, NextApiResponse } from 'next';
   import { validateSession } from '@/config/api-validation';
   import { getWidgets } from '@/prisma/services/widget';

   const handler = async (req: NextApiRequest, res: NextApiResponse) => {
     const { method } = req;

     if (method === 'GET') {
       const session = await validateSession(req, res);
       const widgets = await getWidgets(session.user.userId);
       res.status(200).json({ data: { widgets } });
     } else {
       res
         .status(405)
         .json({ errors: { error: { msg: `${method} method unsupported` } } });
     }
   };

   export default handler;
   ```

3. **If the route takes a body**, add a Zod schema and use `parseBody`:
   - Create `src/config/api-validation/create-widget.ts` exporting `createWidgetSchema` and the inferred `CreateWidgetBody` type.
   - Re-export from `src/config/api-validation/index.ts`.
   - In the handler: `const body = parseBody(createWidgetSchema, req.body, res); if (!body) return;`.

4. **If the route touches workspace data**, see the next recipe.

## Add a workspace-scoped API route

This is the security-critical case. Follow the skeleton exactly:

```ts
// src/pages/api/workspace/[workspaceSlug]/widgets.ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { createWidgetSchema, validateSession } from '@/config/api-validation';
import { requireWorkspaceOwner } from '@/lib/server/authorization';
import { parseBody } from '@/lib/server/validate';
import { createWidget } from '@/prisma/services/widget';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'POST') {
    const session = await validateSession(req, res);
    const body = parseBody(createWidgetSchema, req.body, res);
    if (!body) return;

    const { workspaceSlug } = req.query as { workspaceSlug: string };
    const workspace = await requireWorkspaceOwner(
      req,
      res,
      session,
      workspaceSlug
    );
    if (!workspace) return;

    await createWidget(workspace.id, body.name);
    res.status(200).json({ data: { name: body.name } });
  } else {
    res
      .status(405)
      .json({ errors: { error: { msg: `${method} method unsupported` } } });
  }
};

export default handler;
```

Order matters: `validateSession` → `parseBody` → `requireWorkspaceOwner|Member`. The authorization check MUST be before any service call that hits the database. Use `requireWorkspaceMember` instead of `requireWorkspaceOwner` for read endpoints any member should see. Use `requireMemberInOwnedWorkspace` when the route operates on a `memberId` instead of a `workspaceSlug` (see `src/pages/api/workspace/team/role.ts`).

## Add a page

Pages are matched by their file path. Pick the right directory based on layout:

| Directory                             | Layout          | Auth                                 |
| ------------------------------------- | --------------- | ------------------------------------ |
| `src/pages/index.tsx`                 | `LandingLayout` | optional                             |
| `src/pages/auth/*`                    | `AuthLayout`    | redirects to `/account` if signed in |
| `src/pages/account/*`                 | `AccountLayout` | redirects to `/auth/login` if not    |
| `src/pages/account/[workspaceSlug]/*` | `AccountLayout` | + active workspace required          |
| `src/pages/_sites/[site]/*`           | (custom)        | none — tenant marketing              |

For a workspace-scoped page with server-side props:

```tsx
// src/pages/account/[workspaceSlug]/widgets.tsx
import type { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';

import Content from '@/components/Content/index';
import Meta from '@/components/Meta/index';
import { AccountLayout } from '@/layouts/index';
import { getWorkspace, isWorkspaceOwner } from '@/prisma/services/workspace';
import type { Workspace } from '@/providers/workspace';

type WidgetsProps = {
  isTeamOwner: boolean;
  workspace: Workspace | null;
};

const Widgets = ({ isTeamOwner, workspace }: WidgetsProps) => {
  if (!workspace) return null;
  return (
    <AccountLayout>
      <Meta title={`Nextacular - ${workspace.name} | Widgets`} />
      <Content.Title title="Widgets" subtitle="Manage your widgets" />
      <Content.Divider />
      {/* … */}
    </AccountLayout>
  );
};

export const getServerSideProps: GetServerSideProps<WidgetsProps> = async (
  context
) => {
  const session = await getSession(context);
  if (!session?.user) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }

  const workspaceSlug =
    typeof context.params?.workspaceSlug === 'string'
      ? context.params.workspaceSlug
      : '';
  const dbWorkspace = workspaceSlug
    ? await getWorkspace(session.user.userId, session.user.email, workspaceSlug)
    : null;

  return {
    props: {
      isTeamOwner: dbWorkspace
        ? isWorkspaceOwner(session.user.email, dbWorkspace)
        : false,
      workspace: dbWorkspace
        ? { ...(dbWorkspace as Workspace), slug: workspaceSlug }
        : null,
    },
  };
};

export default Widgets;
```

The handler-level redirect on missing session is important — without it, a `getServerSideProps` for an authenticated page will throw on `session.user.userId` instead of bouncing to login.

## Add a data hook

Thin wrapper around `useSWR`. Pattern (`src/hooks/data/useMembers.ts`):

```ts
import useSWR from 'swr';

type Widget = { id: string; name: string };

type UseWidgetsResult = {
  data?: { widgets: Widget[] };
  isLoading: boolean;
  isError: unknown;
};

const useWidgets = (slug: string): UseWidgetsResult => {
  const apiRoute = `/api/workspace/${slug}/widgets`;
  const { data, error } = useSWR<{ data?: { widgets: Widget[] } }>(apiRoute);
  return {
    ...data,
    isLoading: !error && !data,
    isError: error,
  };
};

export default useWidgets;
```

Then re-export from `src/hooks/data/index.ts`.

Callers consume it as `const { data, isLoading } = useWidgets(workspace.slug);` and read `data?.widgets`.

For mutations: don't put the POST/PUT inside the hook. Call `apiFetch` from the component, then `mutate(apiRoute)` to revalidate.

## Add a Prisma model

1. **Edit `prisma/schema.prisma`.** Mirror the existing models:
   - cuid IDs (`@id @default(cuid())`).
   - Optional `createdAt`, `deletedAt`, `updatedAt` fields if soft delete is in scope.
   - Snake_case table name via `@@map`.
   - Compound unique constraints with `@@unique` where appropriate.
2. **Generate the migration.** With the docker compose stack running:

   ```sh
   npx prisma migrate dev --name add_widget_model
   ```

3. **Add a service** at `prisma/services/widget.ts`. Service functions are the only place that imports from `@prisma/client`. Follow `prisma/services/membership.ts` for the read/write pattern:

   ```ts
   import { type Widget } from '@prisma/client';
   import prisma from '@/prisma/index';

   export const getWidgets = async (workspaceId: string): Promise<Widget[]> =>
     prisma.widget.findMany({
       where: { workspaceId, deletedAt: null },
       orderBy: { createdAt: 'desc' },
     });

   export const createWidget = async (
     workspaceId: string,
     name: string
   ): Promise<Widget> => prisma.widget.create({ data: { workspaceId, name } });

   export const softDeleteWidget = async (id: string): Promise<void> => {
     await prisma.widget.update({
       where: { id },
       data: { deletedAt: new Date() },
     });
   };
   ```

4. **Update the seed** if the demo workspace should include some of the new model. Edit `prisma/seed.ts` and run `npm run seed`.

## Add a billing-gated feature

Plan tiers are read from the session:

```ts
const session = await validateSession(req, res);
if (session.user.subscription === 'FREE') {
  return res.status(402).json({
    errors: {
      plan: { msg: 'Upgrade to STANDARD or PREMIUM to use this feature' },
    },
  });
}
```

For quota-style limits (e.g. "FREE workspaces can have at most 1 custom domain"):

```ts
import rules from '@/config/subscription-rules';

const plan = session.user.subscription ?? 'FREE';
const limit = rules[plan].customDomains;
const current = await prisma.domain.count({
  where: { workspaceId: workspace.id, deletedAt: null },
});
if (current >= limit) {
  return res.status(402).json({
    errors: {
      plan: {
        msg: `Plan limit reached (${limit}). Upgrade to add more domains.`,
      },
    },
  });
}
```

`subscription-rules` is a `Record<SubscriptionType, { customDomains, members, workspaces }>` — add fields as your product needs them.

On the client, gate UI on `useSession().data?.user.subscription` (same field, hydrated from the session callback in `src/lib/server/auth.ts`).

## Add a landing section

Landing-page composition lives in `src/sections/`. Each section is a self-contained, prop-less React component that exports default:

```tsx
// src/sections/Trust.tsx
const Trust = () => (
  <section className="w-full py-10 bg-gray-50">{/* … */}</section>
);
export default Trust;
```

Re-export from `src/sections/index.ts`, then compose into the landing page in `src/pages/index.tsx`. Order in the file is the visual order.

## Add an environment variable

1. **Decide where it's used.** Server-only stays unprefixed; values the browser needs must use `NEXT_PUBLIC_*` (and only public values).
2. **Read it through `process.env.NAME`.** Always guard against missing values in code that may run without the variable set (Stripe / Vercel / GA features are all optional today).
3. **Add it to `.env.sample`** with a one-line comment explaining what it is and a sensible default for the docker-compose stack.
4. **Document it in [`docs/ENV.md`](ENV.md)** — add a row to the quick-reference table and a section with the where-to-get-it instructions.

## Add a translation key

1. Add the key to `src/messages/en.json`. Use dot-notation paths.
2. Use it via `useTranslation()`:

   ```tsx
   const { t } = useTranslation();
   return <h1>{t('widgets.header.title')}</h1>;
   ```

3. Don't hard-code English strings in JSX — even for boilerplate copy, the key system makes downstream localisation trivial.

## Send an email

Use `sendMail` from `src/lib/server/mail.ts` with one of the existing templates in `src/config/email-templates/` (or add a new template alongside the others). In local dev all email is captured by Mailpit at <http://localhost:8025>.

```ts
import { html, text } from '@/config/email-templates/invitation';
import { sendMail } from '@/lib/server/mail';

await sendMail({
  to: recipient,
  subject: `[Nextacular] You have been invited to join ${workspace.name}`,
  html: html({ code: workspace.inviteCode, name: workspace.name }),
  text: text({ code: workspace.inviteCode, name: workspace.name }),
});
```

Each template is a pair of `html({...}) -> string` / `text({...}) -> string` functions with the same input type. Mirror that shape when adding new templates.
