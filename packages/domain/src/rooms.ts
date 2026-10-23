// Rooms contract: a room is the shared space where people and agents work
// together. An agent is a member of a room with its own name and its own
// scopes, not a user account: it never signs in and it never owns an
// organization.

export const ROOM_KINDS = ['project', 'department'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export const ROOM_VISIBILITIES = ['open', 'private'] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export const ROOM_MEMBER_TYPES = ['user', 'agent'] as const;
export type RoomMemberType = (typeof ROOM_MEMBER_TYPES)[number];

export const ROOM_MEMBER_ROLES = ['owner', 'member', 'observer'] as const;
export type RoomMemberRole = (typeof ROOM_MEMBER_ROLES)[number];

export const ROOM_MESSAGE_KINDS = [
  'message',
  'proposal',
  'decision',
  'system',
] as const;
export type RoomMessageKind = (typeof ROOM_MESSAGE_KINDS)[number];

export const AGENT_STATUSES = ['active', 'disabled'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** The actions an agent may be given in a room. */
export const AGENT_ACTIONS = ['read', 'write', 'approve'] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

const MAX_SLUG_LENGTH = 40;

/**
 * A readable slug of a room name. The name is free text, so every run of
 * characters that is not a letter or a digit becomes one dash, which keeps
 * two different names from landing on the same slug by accident of spacing.
 */
export function roomSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
  return slug.length > 0 ? slug : 'room';
}

/**
 * The action of a scope. The scope "inventory:read" asks for the action
 * "read". A scope that names no known action is not a scope, so a bare
 * resource name such as "inventory" has no action and grants nothing.
 */
export function scopeAction(scope: string): string | null {
  const separator = scope.lastIndexOf(':');
  const action = separator < 0 ? scope : scope.slice(separator + 1);
  return (AGENT_ACTIONS as readonly string[]).includes(action) ? action : null;
}

/**
 * The resource of a scope. The scope "inventory:read" names the resource
 * "inventory". A scope without a resource names none, so it reaches every
 * resource of its action.
 */
export function scopeResource(scope: string): string | null {
  const separator = scope.lastIndexOf(':');
  if (separator < 0) return null;
  const resource = scope.slice(0, separator);
  return resource.length > 0 ? resource : null;
}

/**
 * True when a wanted scope stays inside the scopes that were granted.
 *
 * A granted scope without a resource reaches every resource of its action.
 * A granted scope with a resource reaches that resource only. A wanted scope
 * without a resource asks for more than a granted scope with a resource, so
 * it does not fit.
 */
export function scopeFits(
  granted: readonly string[],
  wanted: string
): boolean {
  const wantedAction = scopeAction(wanted);
  if (wantedAction === null) return false;
  const wantedResource = scopeResource(wanted);

  return granted.some((scope) => {
    if (scopeAction(scope) !== wantedAction) return false;
    const grantedResource = scopeResource(scope);
    if (grantedResource === null) return true;
    return grantedResource === wantedResource;
  });
}

/**
 * The scopes that bound an agent in a room.
 *
 * The scopes of the room membership can only narrow the scopes of the agent.
 * A membership without scopes keeps the scopes of the agent. A membership
 * with scopes keeps only the scopes of the membership that the agent also
 * holds, so a room can never give an agent more than the agent has.
 *
 * The rule fails closed: an agent without scopes holds no right at all, so a
 * membership can never grant a right that the agent does not have.
 */
export function narrowAgentScopes(
  granted: readonly string[],
  memberScopes: readonly string[]
): string[] {
  if (granted.length === 0) return [];
  if (memberScopes.length === 0) return [...granted];
  return memberScopes.filter(
    (scope) => scopeAction(scope) !== null && scopeFits(granted, scope)
  );
}

/**
 * True when the scopes grant the action for every resource.
 *
 * The semantics of a scope are these:
 * - A plain scope such as "write" names the action only, so it reaches every
 *   resource of that action.
 * - A scope with a resource such as "inventory:write" names one resource, so
 *   it reaches that resource only.
 * - A bare resource name such as "inventory" names no action, so it grants
 *   nothing.
 *
 * A request without a resource asks for the action on every resource, so a
 * scope with a resource never answers it. A request with a resource is
 * answered by a plain scope and by a scope of the same resource.
 */
export function agentCanPerform(
  scopes: readonly string[],
  action: AgentAction
): boolean {
  return scopes.some(
    (scope) => scopeAction(scope) === action && scopeResource(scope) === null
  );
}

/**
 * True when the scopes grant the action for the resource.
 *
 * A plain scope reaches every resource, so it answers the request. A scope
 * with a resource answers the request only for that resource.
 */
export function agentCanPerformFor(
  scopes: readonly string[],
  action: AgentAction,
  resource: string
): boolean {
  return scopes.some((scope) => {
    if (scopeAction(scope) !== action) return false;
    const scopeName = scopeResource(scope);
    return scopeName === null || scopeName === resource;
  });
}

/** The resource name of a room. */
export const ROOM_RESOURCE = 'rooms';

/**
 * True when the scopes grant the write into a room.
 *
 * A room is the resource "rooms", so the scope "write" and the scope
 * "rooms:write" grant the write into a room. A scope of another resource,
 * such as "inventory:write", grants no write into a room.
 */
export function scopesGrantRoomWrite(scopes: readonly string[]): boolean {
  return agentCanPerformFor(scopes, 'write', ROOM_RESOURCE);
}
