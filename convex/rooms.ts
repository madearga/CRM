// The rooms where people and agents work together.
//
// A room holds members (people and agents) and messages. A person writes
// under their own name, an agent writes under the name of the agent, and the
// ledger of the agent operations can project its proposals and decisions into
// the room they belong to.
//
// Rules that hold for every function in this file:
// - The organization always comes from the session context, never from an
//   argument, so a room can never cross an organization border.
// - A person id or an agent id in an argument never grants access. The
//   membership of the room decides, and the scopes of the member decide what
//   that membership may do.
// - An open room can be read and written by any member of the organization. A
//   private room can only be read and written by its members.

import {
  ROOM_KINDS,
  ROOM_MEMBER_ROLES,
  ROOM_MEMBER_TYPES,
  ROOM_MESSAGE_KINDS,
  ROOM_VISIBILITIES,
  narrowAgentScopes,
  roomSlug,
  scopesGrantRoomWrite,
} from '@crm/domain';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import type { Doc, Id } from './_generated/dataModel';
import type { DatabaseReader } from './_generated/server';
import {
  createInternalMutation,
  createOrgMutation,
  createOrgQuery,
} from './functions';
import {
  activeMembers,
  findAgentByKey,
  findAgentMembership,
  findUserMembership,
  membershipCanWrite,
  requireOrganizationMember,
  requireRoom,
  requireRoomWriteAccess,
  requireVisibleRoom,
  roomForbidden as forbidden,
  roomNotFound as notFound,
} from './roomAccess';

// The shared access rules live in roomAccess, so the operations module can
// ask the same question about a room as this module does.

const DEFAULT_MESSAGE_LIMIT = 50;const MAX_MESSAGE_LIMIT = 200;

type RoomDoc = Doc<'rooms'>;
type RoomMemberDoc = Doc<'roomMembers'>;
type RoomMessageDoc = Doc<'roomMessages'>;
type AgentDoc = Doc<'agents'>;

/**
 * True when a person may write into a room.
 *
 * A member writes when its role and scopes allow it. A person that is not a
 * member writes only in an open room.
 */
function personCanWrite(
  room: RoomDoc,
  membership: RoomMemberDoc | null
): boolean {
  if (membership) return membershipCanWrite(membership);
  return room.visibility === 'open';
}

/**
 * The scopes that bound an agent in a room.
 *
 * The scopes of the room membership can only narrow the scopes of the agent.
 * A membership without scopes keeps the scopes of the agent. A membership
 * with scopes keeps only the scopes that the agent also holds, so a room
 * can never give an agent more than the agent has. An agent without scopes
 * holds no right at all.
 */
function agentScopes(member: RoomMemberDoc, agent: AgentDoc): string[] {
  return narrowAgentScopes(agent.scopes, member.scopes);
}

/**
 * True when an agent may write into a room.
 *
 * The role decides first: an observer reads but never writes. The scopes
 * decide next. The scopes of the membership narrow the scopes of the agent,
 * so the agent must hold the write itself. The rule fails closed: an agent
 * without scopes writes nothing, even when the room grants the write.
 */
function agentCanWrite(member: RoomMemberDoc, agent: AgentDoc): boolean {
  if (member.role === 'observer') return false;

  const effective = agentScopes(member, agent);

  return scopesGrantRoomWrite(effective);
}

/** Plain view of a member. */
function toMemberView(member: RoomMemberDoc) {
  return {
    id: member._id,
    memberType: member.memberType,
    userId: member.userId,
    agentId: member.agentId,
    displayName: member.displayName,
    role: member.role,
    scopes: member.scopes,
    joinedAt: member.joinedAt,
  };
}

