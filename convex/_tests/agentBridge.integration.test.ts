/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';

import schema from '../schema';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

// Only the external session transport is mocked. The real room rules, the
// real operation rules and the real transaction run below.
vi.mock('../auth', () => ({
  authClient: { getHeaders: async () => new Headers() },
  getAuth: () => ({ api: {} }),
}));
vi.mock('../authHelpers', () => ({
  getSessionUser: async () => null,
  getSessionUserWriter: async () => null,
}));

const modules = import.meta.glob([
  '../**/*.{ts,js}',
  '!../__tests__/**',
  '!../convex/**',
]);

async function fixture(options: {
  agentStatus?: string;
  agentScopes?: string[];
  memberScopes?: string[];
  memberRole?: string;
  roomVisibility?: string;
  withMembership?: boolean;
} = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert('organization', {
      name: 'Ruang bridge test',
      slug: 'ruang-bridge-test',
      monthlyCredits: 0,
      createdAt: Date.now(),
    });
    const userId = await ctx.db.insert('user', {
      email: 'creator@example.test',
      name: 'Creator',
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert('member', {
      organizationId,
      userId,
      role: 'owner',
      createdAt: Date.now(),
    });
    const roomId = await ctx.db.insert('rooms', {
      organizationId,
      name: 'Bridge room',
      slug: 'bridge-room',
      kind: 'general',
      visibility: options.roomVisibility ?? 'open',
      createdByUserId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const agentId = 'bridge-agent';
    await ctx.db.insert('agents', {
      organizationId,
      agentId,
      name: 'Bridge agent',
      status: options.agentStatus ?? 'active',
      scopes: options.agentScopes ?? ['write'],
      createdByUserId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (options.withMembership !== false) {
      await ctx.db.insert('roomMembers', {
        organizationId,
        roomId,
        memberType: 'agent',
        agentId,
        displayName: 'Bridge agent',
        role: options.memberRole ?? 'member',
        scopes: options.memberScopes ?? [],
        joinedAt: Date.now(),
      });
    }
    return { organizationId, userId, roomId, agentId };
  });
  return { t, ...ids };
}

const payload = {
  type: 'note',
  entityType: 'deal',
  entityId: 'deal-1',
  title: 'Follow up',
};

describe('a proposal of an agent service', () => {
  it('creates an operation and a pending approval for an active member', async () => {
    const f = await fixture();
    const result = await f.t.mutation(
      internal.agentOperations.proposeFromService,
      {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
        summary: 'Follow up with the client',
      }
    );

    expect(result.duplicate).toBe(false);
    expect(result.status).toBe('awaiting_approval');

    const operation = await f.t.run((ctx) =>
      ctx.db.get(result.id as Id<'agentOperations'>)
    );
    expect(operation?.requiresApproval).toBe(true);
    expect(operation?.agentId).toBe(f.agentId);
    expect(operation?.agentLabel).toBe('Bridge agent');
    expect(operation?.roomId).toBe(f.roomId);
    // The approval belongs to the person that created the room, because a
    // service has no person of its own.
    expect(operation?.requestedByUserId).toBe(f.userId);
    expect(operation?.idempotencyKey).toContain('svc:bridge-agent:');

    const approval = await f.t.run((ctx) =>
      ctx.db.get(operation!.approvalId as Id<'approvals'>)
    );
    expect(approval?.status).toBe('pending');
    expect(approval?.payloadHash).toBe(operation?.payloadHash);

    const messages = await f.t.run((ctx) =>
      ctx.db.query('roomMessages').collect()
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].kind).toBe('proposal');
    expect(messages[0].authorAgentId).toBe(f.agentId);
    expect(messages[0].operationId).toBe(result.id);
  });

  it('refuses a disabled agent', async () => {
    const f = await fixture({ agentStatus: 'disabled' });
    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
      })
    ).rejects.toThrow(/disabled/i);
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperations').collect())
    ).toHaveLength(0);
  });

  it('refuses an agent that is not a member of a private room', async () => {
    const f = await fixture({
      roomVisibility: 'private',
      withMembership: false,
    });
    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
      })
    ).rejects.toThrow(/member/i);
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperations').collect())
    ).toHaveLength(0);
  });

  it('refuses an agent whose scopes do not allow a write', async () => {
    const f = await fixture({ agentScopes: ['read'] });
    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
      })
    ).rejects.toThrow(/write/i);
  });

  it('refuses an agent of another organization', async () => {
    const f = await fixture();
    const other = await f.t.run(async (ctx) => {
      const organizationId = await ctx.db.insert('organization', {
        name: 'Other',
        slug: 'other',
        monthlyCredits: 0,
        createdAt: Date.now(),
      });
      await ctx.db.insert('rooms', {
        organizationId,
        name: 'Other room',
        slug: 'other-room',
        kind: 'general',
        visibility: 'open',
        createdByUserId: f.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return organizationId;
    });
    const otherRoom = await f.t.run(async (ctx) =>
      ctx.db
        .query('rooms')
        .withIndex('organizationId_slug', (q) =>
          q.eq('organizationId', other).eq('slug', 'other-room')
        )
        .first()
    );

    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: otherRoom!._id,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
      })
    ).rejects.toThrow();
  });

  it('returns the same operation when the same proposal arrives again', async () => {
    const f = await fixture();
    const first = await f.t.mutation(
      internal.agentOperations.proposeFromService,
      {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
      }
    );
    const second = await f.t.mutation(
      internal.agentOperations.proposeFromService,
      {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
      }
    );

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperations').collect())
    ).toHaveLength(1);
    expect(
      await f.t.run((ctx) => ctx.db.query('approvals').collect())
    ).toHaveLength(1);
    expect(
      await f.t.run((ctx) => ctx.db.query('roomMessages').collect())
    ).toHaveLength(1);
  });

  it('attributes the operation to the person who asked, not the room creator', async () => {
    const f = await fixture();
    const requesterId = await f.t.run(async (ctx) => {
      const id = await ctx.db.insert('user', {
        email: 'asker@example.com',
        name: 'Asker',
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert('member', {
        organizationId: f.organizationId,
        userId: id,
        role: 'owner',
        createdAt: Date.now(),
      });
      return id;
    });

    const result = await f.t.mutation(
      internal.agentOperations.proposeFromService,
      {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: requesterId,
        operationKind: 'create_activity',
        payload,
        summary: 'Ask on behalf of another person',
      }
    );

    const operation = await f.t.run((ctx) =>
      ctx.db.get(result.id as Id<'agentOperations'>)
    );
    expect(operation?.requestedByUserId).toBe(requesterId);
    expect(operation?.requestedByUserId).not.toBe(f.userId);

    const approval = await f.t.run((ctx) =>
      ctx.db.get(result.approvalId as Id<'approvals'>)
    );
    expect(approval?.requestedByUserId).toBe(requesterId);
  });

  it('refuses a requester who is not a member of the organization', async () => {
    const f = await fixture();
    const strangerId = await f.t.run((ctx) =>
      ctx.db.insert('user', {
        email: 'stranger@example.com',
        name: 'Stranger',
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );

    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: strangerId,
        operationKind: 'create_activity',
        payload,
      })
    ).rejects.toThrow(/not a member/i);
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperations').collect())
    ).toHaveLength(0);
  });

  it('refuses a requester who may not cause the effect', async () => {
    const f = await fixture();
    const viewerId = await f.t.run(async (ctx) => {
      const id = await ctx.db.insert('user', {
        email: 'viewer@example.com',
        name: 'Viewer',
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert('member', {
        organizationId: f.organizationId,
        userId: id,
        role: 'member',
        createdAt: Date.now(),
      });
      return id;
    });

    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: viewerId,
        operationKind: 'create_activity',
        payload,
      })
    ).rejects.toThrow(/may not cause this effect/i);
  });

  it('refuses a different proposal under the same key', async () => {
    const f = await fixture();
    await f.t.mutation(internal.agentOperations.proposeFromService, {
      organizationId: f.organizationId,
      roomId: f.roomId,
      agentId: f.agentId,
        requestingUserId: f.userId,
      operationKind: 'create_activity',
      payload,
    });

    // The same payload under another kind keeps the same key, so the ledger
    // must refuse it.
    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'update_deal_stage',
        payload,
      })
    ).rejects.toThrow(/idempotency key/i);
  });

  it('refuses a forged row that carries another payload under the same key', async () => {
    const f = await fixture();
    await f.t.mutation(internal.agentOperations.proposeFromService, {
      organizationId: f.organizationId,
      roomId: f.roomId,
      agentId: f.agentId,
        requestingUserId: f.userId,
      operationKind: 'create_activity',
      payload,
    });

    const existing = await f.t.run(async (ctx) => {
      const operations = await ctx.db.query('agentOperations').collect();
      return operations[0];
    });

    // A row with the key of the proposal, but with another payload, must
    // stop the new proposal.
    await f.t.run(async (ctx) => {
      const operation = await ctx.db
        .query('agentOperations')
        .withIndex('organizationId_idempotencyKey', (q) =>
          q
            .eq('organizationId', f.organizationId)
            .eq('idempotencyKey', existing!.idempotencyKey)
        )
        .first();
      await ctx.db.patch(operation!._id, {
        payloadJson: JSON.stringify({ title: 'Something else' }),
      });
    });

    await expect(
      f.t.mutation(internal.agentOperations.proposeFromService, {
        organizationId: f.organizationId,
        roomId: f.roomId,
        agentId: f.agentId,
        requestingUserId: f.userId,
        operationKind: 'create_activity',
        payload,
      })
    ).rejects.toThrow(/idempotency key/i);
  });
});

