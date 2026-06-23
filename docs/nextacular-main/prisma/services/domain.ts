import prisma from '@/prisma/index';

type VerificationData = ReadonlyArray<{ domain: string; value: string }>;

const findWorkspaceBySlugForUser = async (
  userId: string,
  email: string,
  slug: string
) =>
  await prisma.workspace.findFirst({
    select: { id: true },
    where: {
      OR: [
        { id: userId },
        {
          members: {
            some: {
              email,
              deletedAt: null,
            },
          },
        },
      ],
      AND: {
        deletedAt: null,
        slug,
      },
    },
  });

export const createDomain = async (
  id: string,
  email: string,
  slug: string,
  name: string,
  apexName: string,
  verified: boolean,
  verificationData: VerificationData | undefined
): Promise<void> => {
  let subdomain: string | null = null;
  let verificationValue: string | null = null;

  if (!verified && verificationData && verificationData[0]) {
    const { domain, value } = verificationData[0];
    subdomain = domain.replace(`.${apexName}`, '');
    verificationValue = value;
  }

  const workspace = await findWorkspaceBySlugForUser(id, email, slug);

  if (!workspace) {
    throw new Error('Unable to find workspace');
  }

  await prisma.domain.create({
    data: {
      addedById: id,
      name,
      subdomain,
      value: verificationValue,
      verified,
      workspaceId: workspace.id,
    },
  });
};

export const deleteDomain = async (
  id: string,
  email: string,
  slug: string,
  name: string
): Promise<void> => {
  const workspace = await findWorkspaceBySlugForUser(id, email, slug);

  if (!workspace) {
    throw new Error('Unable to find workspace');
  }

  const domain = await prisma.domain.findFirst({
    select: { id: true },
    where: {
      deletedAt: null,
      name,
      workspaceId: workspace.id,
    },
  });

  if (!domain) {
    throw new Error('Unable to find domain');
  }

  await prisma.domain.update({
    data: { deletedAt: new Date() },
    where: { id: domain.id },
  });
};

export const getDomains = async (slug: string) =>
  await prisma.domain.findMany({
    select: {
      name: true,
      subdomain: true,
      verified: true,
      value: true,
    },
    where: {
      deletedAt: null,
      workspace: {
        deletedAt: null,
        slug,
      },
    },
  });

export const verifyDomain = async (
  id: string,
  email: string,
  slug: string,
  name: string,
  verified: boolean
): Promise<void> => {
  const workspace = await findWorkspaceBySlugForUser(id, email, slug);

  if (!workspace) {
    throw new Error('Unable to find workspace');
  }

  const domain = await prisma.domain.findFirst({
    select: { id: true },
    where: {
      deletedAt: null,
      name,
      workspaceId: workspace.id,
    },
  });

  if (!domain) {
    throw new Error('Unable to find domain');
  }

  await prisma.domain.update({
    data: { verified },
    where: { id: domain.id },
  });
};
