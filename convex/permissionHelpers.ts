import type { Id } from './_generated/dataModel';
import type { AuthMutationCtx, CtxWithTable, AuthCtx } from './functions';
import { ConvexError } from 'convex/values';

// ---------------------------------------------------------------------------
// Permission Feature / Action Constants
// ---------------------------------------------------------------------------

export const FEATURES = [
  'dashboard',
  'contacts',
  'companies',
  'deals',
  'products',
  'sales',
  'invoices',
  'subscriptions',
  'templates',
  'team',
  'settings',
  'activities',
] as const;

export type Feature = (typeof FEATURES)[number];

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'manage',
  'invite',
  'remove',
  'manage_roles',
] as const;

export type Action = (typeof ACTIONS)[number];

// Which actions are valid per feature
export const FEATURE_ACTIONS: Record<Feature, Action[]> = {
  dashboard: ['view'],
  contacts: ['view', 'create', 'edit', 'delete'],
  companies: ['view', 'create', 'edit', 'delete'],
  deals: ['view', 'create', 'edit', 'delete'],
  products: ['view', 'create', 'edit', 'delete'],
  sales: ['view', 'create', 'edit', 'delete'],
  invoices: ['view', 'create', 'edit', 'delete'],
  subscriptions: ['view', 'create', 'edit', 'delete'],
  templates: ['view', 'create', 'edit', 'delete'],
  team: ['view', 'invite', 'remove', 'manage_roles'],
  settings: ['view', 'manage'],
  activities: ['view', 'create', 'edit', 'delete'],
};

// ---------------------------------------------------------------------------
// Default Template Definitions
// ---------------------------------------------------------------------------

interface DefaultEntry {
  feature: Feature;
  action: Action;
  allowed: boolean;
}

const OWNER_ENTRIES: DefaultEntry[] = FEATURES.flatMap((feature) =>
  FEATURE_ACTIONS[feature].map((action) => ({
    feature,
    action,
    allowed: true,
  })),
);

const ADMIN_ENTRIES: DefaultEntry[] = FEATURES.flatMap((feature) =>
  FEATURE_ACTIONS[feature].map((action) => {
    // Admin cannot manage roles or promote to owner
    const denied: string[] = ['manage_roles'];
    return {
      feature,
      action,
      allowed: !denied.includes(action),
    };
  }),
);

const MEMBER_ENTRIES: DefaultEntry[] = [
  { feature: 'dashboard', action: 'view', allowed: true },
  { feature: 'contacts', action: 'view', allowed: true },
  { feature: 'companies', action: 'view', allowed: true },
  { feature: 'deals', action: 'view', allowed: true },
  // Everything else is denied by default (no entry = denied)
];

const DEFAULT_TEMPLATES: {
  name: string;
  description: string;
  color: string;
  entries: DefaultEntry[];
}[] = [
  {
    name: 'Owner',
    description: 'Full access to all features',
    color: '#ef4444',
    entries: OWNER_ENTRIES,
  },
  {
    name: 'Admin',
    description: 'All features except role management',
    color: '#f59e0b',
    entries: ADMIN_ENTRIES,
  },
  {
    name: 'Member',
    description: 'View-only access to basic features',
    color: '#3b82f6',
    entries: MEMBER_ENTRIES,
  },
];

// ---------------------------------------------------------------------------
// Seed Default Templates
// ---------------------------------------------------------------------------

export async function seedDefaultTemplates(
  ctx: AuthMutationCtx,
  orgId: Id<'organization'>,
  ownerId: Id<'user'>,
) {
  for (const tmpl of DEFAULT_TEMPLATES) {
    const templateId = await ctx.table('permissionTemplates').insert({
      name: tmpl.name,
      description: tmpl.description,
      color: tmpl.color,
      isDefault: true,
      organizationId: orgId,
      ownerId,
    });

    for (const entry of tmpl.entries) {
      await ctx.table('permissionEntries').insert({
        feature: entry.feature,
        action: entry.action,
        allowed: entry.allowed,
        organizationId: orgId,
        templateId,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Permission Check Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a member has a specific permission.
 * Owner role always bypasses checks (returns true).
 * Falls back to deny if no matching entry found.
 */
export async function checkPermission(
  ctx: CtxWithTable,
  args: {
    userId: Id<'user'>;
    orgId: Id<'organization'>;
    feature: string;
    action: string;
  },
): Promise<boolean> {
  // Find the member record
  const members = await ctx
    .table('member', 'organizationId_userId', (q: any) =>
      q.eq('organizationId', args.orgId).eq('userId', args.userId),
    )
    .take(1);

  const member = members[0];
  if (!member) return false;

  // Owner bypass
  if (member.role === 'owner') return true;

  // Look up template
  const templateId = member.permissionTemplateId;
  if (!templateId) return false;

  // Look up entry
  const entries = await ctx
    .table('permissionEntries', 'templateId_feature_action', (q: any) =>
      q
        .eq('templateId', templateId)
        .eq('feature', args.feature)
        .eq('action', args.action),
    )
    .take(1);

  const entry = entries[0];
  return entry?.allowed ?? false;
}

/**
 * Get all permissions for a user in an organization.
 * Returns a map of "feature:action" => boolean.
 * Owner gets all permissions.
 */
export async function getPermissionsForUser(
  ctx: CtxWithTable,
  args: {
    userId: Id<'user'>;
    orgId: Id<'organization'>;
  },
): Promise<Record<string, boolean>> {
  const members = await ctx
    .table('member', 'organizationId_userId', (q: any) =>
      q.eq('organizationId', args.orgId).eq('userId', args.userId),
    )
    .take(1);

  const member = members[0];
  if (!member) return {};

  // Owner gets all permissions
  if (member.role === 'owner') {
    const all: Record<string, boolean> = {};
    for (const feature of FEATURES) {
      for (const action of FEATURE_ACTIONS[feature]) {
        all[`${feature}:${action}`] = true;
      }
    }
    return all;
  }

  // Load template entries
  const templateId = member.permissionTemplateId;
  if (!templateId) return {};

  const entries = await ctx
    .table('permissionEntries', 'templateId_feature_action', (q: any) =>
      q.eq('templateId', templateId),
    )
    .take(200);

  const result: Record<string, boolean> = {};
  for (const entry of entries) {
    result[`${entry.feature}:${entry.action}`] = entry.allowed;
  }
  return result;
}

/**
 * Throw if permission is denied. Used as a guard in function handlers.
 */
export async function requirePermission(
  ctx: AuthCtx,
  args: {
    feature: string;
    action: string;
  },
) {
  if (!ctx.user.activeOrganization?.id) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'No active organization',
    });
  }

  const allowed = await checkPermission(ctx, {
    userId: ctx.user._id,
    orgId: ctx.user.activeOrganization.id as Id<'organization'>,
    feature: args.feature,
    action: args.action,
  });

  if (!allowed) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: `Missing permission: ${args.feature}:${args.action}`,
    });
  }
}
