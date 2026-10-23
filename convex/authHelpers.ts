import type { MutationCtx, QueryCtx } from './_generated/server';
import type { CtxWithTable, Ent, EntWriter } from './shared/types';
import { authClient } from './auth';
import { Doc, Id } from './_generated/dataModel';

import type { AuthCtx } from './functions';
import { getAuth } from './auth';
import { ConvexError } from 'convex/values';
import { checkPermission } from './permissionHelpers';
import {
  isCrmFeature,
  isCrmFeatureAction,
  isOrganizationalResource,
  roleAllows,
} from './orgAccess';
import { findMembership, resolveActiveOrganization } from './organizationHelpers';

interface EntsTable {
  (name: 'user'): {
    filter: (fn: (q: any) => any) => { first: () => Promise<any | null> };
    getX: (id: any) => any;
    insert: (data: any) => Promise<any>;
    get: (id: any) => Promise<any | null>;
  };
  (name: string): any;
}

/**
 * Shared helper to find a main-table user by email.
 * Used by both user.onCreate and session.onCreate triggers in auth.ts
 * to avoid duplicating the lookup logic.
 */
export async function findMainUserByEmail(
  table: EntsTable,
  email: string
): Promise<any | null> {
  return await table('user')
    .filter((q) => q.eq(q.field('email'), email))
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

  // The session of the auth component has no organization field. The active
  // organization is a CRM organization, so the CRM membership decides which
  // organization is active. An identifier of the auth component is never used
  // as a CRM identifier.
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

  // Without a CRM membership there is no active organization. The caller must
  // fail closed instead of guessing a role.
  const active = await resolveActiveOrganization(table, user);

  const activeOrganization = active
    ? {
        ...active.organization.doc(),
        id: active.organization._id as Id<'organization'>,
        role: active.membership.role,
      }
    : null;

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

export type PermissionRequest = {
  permissions: Record<string, string[]>;
  role?: string;
};

export type PermissionResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check the permissions of the current user in the active organization.
 *
 * The check always uses the real CRM membership of the current user. A CRM
 * business feature is checked with the permission template of that
 * membership. An organizational action keeps the role based rules of the
 * access control definition. Every other case fails closed.
 */
export const evaluatePermissions = async (
  ctx: AuthCtx,
  body: PermissionRequest
): Promise<PermissionResult> => {
  const organizationId = ctx.user.activeOrganization?.id;

  if (!organizationId) {
    return { allowed: false, reason: 'No active organization' };
  }

  const membership = await findMembership(ctx.table as any, {
    organizationId,
    userId: ctx.user._id,
  });

  if (!membership) {
    return {
      allowed: false,
      reason: 'You are not a member of the active organization',
    };
  }

  const role = membership.role as string;

  // A caller may not ask for a role that is not the role of the membership.
  if (body.role && body.role !== role) {
    return { allowed: false, reason: 'The requested role is not your role' };
  }

  for (const [resource, actions] of Object.entries(body.permissions ?? {})) {
    if (isCrmFeature(resource)) {
      for (const action of actions) {
        if (!isCrmFeatureAction(resource, action)) {
          return {
            allowed: false,
            reason: `Unknown permission: ${resource}:${action}`,
          };
        }

        const allowed = await checkPermission(ctx, {
          action,
          feature: resource,
          orgId: organizationId,
          userId: ctx.user._id,
        });

        if (!allowed) {
          return {
            allowed: false,
            reason: `Missing permission: ${resource}:${action}`,
          };
        }
      }

      continue;
    }

    if (!isOrganizationalResource(resource)) {
      return {
        allowed: false,
        reason: `Unknown permission resource: ${resource}`,
      };
    }

    if (!roleAllows(role, resource, actions)) {
      return {
        allowed: false,
        reason: `Missing permission: ${resource}:${actions.join(', ')}`,
      };
    }
  }

  return { allowed: true };
};

export const hasPermission = async (
  ctx: AuthCtx,
  body: PermissionRequest,
  shouldThrow = true
) => {
  const result = await evaluatePermissions(ctx, body);

  if (!result.allowed) {
    if (shouldThrow) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: result.reason ?? 'Insufficient permissions for this action',
      });
    }

    return false;
  }

  return true;
};
