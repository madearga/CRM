// The room test data, built on the real Convex schema.
//
// The tests use the same seam as the other integration tests: convex-test
// with the schema of the app and the real modules. No production test seam
// is used and the schema is not cloned.
import { expect } from 'vitest';
import { convexTest } from 'convex-test';

import schema from '../schema';
import type { Id } from '../_generated/dataModel';

/** The glob of the modules, with the typing that vite gives it. */
type ImportMetaWithGlob = ImportMeta & {
  glob(pattern: string[]): Record<string, () => Promise<unknown>>;
};

const modules = (import.meta as ImportMetaWithGlob).glob([
  '../**/*.{ts,js}',
  '!../__tests__/**',
  '!../convex/**',
]);

/** A fresh test database with the real schema. */
export function createTest() {
  return convexTest(schema, modules);
}

export type TestApp = ReturnType<typeof createTest>;

export type SeedOptions = {
  visibility?: 'open' | 'private';
  archived?: boolean;
  userMember?: boolean;
  memberRole?: 'owner' | 'member' | 'observer';
  memberScopes?: string[];
  agentStatus?: 'active' | 'disabled';
  agentScopes?: string[];
  agentMember?: boolean;
  agentMemberScopes?: string[];
  agentMemberRole?: 'owner' | 'member' | 'observer';
};

export type Seed = {
  organizationId: Id<'organization'>;
  otherOrganizationId: Id<'organization'>;
  memberUserId: Id<'user'>;
  foreignUserId: Id<'user'>;
  roomId: Id<'rooms'>;
  agentKey: string;
};

/**
 * The data of a room: one organization, one room, one person of that
 * organization, one person of another organization and one agent.
 */
export async function seed(
  t: TestApp,
  options: SeedOptions = {}
): Promise<Seed> {
  const {
    visibility = 'open',
    archived = false,
    userMember = true,
    memberRole = 'member',
    memberScopes = [],
    agentStatus = 'active',
    agentScopes = [],
    agentMember = true,
    agentMemberScopes = [],
    agentMemberRole = 'member',
  } = options;

  return t.run(async (ctx) => {
    const now = Date.now();

    const organizationId = await ctx.db.insert('organization', {
      slug: 'org-a',
      name: 'Organization A',
      monthlyCredits: 0,
      createdAt: now,
    });
    const otherOrganizationId = await ctx.db.insert('organization', {
      slug: 'org-b',
      name: 'Organization B',
      monthlyCredits: 0,
      createdAt: now,
    });

    const memberUserId = await ctx.db.insert('user', {
      name: 'Member',
      email: 'member@example.com',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    const foreignUserId = await ctx.db.insert('user', {
      name: 'Foreign',
      email: 'foreign@example.com',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert('member', {
      organizationId,
      userId: memberUserId,
      role: 'owner',
      createdAt: now,
    });
    await ctx.db.insert('member', {
      organizationId: otherOrganizationId,
      userId: foreignUserId,
      role: 'owner',
      createdAt: now,
    });

    const roomId = await ctx.db.insert('rooms', {
      organizationId,
      name: 'Room',
      slug: 'room',
      kind: 'project',
      visibility,
      createdByUserId: memberUserId,
      createdAt: now,
      updatedAt: now,
      ...(archived ? { archivedAt: now } : {}),
    });

    if (userMember) {
      await ctx.db.insert('roomMembers', {
        organizationId,
        roomId,
        memberType: 'user',
        userId: memberUserId,
        displayName: 'Member',
        role: memberRole,
        scopes: memberScopes,
        joinedAt: now,
      });
    }

    const agentKey = 'agent-a';
    await ctx.db.insert('agents', {
      organizationId,
      agentId: agentKey,
      name: 'Agent A',
      status: agentStatus,
      scopes: agentScopes,
      createdByUserId: memberUserId,
      createdAt: now,
      updatedAt: now,
    });

    if (agentMember) {
      await ctx.db.insert('roomMembers', {
        organizationId,
        roomId,
        memberType: 'agent',
        agentId: agentKey,
        displayName: 'Agent A',
        role: agentMemberRole,
        scopes: agentMemberScopes,
        joinedAt: now,
      });
    }

    return {
      organizationId,
      otherOrganizationId,
      memberUserId,
      foreignUserId,
      roomId,
      agentKey,
    };
  });
}

/** An operation of the room, for the system messages of the ledger. */
export async function seedOperation(
  t: TestApp,
  data: {
    organizationId: Id<'organization'>;
    roomId: Id<'rooms'>;
    requestedByUserId: Id<'user'>;
    agentId?: string;
  }
): Promise<Id<'agentOperations'>> {
  return t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert('agentOperations', {
      organizationId: data.organizationId,
      kind: 'create_activity',
      status: 'pending',
      requiresApproval: false,
      idempotencyKey: `op-${now}`,
      payloadHash: 'fnv1a:00000000',
      payloadJson: '{}',
      revision: 1,
      agentId: data.agentId,
      roomId: data.roomId,
      requestedByUserId: data.requestedByUserId,
      attempts: 0,
      expiresAt: now + 60_000,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/** The error of a refused call. */
export async function refusal(promise: Promise<unknown>): Promise<any> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error, 'the call must be refused').toBeTruthy();
  return error;
}
