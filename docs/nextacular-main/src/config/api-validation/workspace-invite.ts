import { TeamRole } from '@prisma/client';
import { z } from 'zod';

export const workspaceInviteSchema = z.object({
  members: z
    .array(
      z.object({
        email: z.string().email('Email must be valid'),
        role: z.nativeEnum(TeamRole, {
          error: () => 'Role must either be MEMBER or OWNER',
        }),
      })
    )
    .nonempty('Members data must be a list of emails and roles'),
});

export type WorkspaceInviteBody = z.infer<typeof workspaceInviteSchema>;
