// The access rules of a room, in one place.
//
// The rooms module and the operations module both need to know whether a
// person may write into a room. Both use these helpers, so both apply the
// same rules and neither file has to import the other.
//
// The rules that hold for every check here:
// - The organization of the room and the organization of the person must be
//   the same, so a room can never cross an organization border.
// - An archived room is history, so nobody writes into it.
// - A private room is only known to its members, so a person that is not a
//   member does not even learn that the room exists.
// - An observer reads but never writes.
// - Scopes narrow the right to write, so a member with the scope "read"
//   alone stays a reader.

import { scopesGrantRoomWrite } from '@crm/domain';
import { ConvexError } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import type { DatabaseReader } from './_generated/server';

export type RoomDoc = Doc<'rooms'>;
export type RoomMemberDoc = Doc<'roomMembers'>;
export type AgentDoc = Doc<'agents'>;

/** Not found error with the code the callers expect. */
export function roomNotFound(
  message: string
): ConvexError<{ code: string; message: string }> {
  return new ConvexError({ code: 'NOT_FOUND', message });
}

/** Refused error with the code the callers expect. */
export function roomForbidden(
  message: string
): ConvexError<{ code: string; message: string }> {
  return new ConvexError({ code: 'FORBIDDEN', message });
}

/** The members of a room that did not leave. */
export async function activeMembers(
  ctx: { db: DatabaseReader },
  roomId: Id<'rooms'>
): Promise<RoomMemberDoc[]> {
  const members = await ctx.db
    .query('roomMembers')
    .withIndex('roomId_memberType', (q) => q.eq('roomId', roomId))
    .collect();

  return members.filter((member) => member.leftAt === undefined);
}

/** The membership of a person in a room, or null when there is none. */
export async function findUserMembership(
  ctx: { db: DatabaseReader },
  roomId: Id<'rooms'>,
  userId: Id<'user'>
): Promise<RoomMemberDoc | null> {
  const members = await ctx.db
    .query('roomMembers')
    .withIndex('roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', userId))
    .collect();

  return members.find((member) => member.leftAt === undefined) ?? null;
}

/** The membership of an agent in a room, or null when there is none. */
export async function findAgentMembership(
  ctx: { db: DatabaseReader },
  roomId: Id<'rooms'>,
  agentId: string
): Promise<RoomMemberDoc | null> {
  const members = await ctx.db
    .query('roomMembers')
    .withIndex('roomId_agentId', (q) => q.eq('roomId', roomId).eq('agentId', agentId))
    .collect();

  return members.find((member) => member.leftAt === undefined) ?? null;
}

/** The agent of an organization with this key, or null. */
export async function findAgentByKey(
  ctx: { db: DatabaseReader },
  organizationId: Id<'organization'>,
  agentId: string
): Promise<AgentDoc | null> {
  return ctx.db
    .query('agents')
    .withIndex('organizationId_agentId', (q) =>
      q.eq('organizationId', organizationId).eq('agentId', agentId)
    )
    .first();
}

/**
 * True when the person belongs to the organization.
 *
 * A person of another organization never reaches a room of this
 * organization, not even an open room.
 */
export async function isOrganizationMember(
  ctx: { db: DatabaseReader },
  organizationId: Id<'organization'>,
  userId: Id<'user'>
): Promise<boolean> {
  const member = await ctx.db
    .query('member')
    .withIndex('organizationId_userId', (q) =>
      q.eq('organizationId', organizationId).eq('userId', userId)
    )
    .first();

  return member !== null;
}

/**
 * The person must belong to the organization.
 *
 * A person of another organization never joins a room of this organization
 * and never writes into one.
 */
export async function requireOrganizationMember(
  ctx: { db: DatabaseReader },
  organizationId: Id<'organization'>,
  userId: Id<'user'>
): Promise<void> {
  if (!(await isOrganizationMember(ctx, organizationId, userId))) {
    throw roomForbidden('The user is not a member of this organization');
  }
}

/** The room of the organization, or a not found error. */
export async function requireRoom(
  ctx: { db: DatabaseReader },
  organizationId: Id<'organization'>,
  roomId: Id<'rooms'>
): Promise<RoomDoc> {
  const room = await ctx.db.get(roomId);
  if (!room || room.organizationId !== organizationId) {
    throw roomNotFound('The room does not exist in this organization');
  }
  return room;
}

/**
 * True when the membership of a person allows it to write.
 *
 * An observer reads but never writes. A member with scopes writes only when
 * the scopes grant the write into a room. A member without scopes writes.
 */
export function membershipCanWrite(member: RoomMemberDoc): boolean {
  if (member.role === 'observer') return false;
  if (member.scopes.length > 0) return scopesGrantRoomWrite(member.scopes);
  return true;
}

/**
 * The room a person may see, with the membership of that person.
 *
 * A private room that the person is not a member of does not exist for that
 * person, so the answer is a not found error and not a forbidden one. There
 * is no admin bypass: a person with the permission to manage rooms still
 * needs the membership of a private room.
 */
export async function requireVisibleRoom(
  ctx: { db: DatabaseReader },
  organizationId: Id<'organization'>,
  roomId: Id<'rooms'>,
  userId: Id<'user'>
): Promise<{ room: RoomDoc; membership: RoomMemberDoc | null }> {
  const room = await requireRoom(ctx, organizationId, roomId);
  const membership = await findUserMembership(ctx, roomId, userId);

  if (room.visibility === 'private' && !membership) {
    throw roomNotFound('The room does not exist in this organization');
  }

  return { room, membership };
}

/**
 * The room a person may write into, with the membership of that person.
 *
 * The check covers the tenant, the archive, the private membership, the
 * observer role and the scoped write. The caller gets the room and the
 * membership, so it can use the same answer for its own rules.
 *
 * An open room stays open: a person of the organization that is not a member
 * writes in it. A private room needs the membership of the person.
 */
export async function requireRoomWriteAccess(
  ctx: { db: DatabaseReader },
  organizationId: Id<'organization'>,
  roomId: Id<'rooms'>,
  userId: Id<'user'>
): Promise<{ room: RoomDoc; membership: RoomMemberDoc | null }> {
  const room = await requireRoom(ctx, organizationId, roomId);

  if (!(await isOrganizationMember(ctx, organizationId, userId))) {
    throw roomForbidden('The user is not a member of this organization');
  }

  if (room.archivedAt !== undefined) {
    throw roomForbidden('The room is archived');
  }

  const membership = await findUserMembership(ctx, roomId, userId);

  if (room.visibility === 'private' && !membership) {
    // A private room that the person cannot see does not exist for that
    // person, so the answer is a not found error.
    throw roomNotFound('The room does not exist in this organization');
  }

  if (membership && !membershipCanWrite(membership)) {
    throw roomForbidden('The person may not write into this room');
  }

  return { room, membership };
}
