// The management paths of a room.
//
// Only the external session transport is mocked. The real permission system,
// the real schema and the real room mutations run below.
//
// The rule under test: a private room belongs to its members. A person with
// the permission "rooms:manage" still needs the membership of a private
// room, so the permission alone cannot open a private room.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../_generated/api';
import { createTest, seed } from './roomTestApp.fixtures';

const session = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
}));

vi.mock('../auth', () => ({
  authClient: { getHeaders: async () => new Headers() },
  getAuth: () => ({ api: {} }),
}));

vi.mock('../authHelpers', () => ({
  getSessionUser: async () => session.user,
  getSessionUserWriter: async () => session.user,
}));

beforeEach(() => {
  session.user = null;
});

afterEach(() => {
  session.user = null;
});

/**
 * An organization with a manager that holds the real Admin permission
 * template, plus a private room and an open room.
 */
async function fixture() {
  const t = createTest();

  const data = await seed(t, { visibility: 'private' });

  const openRoomId = await t.run(async (ctx) =>
    ctx.db.insert('rooms', {
      organizationId: data.organizationId,
      name: 'Open room',
      slug: 'open-room',
      kind: 'project',
      visibility: 'open',
      createdByUserId: data.memberUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );

  // The manager is a person of the organization with the real Admin
  // permission template, so the permission system gives it rooms:manage.
  const managerId = await t.run(async (ctx) => {
    const managerUserId = await ctx.db.insert('user', {
      name: 'Manager',
      email: 'manager@example.com',
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const templateId = await ctx.db.insert('permissionTemplates', {
      name: 'Admin',
      description: 'All features except role management',
      color: '#f59e0b',
      isDefault: true,
      organizationId: data.organizationId,
      ownerId: data.memberUserId,
    });

    for (const action of ['view', 'create', 'manage']) {
      await ctx.db.insert('permissionEntries', {
        feature: 'rooms',
        action,
        allowed: true,
        organizationId: data.organizationId,
        templateId,
      });
    }

    await ctx.db.insert('member', {
      organizationId: data.organizationId,
      userId: managerUserId,
      role: 'admin',
      permissionTemplateId: templateId,
      createdAt: Date.now(),
    });

    return managerUserId;
  });

  // The observer and the reader are members of the private room. They hold
  // the same Admin permission template, so the permission system gives them
  // rooms:manage as well.
  const limited = await t.run(async (ctx) => {
    const templateId = await ctx.db
      .query('permissionTemplates')
      .withIndex('organizationId_name', (q) =>
        q.eq('organizationId', data.organizationId).eq('name', 'Admin')
      )
      .first();

    const observerUserId = await ctx.db.insert('user', {
      name: 'Observer',
      email: 'observer@example.com',
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const readerUserId = await ctx.db.insert('user', {
      name: 'Reader',
      email: 'reader@example.com',
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (const userId of [observerUserId, readerUserId]) {
      await ctx.db.insert('member', {
        organizationId: data.organizationId,
        userId,
        role: 'admin',
        permissionTemplateId: templateId!._id,
        createdAt: Date.now(),
      });
    }

    const observerMemberId = await ctx.db.insert('roomMembers', {
      organizationId: data.organizationId,
      roomId: data.roomId,
      memberType: 'user',
      userId: observerUserId,
      displayName: 'Observer',
      role: 'observer',
      scopes: [],
      joinedAt: Date.now(),
    });

    const readerMemberId = await ctx.db.insert('roomMembers', {
      organizationId: data.organizationId,
      roomId: data.roomId,
      memberType: 'user',
      userId: readerUserId,
      displayName: 'Reader',
      role: 'member',
      scopes: ['read'],
      joinedAt: Date.now(),
    });

    return { observerUserId, readerUserId, observerMemberId, readerMemberId };
  });

  session.user = {
    _id: managerId,
    id: managerId,
    activeOrganization: { id: data.organizationId, role: 'admin' },
  };

  const memberId = await t.run(async (ctx) =>
    ctx.db.insert('roomMembers', {
      organizationId: data.organizationId,
      roomId: data.roomId,
      memberType: 'user',
      userId: data.memberUserId,
      displayName: 'Member',
      role: 'owner',
      scopes: [],
      joinedAt: Date.now(),
    })
  );

  return { t, data, managerId, openRoomId, memberId, limited };
}

/** The code of a refused call. */
async function code(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (caught: any) => caught
  );
  expect(error, 'the call must be refused').toBeTruthy();
  return error.data?.code ?? 'NO_CODE';
}

describe('the management of a private room', () => {
  it('refuses a manager that is not a member to add itself', async () => {
    const { t, data, managerId } = await fixture();

    const result = await code(
      t.mutation(api.rooms.addMember, {
        roomId: data.roomId,
        memberType: 'user',
        userId: managerId,
      })
    );

    expect(result).toBe('NOT_FOUND');
    const members = await t.run((ctx) =>
      ctx.db
        .query('roomMembers')
        .withIndex('roomId_userId', (q) =>
          q.eq('roomId', data.roomId).eq('userId', managerId)
        )
        .collect()
    );
    expect(members).toHaveLength(0);
  });

  it('refuses a manager that is not a member to read the members', async () => {
    const { t, data } = await fixture();

    const result = await code(
      t.query(api.rooms.listMembers, { roomId: data.roomId })
    );

    expect(result).toBe('NOT_FOUND');
  });

  it('refuses a manager that is not a member to read the messages', async () => {
    const { t, data } = await fixture();

    const result = await code(
      t.query(api.rooms.listMessages, { roomId: data.roomId })
    );

    expect(result).toBe('NOT_FOUND');
  });

  it('refuses a manager that is not a member to change the room', async () => {
    const { t, data } = await fixture();

    const result = await code(
      t.mutation(api.rooms.update, {
        roomId: data.roomId,
        description: 'A description of a stranger',
      })
    );

    expect(result).toBe('NOT_FOUND');
  });

  it('refuses a manager that is not a member to archive the room', async () => {
    const { t, data } = await fixture();

    const result = await code(
      t.mutation(api.rooms.archive, { roomId: data.roomId })
    );

    expect(result).toBe('NOT_FOUND');

    const room = await t.run((ctx) => ctx.db.get(data.roomId));
    expect(room?.archivedAt).toBeUndefined();
  });

  it('refuses a manager that is not a member to remove a member', async () => {
    const { t, data, memberId } = await fixture();

    const result = await code(
      t.mutation(api.rooms.removeMember, {
        roomId: data.roomId,
        memberId,
      })
    );

    expect(result).toBe('NOT_FOUND');
  });

  it('refuses a manager that is not a member to change a member', async () => {
    const { t, data, memberId } = await fixture();

    const result = await code(
      t.mutation(api.rooms.updateMember, {
        roomId: data.roomId,
        memberId,
        role: 'observer',
      })
    );

    expect(result).toBe('NOT_FOUND');
  });
});

describe('the management of an open room', () => {
  it('lets a manager add a member', async () => {
    const { t, data, managerId, openRoomId } = await fixture();

    const member = await t.mutation(api.rooms.addMember, {
      roomId: openRoomId,
      memberType: 'user',
      userId: managerId,
    });

    expect(member.userId).toBe(managerId);
  });

  it('lets a manager change the room', async () => {
    const { t, openRoomId } = await fixture();

    const room = await t.mutation(api.rooms.update, {
      roomId: openRoomId,
      description: 'A description of the manager',
    });

    expect(room.description).toBe('A description of the manager');
  });
});

describe('the management of a private room by a member', () => {
  it('lets a member of the private room change it', async () => {
    const { t, data, memberId } = await fixture();

    session.user = {
      _id: data.memberUserId,
      id: data.memberUserId,
      activeOrganization: { id: data.organizationId, role: 'owner' },
    };

    const result = await t.mutation(api.rooms.updateMember, {
      roomId: data.roomId,
      memberId,
      scopes: ['read'],
    });

    expect(result.scopes).toEqual(['read']);
  });
});

describe('the limits of a member of a private room', () => {
  it('refuses an observer that tries to promote itself to owner', async () => {
    const { t, data, limited } = await fixture();

    session.user = {
      _id: limited.observerUserId,
      id: limited.observerUserId,
      activeOrganization: { id: data.organizationId, role: 'admin' },
    };

    const result = await code(
      t.mutation(api.rooms.updateMember, {
        roomId: data.roomId,
        memberId: limited.observerMemberId,
        role: 'owner',
      })
    );

    expect(result).toBe('FORBIDDEN');

    const member = await t.run((ctx) => ctx.db.get(limited.observerMemberId));
    expect(member?.role).toBe('observer');
  });

  it('refuses a member that may only read', async () => {
    const { t, data, limited } = await fixture();

    session.user = {
      _id: limited.readerUserId,
      id: limited.readerUserId,
      activeOrganization: { id: data.organizationId, role: 'admin' },
    };

    const result = await code(
      t.mutation(api.rooms.updateMember, {
        roomId: data.roomId,
        memberId: limited.readerMemberId,
        scopes: ['write'],
      })
    );

    expect(result).toBe('FORBIDDEN');

    const member = await t.run((ctx) => ctx.db.get(limited.readerMemberId));
    expect(member?.scopes).toEqual(['read']);
  });

  it('refuses an observer that tries to change the room', async () => {
    const { t, data, limited } = await fixture();

    session.user = {
      _id: limited.observerUserId,
      id: limited.observerUserId,
      activeOrganization: { id: data.organizationId, role: 'admin' },
    };

    const result = await code(
      t.mutation(api.rooms.update, {
        roomId: data.roomId,
        description: 'A description of an observer',
      })
    );

    expect(result).toBe('FORBIDDEN');
  });
});
