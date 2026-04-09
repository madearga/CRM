import type { MutationCtx, QueryCtx } from './_generated/server';
import type { CtxWithTable, Ent, EntWriter } from './shared/types';
import { authClient } from './auth';
import { Doc, Id } from './_generated/dataModel';

import type { AuthCtx } from './functions';
import { getAuth } from './auth';
import { ConvexError } from 'convex/values';

export type SessionUser = Omit<Doc<'user'>, '_creationTime' | '_id'> & {
  id: Id<'user'>;
  activeOrganization:
    | (Omit<Doc<'organization'>, '_id'> & {
        id: Id<'organization'>;
        role: Doc<'member'>['role'];
      })
    | null;
  isAdmin: boolean;
  session: Doc<'session'>;
  impersonatedBy?: string;
  plan?: string;
};

const getSessionData = async (ctx: CtxWithTable<QueryCtx | MutationCtx>) => {
  const table = ctx.table as any;
  const headers = await authClient.getHeaders(ctx as any);
  const sessionPayload = await getAuth(ctx as any).api.getSession({
    headers,
  });

  const session = sessionPayload?.session as Doc<'session'> | null | undefined;

  if (!session) {
    return null;
  }

  const activeOrganizationId =
    session.activeOrganizationId as Id<'organization'> | null;

  const user = await table('user').get(session.userId as Id<'user'>);

  if (!user) {
    return null;
  }

  const activeOrganization = await (async () => {
    if (!activeOrganizationId) {
      return null;
    }

    const [activeOrg, currentMember] = await Promise.all([
      table('organization').getX(activeOrganizationId),
      table('member', 'organizationId_userId', (q: any) =>
          q
            .eq('organizationId', activeOrganizationId)
            .eq('userId', session.userId as Id<'user'>)
        )
        .first(),
    ]);

    return {
      ...activeOrg.doc(),
      id: activeOrg._id as Id<'organization'>,
      role: currentMember?.role || 'member',
    };
  })();

  return {
    activeOrganization,
    impersonatedBy: session.impersonatedBy ?? undefined,
    isAdmin: user.role === 'admin',
    session,
    user,
  } as const;
};

// Query to fetch user data for session/auth checks
export const getSessionUser = async (
  ctx: CtxWithTable<QueryCtx>
): Promise<(Ent<'user'> & SessionUser) | null> => {
  const { activeOrganization, impersonatedBy, isAdmin, session, user } =
    (await getSessionData(ctx as any)) ?? ({} as never);

  if (!user) {
    return null;
  }

  return {
    ...user,
    id: user._id as Id<'user'>,
    activeOrganization,
    doc: user.doc,
    edge: user.edge,
    edgeX: user.edgeX,
    impersonatedBy,
    isAdmin,
    session,
  };
};

export const getSessionUserWriter = async (
  ctx: CtxWithTable<MutationCtx>
): Promise<(EntWriter<'user'> & SessionUser) | null> => {
  const { activeOrganization, impersonatedBy, isAdmin, session, user } =
    (await getSessionData(ctx)) ?? ({} as never);

  if (!user) {
    return null;
  }

  return {
    ...user,
    id: user._id as Id<'user'>,
    activeOrganization,
    delete: user.delete,
    doc: user.doc,
    edge: user.edge,
    edgeX: user.edgeX,
    impersonatedBy,
    isAdmin,
    patch: user.patch,
    replace: user.replace,
    session,
  };
};

export const createUser = async (
  ctx: MutationCtx,
  args: {
    email: string;
    name: string;
    bio?: string | null;
    github?: string | null;
    image?: string | null;
    location?: string | null;
    role?: 'admin' | 'user';
  }
) => {
  const { user } = await getAuth(ctx).api.createUser({
    body: {
      email: args.email,
      name: args.name,
      password: Math.random().toString(36).slice(-12),
      role: args.role,
      data: {
        bio: args.bio,
        image: args.image,
        location: args.location,
      },
    },
  });

  return user.id as Id<'user'>;
};

export const hasPermission = async (
  ctx: AuthCtx,
  body: Parameters<typeof ctx.auth.api.hasPermission>[0]['body'],
  shouldThrow = true
) => {
  const canUpdate = await ctx.auth.api.hasPermission({
    body,
    headers: ctx.auth.headers,
  });

  if (shouldThrow && !canUpdate.success) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions for this action',
    });
  }

  return canUpdate.success;
};