describe('the replay guard of the bridge', () => {
  it('refuses the same nonce twice', async () => {
    const f = await fixture();
    const nonce = 'nonce-0000-1111-2222';

    await f.t.mutation(internal.agentBridgeNonces.claim, { nonce });
    await expect(
      f.t.mutation(internal.agentBridgeNonces.claim, { nonce })
    ).rejects.toThrow(/already delivered/i);

    const rows = await f.t.run((ctx) =>
      ctx.db.query('agentBridgeNonces').collect()
    );
    expect(rows).toHaveLength(1);
  });

  it('accepts a different nonce', async () => {
    const f = await fixture();
    await f.t.mutation(internal.agentBridgeNonces.claim, { nonce: 'nonce-aaaa-0001' });
    await expect(
      f.t.mutation(internal.agentBridgeNonces.claim, { nonce: 'nonce-aaaa-0002' })
    ).resolves.toEqual({ claimed: true });
  });

  it('forgets a nonce that is older than the window', async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.insert('agentBridgeNonces', {
        nonce: 'nonce-old-0001',
        createdAt: Date.now() - 60 * 60 * 1000,
      })
    );

    // A fresh claim prunes the stale row, so the table stays small.
    await f.t.mutation(internal.agentBridgeNonces.claim, { nonce: 'nonce-new-0001' });
    const rows = await f.t.run((ctx) =>
      ctx.db.query('agentBridgeNonces').collect()
    );
    expect(rows.map((row) => row.nonce)).toEqual(['nonce-new-0001']);
  });
});
