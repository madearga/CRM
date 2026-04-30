// Mirrors convex/permissionHelpers.ts constants for frontend use

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
  'hr_employees',
  'hr_attendance',
  'hr_shifts',
  'hr_reports',
  'hr_branches',
  'hr_holidays',
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
  'export',
] as const;

export type Action = (typeof ACTIONS)[number];

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
  hr_employees: ['view', 'create', 'edit', 'delete'],
  hr_attendance: ['view', 'edit', 'manage'],
  hr_shifts: ['view', 'create', 'edit', 'delete'],
  hr_reports: ['view', 'export'],
  hr_branches: ['view', 'create', 'edit', 'delete'],
  hr_holidays: ['view', 'create', 'delete'],
};

/** Build a full set of entries (all allowed or all denied) for cloning / creating */
export function buildDefaultEntries(allowed: boolean) {
  return FEATURES.flatMap((feature) =>
    FEATURE_ACTIONS[feature].map((action) => ({
      feature,
      action,
      allowed,
    })),
  );
}