/** A slug that no other room of the organization uses. */
async function uniqueSlug(
  ctx: { db: DatabaseReader },
  organizationId: Id<'organization'>,
  name: string,
  currentRoomId?: Id<'rooms'>
): Promise<string> {
  const base = roomSlug(name);
  const rooms = await ctx.db
    .query('rooms')
    .withIndex('organizationId_slug', (q) => q.eq('organizationId', organizationId))
    .collect();

  const taken = new Set(
    rooms.filter((room) => room._id !== currentRoomId).map((room) => room.slug)
  );
  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export const list = createOrgQuery({
  permission: { feature: 'rooms', action: 'view' },
})({
  handler: async (ctx) => {
    const rooms = await ctx.db
      .query('rooms')
      .withIndex('organizationId_updatedAt', (q) => q.eq('organizationId', ctx.orgId))
      .collect();

    const result: {
      id: Id<'rooms'>;
      name: string;
      slug: string;
      description?: string;
      kind: string;
      visibility: string;
      memberCount: number;
      lastMessageAt?: number;
      createdAt: number;
    }[] = [];

    for (const room of rooms) {
      // An archived room is history, not work in progress, so it is left out.
      if (room.archivedAt !== undefined) continue;

      const members = await activeMembers(ctx, room._id);
      const membership = members.find(
        (member) => member.memberType === 'user' && member.userId === ctx.userId
      );

      // A private room is only visible to its members.
      if (room.visibility !== 'open' && !membership) continue;

      const lastMessages = await ctx.db
        .query('roomMessages')
        .withIndex('roomId_createdAt', (q) => q.eq('roomId', room._id))
        .order('desc')
        .take(1);

      result.push({
        id: room._id,
        name: room.name,
        slug: room.slug,
        description: room.description,
        kind: room.kind,
        visibility: room.visibility,
        memberCount: members.length,
        lastMessageAt: lastMessages[0]?.createdAt,
        createdAt: room.createdAt,
      });
    }

    return result;
  },
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

export const get = createOrgQuery({
  permission: { feature: 'rooms', action: 'view' },
})({
  args: {
    roomId: zid('rooms'),
  },
  handler: async (ctx, args) => {
    const { room, membership } = await requireVisibleRoom(
      ctx,
      ctx.orgId,
      args.roomId,
      ctx.userId
    );

    return {
      id: room._id,
      name: room.name,
      slug: room.slug,
      description: room.description,
      kind: room.kind,
      visibility: room.visibility,
      createdByUserId: room.createdByUserId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      archivedAt: room.archivedAt,
      membership: membership ? toMemberView(membership) : null,
    };
  },
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export const create = createOrgMutation({
  permission: { feature: 'rooms', action: 'create' },
})({
  args: {
    name: z.string().min(1).max(80),
    description: z.string().max(1000).optional(),
    kind: z.enum(ROOM_KINDS),
    visibility: z.enum(ROOM_VISIBILITIES),
    members: z
      .array(
        z.object({
          agentId: z.string().min(1).max(60),
          role: z.enum(ROOM_MEMBER_ROLES).optional(),
          scopes: z.array(z.string().min(1).max(100)).max(50).optional(),
        })
      )
      .max(50)
      .optional(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = await uniqueSlug(ctx, ctx.orgId, args.name);

    const roomId = await ctx.db.insert('rooms', {
      organizationId: ctx.orgId,
      name: args.name,
      slug,
      description: args.description,
      kind: args.kind,
      visibility: args.visibility,
      createdByUserId: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    // The person that opens a room owns it, so the room always has a person
    // that can manage it.
    const creator = await ctx.db.get(ctx.userId);
    await ctx.db.insert('roomMembers', {
      organizationId: ctx.orgId,
      roomId,
      memberType: 'user',
      userId: ctx.userId,
      displayName: creator?.name ?? 'Unknown',
      role: 'owner',
      scopes: [],
      joinedAt: now,
    });

    for (const member of args.members ?? []) {
      const agent = await findAgentByKey(ctx, ctx.orgId, member.agentId);
      if (!agent) {
        throw notFound(
          `The agent "${member.agentId}" does not exist in this organization`
        );
      }

      await ctx.db.insert('roomMembers', {
        organizationId: ctx.orgId,
        roomId,
        memberType: 'agent',
        agentId: member.agentId,
        displayName: agent.name,
        role: member.role ?? 'member',
        scopes: member.scopes ?? [],
        joinedAt: now,
      });
    }

    return { id: roomId, slug };
  },
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export const update = createOrgMutation({
  permission: { feature: 'rooms', action: 'manage' },
})({
  args: {
    roomId: zid('rooms'),
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(1000).optional(),
    kind: z.enum(ROOM_KINDS).optional(),
    visibility: z.enum(ROOM_VISIBILITIES).optional(),
  },
  handler: async (ctx, args) => {
    // A private room is only known to its members, and only a member that
    // may write may change it. The permission to manage rooms is not a way
    // around the limits of the room.
    const { room } = await requireRoomWriteAccess(
      ctx,
      ctx.orgId,
      args.roomId,
      ctx.userId
    );

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      patch.name = args.name;
      // The slug follows the name, so a link to the room keeps working with
      // the name it shows.
      patch.slug = await uniqueSlug(ctx, ctx.orgId, args.name, room._id);
    }
    if (args.description !== undefined) patch.description = args.description;
    if (args.kind !== undefined) patch.kind = args.kind;
    if (args.visibility !== undefined) patch.visibility = args.visibility;

    await ctx.db.patch(room._id, patch);

    const updated = await ctx.db.get(room._id);
    return {
      id: updated!._id,
      name: updated!.name,
      slug: updated!.slug,
      description: updated!.description,
      kind: updated!.kind,
      visibility: updated!.visibility,
      updatedAt: updated!.updatedAt,
    };
  },
});

// ---------------------------------------------------------------------------
// archive
// ---------------------------------------------------------------------------

export const archive = createOrgMutation({
  permission: { feature: 'rooms', action: 'manage' },
})({
  args: {
    roomId: zid('rooms'),
  },
  handler: async (ctx, args) => {
    // A private room is only known to its members, and only a member that
    // may write may archive it.
    const { room } = await requireRoomWriteAccess(
      ctx,
      ctx.orgId,
      args.roomId,
      ctx.userId
    );
    const now = Date.now();

    await ctx.db.patch(room._id, { archivedAt: now, updatedAt: now });

    return { id: room._id, archivedAt: now };
  },
});

// ---------------------------------------------------------------------------
// listMembers
// ---------------------------------------------------------------------------

export const listMembers = createOrgQuery({
  permission: { feature: 'rooms', action: 'view' },
})({
  args: {
    roomId: zid('rooms'),
  },
  handler: async (ctx, args) => {
    await requireVisibleRoom(ctx, ctx.orgId, args.roomId, ctx.userId);

    const members = await activeMembers(ctx, args.roomId);
    return members.map(toMemberView);
  },
});

// ---------------------------------------------------------------------------
// addMember
// ---------------------------------------------------------------------------

export const addMember = createOrgMutation({
  permission: { feature: 'rooms', action: 'manage' },
})({
  args: {
    roomId: zid('rooms'),
    memberType: z.enum(ROOM_MEMBER_TYPES),
    userId: zid('user').optional(),
    agentId: z.string().min(1).max(60).optional(),
    role: z.enum(ROOM_MEMBER_ROLES).optional(),
    scopes: z.array(z.string().min(1).max(100)).max(50).optional(),
  },
  handler: async (ctx, args) => {
    // A private room is only known to its members, so a manager that is not
    // a member cannot join it. Only a member that may write may add a
    // member.
    const { room } = await requireRoomWriteAccess(
      ctx,
      ctx.orgId,
      args.roomId,
      ctx.userId
    );
    const now = Date.now();

    let displayName: string;
    let userId: Id<'user'> | undefined;
    let agentId: string | undefined;

    if (args.memberType === 'user') {
      if (!args.userId) {
        throw new ConvexError({
          code: 'BAD_REQUEST',
          message: 'A user member needs a userId',
        });
      }
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw notFound('The user does not exist');
      }
      // A person of another organization never joins a room of this
      // organization.
      await requireOrganizationMember(ctx, ctx.orgId, args.userId);
      userId = args.userId;      displayName = user.name;
    } else {
      if (!args.agentId) {
        throw new ConvexError({
          code: 'BAD_REQUEST',
          message: 'An agent member needs an agentId',
        });
      }
      const agent = await findAgentByKey(ctx, ctx.orgId, args.agentId);
      if (!agent) {
        throw notFound(
          `The agent "${args.agentId}" does not exist in this organization`
        );
      }
      if (agent.status !== 'active') {
        throw forbidden(
          `The agent "${args.agentId}" is disabled and cannot join a room`
        );
      }
      agentId = args.agentId;
      displayName = agent.name;
    }

    const existing = await ctx.db
      .query('roomMembers')
      .withIndex('organizationId_roomId', (q) =>
        q.eq('organizationId', ctx.orgId).eq('roomId', room._id)
      )
      .collect();

    const same = existing.find(
      (member) =>
        (userId ? member.userId === userId : member.agentId === agentId) &&
        member.memberType === args.memberType
    );

    const role = args.role ?? same?.role ?? 'member';
    const scopes = args.scopes ?? same?.scopes ?? [];

    if (same) {
      // A member that left comes back instead of a second row of the same
      // person appearing in the room.
      await ctx.db.patch(same._id, {
        displayName,
        role,
        scopes,
        leftAt: undefined,
      });
      const updated = await ctx.db.get(same._id);
      return toMemberView(updated!);
    }

    const memberId = await ctx.db.insert('roomMembers', {
      organizationId: ctx.orgId,
      roomId: room._id,
      memberType: args.memberType,
      userId,
      agentId,
      displayName,
      role,
      scopes,
      joinedAt: now,
    });

    const member = await ctx.db.get(memberId);
    return toMemberView(member!);
  },
});

// ---------------------------------------------------------------------------
// removeMember
// ---------------------------------------------------------------------------

export const removeMember = createOrgMutation({
  permission: { feature: 'rooms', action: 'manage' },
})({
  args: {
    roomId: zid('rooms'),
    memberId: zid('roomMembers'),
  },
  handler: async (ctx, args) => {
    // A private room is only known to its members, and only a member that
    // may write may remove anybody from it.
    const { room } = await requireRoomWriteAccess(
      ctx,
      ctx.orgId,
      args.roomId,
      ctx.userId
    );

    const member = await ctx.db.get(args.memberId);
    if (!member || member.roomId !== room._id) {
      throw notFound('The member does not exist in this room');
    }

    if (member.role === 'owner') {
      throw forbidden('The owner of the room cannot be removed');
    }

    const members = await activeMembers(ctx, room._id);
    if (members.length <= 1) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'A room keeps at least one member',
      });
    }

    const now = Date.now();
    await ctx.db.patch(member._id, { leftAt: now });

    return { id: member._id, leftAt: now };
  },
});

// ---------------------------------------------------------------------------
// updateMember
// ---------------------------------------------------------------------------

export const updateMember = createOrgMutation({
  permission: { feature: 'rooms', action: 'manage' },
})({
  args: {
    roomId: zid('rooms'),
    memberId: zid('roomMembers'),
    role: z.enum(ROOM_MEMBER_ROLES).optional(),
    scopes: z.array(z.string().min(1).max(100)).max(50).optional(),
  },
  handler: async (ctx, args) => {
    // A private room is only known to its members, and only a member that
    // may write may change its members. An observer cannot promote itself
    // to owner this way.
    const { room } = await requireRoomWriteAccess(
      ctx,
      ctx.orgId,
      args.roomId,
      ctx.userId
    );

    const member = await ctx.db.get(args.memberId);
    if (!member || member.roomId !== room._id) {
      throw notFound('The member does not exist in this room');
    }

    // Only the given fields change.
    const patch: Record<string, unknown> = {};
    if (args.role !== undefined) patch.role = args.role;
    if (args.scopes !== undefined) patch.scopes = args.scopes;

    await ctx.db.patch(member._id, patch);

    const updated = await ctx.db.get(member._id);
    return toMemberView(updated!);
  },
});

// ---------------------------------------------------------------------------
// listMessages
// ---------------------------------------------------------------------------

export const listMessages = createOrgQuery({
  permission: { feature: 'rooms', action: 'view' },
})({
  args: {
    roomId: zid('rooms'),
    limit: z.number().int().min(1).max(MAX_MESSAGE_LIMIT).optional(),
  },
  handler: async (ctx, args) => {
    await requireVisibleRoom(ctx, ctx.orgId, args.roomId, ctx.userId);

    const limit = args.limit ?? DEFAULT_MESSAGE_LIMIT;

    const messages = await ctx.db
      .query('roomMessages')
      .withIndex('roomId_createdAt', (q) => q.eq('roomId', args.roomId))
      .order('desc')
      .take(limit);

    // The newest messages are read from the bottom, so the list is reversed
    // into the order of a conversation.
    const ordered = messages.slice().reverse();

    const names = new Map<string, string>();
    const authorName = async (message: RoomMessageDoc): Promise<string> => {
      if (message.authorUserId) {
        const cached = names.get(message.authorUserId);
        if (cached) return cached;
        const user = await ctx.db.get(message.authorUserId);
        const name = user?.name ?? 'Unknown';
        names.set(message.authorUserId, name);
        return name;
      }
      if (message.authorAgentId) {
        const cached = names.get(message.authorAgentId);
        if (cached) return cached;
        const agent = await findAgentByKey(ctx, ctx.orgId, message.authorAgentId);
        const name = agent?.name ?? message.authorAgentId;
        names.set(message.authorAgentId, name);
        return name;
      }
      if (message.authorType === 'system') return 'System';
      return 'Unknown';
    };

    const result: {
      id: Id<'roomMessages'>;
      authorType: string;
      authorUserId?: Id<'user'>;
      authorAgentId?: string;
      authorName: string;
      kind: string;
      text: string;
      operationId?: Id<'agentOperations'>;
      replyToId?: Id<'roomMessages'>;
      createdAt: number;
    }[] = [];

    for (const message of ordered) {
      result.push({
        id: message._id,
        authorType: message.authorType,
        authorUserId: message.authorUserId,
        authorAgentId: message.authorAgentId,
        authorName: await authorName(message),
        kind: message.kind,
        text: message.text,
        operationId: message.operationId,
        replyToId: message.replyToId,
        createdAt: message.createdAt,
      });
    }

    return result;
  },
});

// ---------------------------------------------------------------------------
// postMessage
// ---------------------------------------------------------------------------

export const postMessage = createOrgMutation({
  permission: { feature: 'rooms', action: 'create' },
})({
  args: {
    roomId: zid('rooms'),
    text: z.string().min(1).max(4000),
    replyToId: zid('roomMessages').optional(),
  },
  handler: async (ctx, args) => {
    const { room, membership } = await requireVisibleRoom(
      ctx,
      ctx.orgId,
      args.roomId,
      ctx.userId
    );

    if (!personCanWrite(room, membership)) {
      throw forbidden('The person may not write into this room');
    }

    if (room.archivedAt !== undefined) {
      throw forbidden('The room is archived');
    }

    const messageId = await ctx.db.insert('roomMessages', {
      organizationId: ctx.orgId,
      roomId: room._id,
      authorType: 'user',
      authorUserId: ctx.userId,
      kind: 'message',
      text: args.text,
      replyToId: args.replyToId,
      createdAt: Date.now(),
    });

    const message = await ctx.db.get(messageId);
    return {
      id: message!._id,
      roomId: message!.roomId,
      authorType: message!.authorType,
      authorUserId: message!.authorUserId,
      authorAgentId: message!.authorAgentId,
      kind: message!.kind,
      text: message!.text,
      replyToId: message!.replyToId,
      createdAt: message!.createdAt,
    };
  },
});

// ---------------------------------------------------------------------------
// postFromAgent
// ---------------------------------------------------------------------------

/**
 * Write a message into a room as an agent.
 *
 * This is the way the ledger reaches the room: the agent must exist, must be
 * active, must be a member of the room and must be allowed to write there.
 * An agent that fails one of these checks writes nothing at all.
 *
 * A message without an agent is never the chat of an agent. Such a message
 * must be a system message, and it must point at an operation that exists in
 * this room, so the note of the ledger always belongs to real work.
 */
export const postFromAgent = createInternalMutation()({
  args: {
    organizationId: zid('organization'),
    roomId: zid('rooms'),
    agentId: z.string().min(1).max(60).optional(),
    text: z.string().min(1).max(4000),
    kind: z.enum(ROOM_MESSAGE_KINDS).optional(),
    operationId: zid('agentOperations').optional(),
    replyToId: zid('roomMessages').optional(),
  },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.organizationId, args.roomId);

    if (room.archivedAt !== undefined) {
      throw forbidden('The room is archived');
    }

    let authorType = 'agent';

    if (args.agentId) {
      const agent = await findAgentByKey(ctx, args.organizationId, args.agentId);
      if (!agent) {
        throw notFound(
          `The agent "${args.agentId}" does not exist in this organization`
        );
      }

      if (agent.status !== 'active') {
        throw forbidden(`The agent "${args.agentId}" is disabled`);
      }

      const membership = await findAgentMembership(ctx, room._id, args.agentId);
      if (!membership) {
        throw forbidden(
          `The agent "${args.agentId}" is not a member of this room`
        );
      }

      if (!agentCanWrite(membership, agent)) {
        throw forbidden(
          `The agent "${args.agentId}" may not write into this room`
        );
      }
    } else {
      // A message without an agent must be the note of the ledger about a
      // real operation of this room. A proposal of a person is not a service
      // message, so it is refused here.
      if (args.kind !== 'system') {
        throw forbidden(
          'A message without an agent must be a system message of an operation'
        );
      }

      if (!args.operationId) {
        throw forbidden(
          'A system message without an agent must point at an operation'
        );
      }

      const operation = await ctx.db.get(args.operationId);
      if (!operation || operation.organizationId !== args.organizationId) {
        throw notFound('The operation does not exist in this organization');
      }

      if (operation.roomId !== room._id) {
        throw forbidden('The operation does not belong to this room');
      }

      authorType = 'system';
    }

    const messageId = await ctx.db.insert('roomMessages', {
      organizationId: args.organizationId,
      roomId: room._id,
      authorType,
      authorAgentId: args.agentId,
      kind: args.kind ?? 'message',
      text: args.text,
      operationId: args.operationId,
      replyToId: args.replyToId,
      createdAt: Date.now(),
    });

    const message = await ctx.db.get(messageId);
    return {
      id: message!._id,
      roomId: message!.roomId,
      authorType: message!.authorType,
      authorAgentId: message!.authorAgentId,
      kind: message!.kind,
      text: message!.text,
      operationId: message!.operationId,
      replyToId: message!.replyToId,
      createdAt: message!.createdAt,
    };
  },
});

// ---------------------------------------------------------------------------
// postFromUser
// ---------------------------------------------------------------------------

/**
 * Write a message into a room as a person, without the session.
 *
 * The ledger uses this for a decision: the approver wrote the decision, and
 * the decision belongs next to the operation it settles.
 *
 * The write access of the person is checked here, so the ledger cannot put
 * a message into a room that the person may not write in.
 */
export const postFromUser = createInternalMutation()({
  args: {
    organizationId: zid('organization'),
    roomId: zid('rooms'),
    userId: zid('user'),
    text: z.string().min(1).max(4000),
    kind: z.enum(ROOM_MESSAGE_KINDS).optional(),
    operationId: zid('agentOperations').optional(),
    replyToId: zid('roomMessages').optional(),
  },
  handler: async (ctx, args) => {
    const { room } = await requireRoomWriteAccess(
      ctx,
      args.organizationId,
      args.roomId,
      args.userId
    );

    const messageId = await ctx.db.insert('roomMessages', {
      organizationId: args.organizationId,
      roomId: room._id,
      authorType: 'user',
      authorUserId: args.userId,
      kind: args.kind ?? 'message',
      text: args.text,
      operationId: args.operationId,
      replyToId: args.replyToId,
      createdAt: Date.now(),
    });

    const message = await ctx.db.get(messageId);
    return {
      id: message!._id,
      roomId: message!.roomId,
      authorType: message!.authorType,
      authorUserId: message!.authorUserId,
      kind: message!.kind,
      text: message!.text,
      operationId: message!.operationId,
      createdAt: message!.createdAt,
    };
  },
});
