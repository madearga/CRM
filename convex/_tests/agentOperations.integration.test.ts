/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import aggregateSchema from '../../node_modules/@convex-dev/aggregate/src/component/schema';
import {
  aggregateCompaniesByOrg,
  aggregateDealsByOrg,
  aggregateDealsByStage,
} from '../aggregates';
import { api, internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

// Only the external session transport is mocked. The real organization,
// permission, validation, transaction, and operation handlers run below.
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

const modules = import.meta.glob([
  '../**/*.{ts,js}',
  '!../__tests__/**',
  '!../convex/**',
]);

const aggregateModules = import.meta.glob([
  '../../node_modules/@convex-dev/aggregate/src/component/**/*.ts',
  '!../../node_modules/@convex-dev/aggregate/src/component/**/*.test.ts',
]);

async function fixture() {
  const t = convexTest(schema, modules);
  for (const name of [
    'aggregateActivitiesByOrg',
    'aggregateDealsByOrg',
    'aggregateDealsByStage',
    'aggregateCompaniesByOrg',
  ]) {
    t.registerComponent(name, aggregateSchema, aggregateModules);
  }
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert('organization', {
      name: 'Ruang test',
      slug: 'ruang-test',
      monthlyCredits: 0,
      createdAt: Date.now(),
    });
    const userId = await ctx.db.insert('user', {
      email: 'owner@example.test',
      name: 'Owner',
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
    return { organizationId, userId };
  });
  session.user = {
    _id: ids.userId,
    id: ids.userId,
    isAdmin: false,
    name: 'Owner',
    activeOrganization: {
      id: ids.organizationId,
      role: 'owner',
      name: 'Ruang test',
      slug: 'ruang-test',
    },
  };
  return { t, ...ids };
}

const proposal = {
  kind: 'create_activity',
  payload: {
    type: 'note',
    entityType: 'deal',
    entityId: 'test',
    title: 'Follow up',
  },
  idempotencyKey: 'proposal-1',
  requiresApproval: false,
};

async function approveAndClaim(
  f: Awaited<ReturnType<typeof fixture>>,
  args = proposal
) {
  const operation = await f.t.mutation(api.agentOperations.propose, {
    ...args,
    requiresApproval: true,
  });
  await f.t.mutation(api.agentOperations.decide, {
    operationId: operation.id,
    decision: 'approve',
  });
  const claim = await f.t.mutation(internal.agentOperations.claimOperation, {
    operationId: operation.id,
    organizationId: f.organizationId,
    userId: f.userId,
  });
  expect(claim.outcome).toBe('claimed');
  return {
    operationId: operation.id,
    attempt: claim.attempt,
    operationKey: args.idempotencyKey,
  };
}

async function proposeAndExecute(
  f: Awaited<ReturnType<typeof fixture>>,
  args: {
    kind: 'create_company' | 'create_deal';
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }
) {
  const operation = await f.t.mutation(api.agentOperations.propose, {
    ...args,
    requiresApproval: true,
  });
  await f.t.mutation(api.agentOperations.decide, {
    operationId: operation.id,
    decision: 'approve',
  });
  return f.t.action(api.agentOperations.execute, {
    operationId: operation.id,
  });
}

beforeEach(() => {
  session.user = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('real operation mutations with a mocked external session', () => {
  it('enforces approval even when a caller asks to skip it', async () => {
    const { t } = await fixture();
    const result = await t.mutation(api.agentOperations.propose, proposal);
    expect(result.status).toBe('awaiting_approval');
    const operation = await t.run((ctx) =>
      ctx.db.get(result.id as Id<'agentOperations'>)
    );
    expect(operation?.requiresApproval).toBe(true);
    expect(operation?.approvalId).toBeDefined();
  });

  it('rejects non-JSON payload values rather than approving marker-string collisions', async () => {
    const { t } = await fixture();
    await expect(
      t.mutation(api.agentOperations.propose, {
        ...proposal,
        payload: { ...proposal.payload, amount: 123n },
      })
    ).rejects.toThrow();
  });

  it('does not allow a public caller to impersonate an agent', async () => {
    const { t } = await fixture();
    await expect(
      t.mutation(api.agentOperations.propose, {
        ...proposal,
        agentId: 'another-agent',
        agentLabel: 'Trusted agent',
      })
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query('agentOperations').collect())
    ).toHaveLength(0);
  });

  it('refuses unsupported effect kinds before inserting a ledger row', async () => {
    const { t } = await fixture();
    await expect(
      t.mutation(api.agentOperations.propose, {
        ...proposal,
        kind: 'send_money',
      })
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query('agentOperations').collect())
    ).toHaveLength(0);
  });

  it('refuses a proposal into a private room without membership', async () => {
    const { t, organizationId, userId } = await fixture();
    const roomId = await t.run((ctx) =>
      ctx.db.insert('rooms', {
        organizationId,
        name: 'Private',
        slug: 'private',
        kind: 'general',
        visibility: 'private',
        createdByUserId: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    await expect(
      t.mutation(api.agentOperations.propose, { ...proposal, roomId })
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query('agentOperations').collect())
    ).toHaveLength(0);
  });

  it('does not reuse a key for a different operation kind', async () => {
    const { t } = await fixture();
    await t.mutation(api.agentOperations.propose, proposal);
    await expect(
      t.mutation(api.agentOperations.propose, {
        ...proposal,
        kind: 'update_deal_stage',
      })
    ).rejects.toThrow();
  });

  it('refuses an expired approval decision', async () => {
    const { t } = await fixture();
    const result = await t.mutation(api.agentOperations.propose, {
      ...proposal,
      requiresApproval: true,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(result.id, { expiresAt: Date.now() - 1 });
      await ctx.db.patch(result.approvalId!, { expiresAt: Date.now() - 1 });
    });
    await expect(
      t.mutation(api.agentOperations.decide, {
        operationId: result.id,
        decision: 'approve',
      })
    ).rejects.toThrow(/expired/i);
  });

  it('keeps an expired proposal visible and allows the human to reject it', async () => {
    const { t } = await fixture();
    const result = await t.mutation(api.agentOperations.propose, {
      ...proposal,
      requiresApproval: true,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(result.id, { expiresAt: Date.now() - 1 });
      await ctx.db.patch(result.approvalId!, { expiresAt: Date.now() - 1 });
    });
    expect(
      await t.query(api.agentOperations.listPendingApprovals, {})
    ).toHaveLength(1);
    expect(
      await t.mutation(api.agentOperations.decide, {
        operationId: result.id,
        decision: 'reject',
      })
    ).toMatchObject({ status: 'rejected', approvalStatus: 'rejected' });
  });

  it('records a definitely refused effect as failed, not unknown', async () => {
    const f = await fixture();
    const operation = await f.t.mutation(api.agentOperations.propose, {
      ...proposal,
      requiresApproval: true,
    });
    await f.t.mutation(api.agentOperations.decide, {
      operationId: operation.id,
      decision: 'approve',
    });
    const execution = await f.t.action(api.agentOperations.execute, {
      operationId: operation.id,
    });
    expect(execution.status).toBe('failed');
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperationEffects').collect())
    ).toHaveLength(0);
  });

  it('checks the approval revision before claiming an operation', async () => {
    const { t, organizationId, userId } = await fixture();
    const result = await t.mutation(api.agentOperations.propose, {
      ...proposal,
      requiresApproval: true,
    });
    await t.mutation(api.agentOperations.decide, {
      operationId: result.id,
      decision: 'approve',
    });
    await t.run((ctx) => ctx.db.patch(result.id, { revision: 2 }));
    await expect(
      t.mutation(internal.agentOperations.claimOperation, {
        operationId: result.id,
        organizationId,
        userId,
      })
    ).rejects.toThrow();
  });

  it('enforces operation expiry even when approval has no expiry', async () => {
    const { t, organizationId, userId } = await fixture();
    const result = await t.mutation(api.agentOperations.propose, {
      ...proposal,
      requiresApproval: true,
    });
    await t.mutation(api.agentOperations.decide, {
      operationId: result.id,
      decision: 'approve',
    });
    await t.run((ctx) =>
      ctx.db.patch(result.id, { expiresAt: Date.now() - 1 })
    );
    await expect(
      t.mutation(internal.agentOperations.claimOperation, {
        operationId: result.id,
        organizationId,
        userId,
      })
    ).rejects.toThrow(/expired/i);
  });

  it('does not claim after the operator loses organization membership', async () => {
    const { t, organizationId, userId } = await fixture();
    const result = await t.mutation(api.agentOperations.propose, {
      ...proposal,
      requiresApproval: true,
    });
    await t.mutation(api.agentOperations.decide, {
      operationId: result.id,
      decision: 'approve',
    });
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('member')
        .withIndex('organizationId_userId', (q) =>
          q.eq('organizationId', organizationId).eq('userId', userId)
        )
        .unique();
      await ctx.db.delete(member!._id);
    });
    await expect(
      t.mutation(internal.agentOperations.claimOperation, {
        operationId: result.id,
        organizationId,
        userId,
      })
    ).rejects.toThrow();
  });

  it('preserves unknown when the first executor completes after a timeout', async () => {
    const f = await fixture();
    const claim = await approveAndClaim(f);
    await f.t.run((ctx) =>
      ctx.db.patch(claim.operationId, { startedAt: Date.now() - 601_000 })
    );
    const timeout = await f.t.mutation(
      internal.agentOperations.claimOperation,
      {
        operationId: claim.operationId,
        organizationId: f.organizationId,
        userId: f.userId,
      }
    );
    expect(timeout.outcome).toBe('timed_out');
    const completion = await f.t.mutation(
      internal.agentOperations.completeOperation,
      {
        operationId: claim.operationId,
        attempt: claim.attempt,
        resultJson: '{"late":true}',
      }
    );
    expect(completion).toEqual({ status: 'unknown', recorded: false });
  });

  it('fences a late completion after a person retries and obtains a new claim', async () => {
    const f = await fixture();
    const first = await approveAndClaim(f);
    await f.t.run((ctx) =>
      ctx.db.patch(first.operationId, { status: 'unknown' })
    );
    await f.t.mutation(api.agentOperations.reconcile, {
      operationId: first.operationId,
      resolution: 'retry',
    });
    const second = await f.t.mutation(internal.agentOperations.claimOperation, {
      operationId: first.operationId,
      organizationId: f.organizationId,
      userId: f.userId,
    });
    expect(second.attempt).toBe(first.attempt + 1);
    expect(
      await f.t.mutation(internal.agentOperations.completeOperation, {
        operationId: first.operationId,
        attempt: first.attempt,
        resultJson: 'null',
      })
    ).toEqual({ status: 'executing', recorded: false });
  });

  it('fences a late effect rather than writing from an obsolete claim', async () => {
    const f = await fixture();
    const first = await approveAndClaim(f);
    await f.t.run((ctx) =>
      ctx.db.patch(first.operationId, { status: 'unknown' })
    );
    await expect(
      f.t.mutation(internal.agentOperationHandlers.createActivityOnce, {
        ...first,
        organizationId: f.organizationId,
        userId: f.userId,
        type: 'note',
        entityType: 'deal',
        entityId: 'test',
        title: 'Late write',
      })
    ).rejects.toThrow(/claim/i);
    expect(
      await f.t.run((ctx) => ctx.db.query('activities').collect())
    ).toHaveLength(0);
  });

  it('records one real activity and reuses it after a duplicate delivery', async () => {
    const f = await fixture();
    const dealId = await f.t.run((ctx) =>
      ctx.db.insert('deals', {
        organizationId: f.organizationId,
        ownerId: f.userId,
        title: 'Test deal',
        stage: 'new',
      })
    );
    const claim = await approveAndClaim(f, {
      ...proposal,
      payload: { ...proposal.payload, entityId: dealId },
    });
    const effectArgs = {
      ...claim,
      organizationId: f.organizationId,
      userId: f.userId,
      type: 'note' as const,
      entityType: 'deal',
      entityId: dealId,
      title: 'Follow up',
    };
    const first = await f.t.mutation(
      internal.agentOperationHandlers.createActivityOnce,
      effectArgs
    );
    const second = await f.t.mutation(
      internal.agentOperationHandlers.createActivityOnce,
      effectArgs
    );
    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ effectId: first.effectId, duplicate: true });
    expect(
      await f.t.run((ctx) => ctx.db.query('activities').collect())
    ).toHaveLength(1);
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperationEffects').collect())
    ).toHaveLength(1);
    const failure = await f.t.mutation(internal.agentOperations.failOperation, {
      operationId: claim.operationId,
      attempt: claim.attempt,
      errorMessage: 'Response lost after the effect committed',
    });
    expect(failure.status).toBe('unknown');
  });

  it('does not reset a deal stage when a committed effect is delivered again', async () => {
    const f = await fixture();
    const dealId = await f.t.run((ctx) =>
      ctx.db.insert('deals', {
        organizationId: f.organizationId,
        ownerId: f.userId,
        title: 'Test deal',
        stage: 'new',
      })
    );
    await f.t.run(async (ctx) => {
      const deal = await ctx.db.get(dealId);
      await aggregateDealsByOrg.insert(ctx, deal!);
      await aggregateDealsByStage.insert(ctx, deal!);
    });
    const claim = await approveAndClaim(f, {
      ...proposal,
      kind: 'update_deal_stage',
      payload: {
        id: dealId,
        stage: 'contacted',
      } as unknown as typeof proposal.payload,
    });
    const effectArgs = {
      ...claim,
      organizationId: f.organizationId,
      id: dealId,
      stage: 'contacted' as const,
    };
    await f.t.mutation(
      internal.agentOperationHandlers.updateDealStageOnce,
      effectArgs
    );
    await f.t.mutation(api.deals.updateStage, {
      id: dealId,
      stage: 'proposal',
    });
    expect(
      (
        await f.t.mutation(
          internal.agentOperationHandlers.updateDealStageOnce,
          effectArgs
        )
      ).duplicate
    ).toBe(true);
    expect((await f.t.run((ctx) => ctx.db.get(dealId)))?.stage).toBe(
      'proposal'
    );
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperationEffects').collect())
    ).toHaveLength(1);
  });

  it('creates one company with the owner and tenant of the context', async () => {
    const f = await fixture();
    const args = {
      kind: 'create_company' as const,
      payload: { name: 'Acme', size: '11-50', tags: ['vip'] },
      idempotencyKey: 'company-1',
    };
    const execution = await proposeAndExecute(f, args);
    expect(execution.status).toBe('succeeded');

    // A second delivery of the same operation returns the effect it made.
    const again = await f.t.action(api.agentOperations.execute, {
      operationId: (
        await f.t.query(api.agentOperations.list, { kind: 'create_company' })
      )[0].id,
    });
    expect(again.duplicate).toBe(true);

    const companies = await f.t.run((ctx) => ctx.db.query('companies').collect());
    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({
      name: 'Acme',
      size: '11-50',
      tags: ['vip'],
      organizationId: f.organizationId,
      ownerId: f.userId,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query('agentOperationEffects').collect())
    ).toHaveLength(1);
  });

  it('refuses a second company with the same name', async () => {
    const f = await fixture();
    await proposeAndExecute(f, {
      kind: 'create_company',
      payload: { name: 'Acme' },
      idempotencyKey: 'company-a',
    });
    const execution = await proposeAndExecute(f, {
      kind: 'create_company',
      payload: { name: 'Acme' },
      idempotencyKey: 'company-b',
    });
    expect(execution.status).toBe('failed');
    expect(execution.error).toMatch(/already exists/i);
    expect(
      await f.t.run((ctx) => ctx.db.query('companies').collect())
    ).toHaveLength(1);
  });

  it('creates a deal in the organization currency with the context owner', async () => {
    const f = await fixture();
    const execution = await proposeAndExecute(f, {
      kind: 'create_deal',
      payload: { title: 'Big deal', value: 500, currency: 'idr' },
      idempotencyKey: 'deal-1',
    });
    expect(execution.status).toBe('succeeded');

    const deals = await f.t.run((ctx) => ctx.db.query('deals').collect());
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      title: 'Big deal',
      value: 500,
      currency: 'IDR',
      stage: 'new',
      organizationId: f.organizationId,
      ownerId: f.userId,
    });
  });

  it('refuses a deal whose company or currency is outside the organization', async () => {
    const f = await fixture();
    const otherOrganizationId = await f.t.run((ctx) =>
      ctx.db.insert('organization', {
        name: 'Other',
        slug: 'other',
        monthlyCredits: 0,
        createdAt: Date.now(),
      })
    );
    const foreignCompanyId = await f.t.run((ctx) =>
      ctx.db.insert('companies', {
        name: 'Foreign',
        organizationId: otherOrganizationId,
        ownerId: f.userId,
      })
    );

    const foreign = await proposeAndExecute(f, {
      kind: 'create_deal',
      payload: { title: 'Foreign deal', companyId: foreignCompanyId },
      idempotencyKey: 'deal-foreign',
    });
    expect(foreign.status).toBe('failed');
    expect(foreign.error).toMatch(/company does not exist/i);

    const currency = await proposeAndExecute(f, {
      kind: 'create_deal',
      payload: { title: 'Euro deal', currency: 'EUR' },
      idempotencyKey: 'deal-eur',
    });
    expect(currency.status).toBe('failed');
    expect(currency.error).toMatch(/currency/i);

    expect(
      await f.t.run((ctx) => ctx.db.query('deals').collect())
    ).toHaveLength(0);
  });

  it('refuses a deal payload field outside the allowlist', async () => {
    const f = await fixture();
    const execution = await proposeAndExecute(f, {
      kind: 'create_deal',
      payload: { title: 'Won deal', stage: 'won', ownerId: f.userId },
      idempotencyKey: 'deal-extra',
    });
    expect(execution.status).toBe('failed');
    expect(execution.error).toMatch(/not allowed/i);
    expect(
      await f.t.run((ctx) => ctx.db.query('deals').collect())
    ).toHaveLength(0);
  });

  it('requires companies create for create_company and deals create for create_deal', async () => {
    const f = await fixture();
    const memberUserId = await f.t.run(async (ctx) => {
      const memberUserId = await ctx.db.insert('user', {
        email: 'member@example.test',
        name: 'Member',
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const templateId = await ctx.db.insert('permissionTemplates', {
        name: 'Deals only',
        isDefault: false,
        organizationId: f.organizationId,
        ownerId: f.userId,
      });
      for (const [feature, action] of [
        ['agents', 'view'],
        ['agents', 'create'],
        ['deals', 'create'],
      ] as const) {
        await ctx.db.insert('permissionEntries', {
          feature,
          action,
          allowed: true,
          organizationId: f.organizationId,
          templateId,
        });
      }
      await ctx.db.insert('member', {
        organizationId: f.organizationId,
        userId: memberUserId,
        role: 'member',
        permissionTemplateId: templateId,
        createdAt: Date.now(),
      });
      return memberUserId;
    });

    session.user = {
      _id: memberUserId,
      id: memberUserId,
      isAdmin: false,
      name: 'Member',
      activeOrganization: {
        id: f.organizationId,
        role: 'member',
        name: 'Ruang test',
        slug: 'ruang-test',
      },
    };

    await expect(
      f.t.mutation(api.agentOperations.propose, {
        kind: 'create_company',
        payload: { name: 'Acme' },
        idempotencyKey: 'member-company',
      })
    ).rejects.toThrow(/permission/i);

    const deal = await f.t.mutation(api.agentOperations.propose, {
      kind: 'create_deal',
      payload: { title: 'Member deal' },
      idempotencyKey: 'member-deal',
    });
    expect(deal.status).toBe('awaiting_approval');
  });
});
