import type { MutationCtx, QueryCtx } from './_generated/server';
import type { CtxWithTable, Ent, EntWriter } from './shared/types';
import { authClient } from './auth';
import { Doc, Id } from './_generated/dataModel';

import type { AuthCtx } from './functions';
import { getAuth } from './auth';
import { ConvexError } from 'convex/values';

/**
 * Shared helper to find a main-table user by email.
 * Used by both user.onCreate and session.onCreate triggers in auth.ts
 * to avoid duplicating the lookup logic.
 */
export async function findMainUserByEmail(
  table: any,
  email: string
): Promise<any | null> {
  return await table('user')
    .filter((q: any) => q.eq(q.field('email'), email))
    .first();
}

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

  // session.activeOrganizationId is set by Better Auth's organization plugin.
  // It may be null if the session was created before the trigger fix.
  // We'll fallback to the user's personalOrganizationId below.
  const sessionOrgId =
    session.activeOrganizationId as Id<'organization'> | null;

  // session.userId is a COMPONENT table ID — find user in main table by email
  const componentUser = sessionPayload?.user;
  if (!componentUser?.email) {
    return null;
  }

  const user = await table('user')
    .filter((q: any) => q.eq(q.field('email'), componentUser.email))
    .first();

  if (!user) {
    return null;
  }

  const mainUserId = user._id as Id<'user'>;

  // Fallback: if session doesn't have activeOrganizationId, use the user's
  // personal org or last active org. This handles sessions created before
  // the session.onCreate trigger fix.
  const activeOrganizationId =
    sessionOrgId ??
    user.personalOrganizationId ??
    user.lastActiveOrganizationId;

  const activeOrganization = await (async () => {
    if (!activeOrganizationId) {
      return null;
    }

    const [activeOrg, currentMember] = await Promise.all([
      table('organization').getX(activeOrganizationId),
      table('member', 'organizationId_userId', (q: any) =>
          q
            .eq('organizationId', activeOrganizationId)
            .eq('userId', mainUserId)
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
    image?: string | null;
    role?: 'admin' | 'user';
  }
) => {
  const now = Date.now();
  const id = await ctx.db.insert('user', {
    email: args.email,
    name: args.name,
    image: args.image ?? undefined,
    role: args.role,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  return id as Id<'user'>;
};

export const hasPermission = async (
  ctx: AuthCtx,
  body: {
    permissions: Record<string, string[]>;
    role?: string;
  },
  shouldThrow = true
) => {
  try {
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
  } catch (e) {
    if (e instanceof ConvexError) throw e;
    if (shouldThrow) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions for this action',
      });
    }
    return false;
  }
};
