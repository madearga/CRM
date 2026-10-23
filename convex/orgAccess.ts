/**
 * Access rules for organization level actions.
 *
 * Two rule sets exist and they must not be mixed:
 *
 * 1. CRM business features (`contacts`, `deals`, `templates`, ...). They are
 *    checked with the permission templates of the current organization member.
 *    The feature list and the valid actions come from the permission system.
 *    An action that the feature does not define is never granted.
 *
 * 2. Organizational actions (`organization`, `member`, `invitation`, ...).
 *    They keep the role based rules of the access control definition. The
 *    resource list comes from the access control statements, so no resource is
 *    invented here.
 *
 * The module is free of database access on purpose. It stays testable without
 * a Convex deployment.
 */
import { ac, roles } from './authPermissions';
import { FEATURES, FEATURE_ACTIONS } from './permissionHelpers';

type RoleDefinition = {
  authorize: (request: Record<string, string[]>) => { success: boolean };
};

/** Resources of the access control definition. */
export const ORGANIZATIONAL_RESOURCES: readonly string[] = Object.keys(
  ac.statements as Record<string, unknown>
);

/** Features of the CRM permission system. */
export const CRM_FEATURES: readonly string[] = FEATURES;

export const isCrmFeature = (resource: string): boolean =>
  CRM_FEATURES.includes(resource);

export const isOrganizationalResource = (resource: string): boolean =>
  ORGANIZATIONAL_RESOURCES.includes(resource);

/**
 * Check that an action belongs to a feature. Unknown actions are never
 * granted, so a wrong feature mapping fails closed.
 */
export const isCrmFeatureAction = (
  feature: string,
  action: string
): boolean => {
  const actions = (FEATURE_ACTIONS as Record<string, readonly string[]>)[
    feature
  ];
  return actions ? actions.includes(action) : false;
};

/**
 * Check the role based rules of the access control definition.
 * An unknown role is never allowed.
 */
export const roleAllows = (
  role: string,
  resource: string,
  actions: string[]
): boolean => {
  const definition = (roles as Record<string, RoleDefinition | undefined>)[
    role
  ];
  if (!definition) {
    return false;
  }

  return definition.authorize({ [resource]: actions }).success === true;
};

export const OWNER_ROLE = 'owner';

export type RoleDecision = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check whether the current member may give a role to another member.
 *
 * The role statement set gives the owner role to the owner and the admin
 * role to the admin. A direct change of the CRM role must not give the owner
 * role to a member that is not an owner. The same rule protects an owner
 * from a demotion by a member that is not an owner.
 */
export const canAssignRole = (args: {
  currentRole: string;
  destinationRole: string;
  sourceRole: string;
}): RoleDecision => {
  const touchesOwner =
    args.destinationRole === OWNER_ROLE || args.sourceRole === OWNER_ROLE;

  if (touchesOwner && args.currentRole !== OWNER_ROLE) {
    return {
      allowed: false,
      reason: 'Only an owner can change the owner role',
    };
  }

  return { allowed: true };
};

/**
 * Check whether the current member may invite a user with a role.
 *
 * An admin may invite members. An owner invitation needs an owner.
 */
export const canInviteRole = (args: {
  currentRole: string;
  invitedRole: string;
}): RoleDecision => {
  if (args.invitedRole === OWNER_ROLE && args.currentRole !== OWNER_ROLE) {
    return {
      allowed: false,
      reason: 'Only an owner can invite an owner',
    };
  }

  return { allowed: true };
};
