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
 * True when the scopes grant the action. A scope is either the plain action
 * ('read') or the action bound to a resource ('inventory:read'). A bare
 * resource name grants nothing, because naming a resource is not asking for
 * any right on it.
 */
export function agentCanPerform(
  scopes: readonly string[],
  action: AgentAction
): boolean {
  return scopes.some((scope) => {
    if (scope === action) return true;
    return scope.endsWith(`:${action}`);
  });
}
