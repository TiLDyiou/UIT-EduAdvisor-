import { InvitationStatus, PrismaClient, TeamRole } from '@prisma/client';

const prisma = new PrismaClient();

type SeedMember = {
  email: string;
  status: InvitationStatus;
  teamRole: TeamRole;
};

const main = async () => {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nextacular.test';

  console.info(`Seeding demo data with admin: ${adminEmail}`);

  const admin = await prisma.user.upsert({
    create: { email: adminEmail, name: 'Admin User' },
    update: { name: 'Admin User' },
    where: { email: adminEmail },
  });

  const teammates: SeedMember[] = [
    {
      email: 'alice@nextacular.test',
      status: InvitationStatus.ACCEPTED,
      teamRole: TeamRole.MEMBER,
    },
    {
      email: 'bob@nextacular.test',
      status: InvitationStatus.PENDING,
      teamRole: TeamRole.MEMBER,
    },
  ];

  await prisma.user.createMany({
    data: teammates.map(({ email }) => ({ email })),
    skipDuplicates: true,
  });

  const existingWorkspace = await prisma.workspace.findFirst({
    where: { slug: 'demo', deletedAt: null },
  });

  const workspace =
    existingWorkspace ??
    (await prisma.workspace.create({
      data: {
        creatorId: admin.id,
        name: 'Demo Workspace',
        slug: 'demo',
        members: {
          create: [
            {
              email: adminEmail,
              inviter: adminEmail,
              status: InvitationStatus.ACCEPTED,
              teamRole: TeamRole.OWNER,
            },
            ...teammates.map((member) => ({
              email: member.email,
              inviter: adminEmail,
              status: member.status,
              teamRole: member.teamRole,
            })),
          ],
        },
      },
    }));

  console.info(
    `Demo workspace: ${workspace.slug} (invite ${workspace.inviteCode})`
  );
  console.info(`Admin user:    ${admin.email}`);
  console.info(`Teammates:     ${teammates.map((t) => t.email).join(', ')}`);
  console.info(
    `Sign in locally by entering an email on the login page; the magic link will appear in Mailpit at http://localhost:8025.`
  );
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
