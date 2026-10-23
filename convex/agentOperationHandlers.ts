// Registry of the effects an agent operation may cause.
//
// Each handler receives the payload that was proposed (and, when the effect
// is sensitive, approved) and performs the real write through the existing
// internal mutations. The organization and the user always come from the
// session context, never from the payload, so a payload cannot widen the
// scope of the effect.

import { ConvexError } from 'convex/values';
import { DEAL_STAGES, isValidTransition } from '@crm/domain';
import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx, MutationCtx } from './_generated/server';
import { createInternalMutation } from './functions';

export type AgentOperationHandlerContext = {
  ctx: ActionCtx;
  organizationId: Id<'organization'>;
  userId: Id<'user'>;
  /**
   * The idempotency key of the operation. The key identifies the effect, so
   * an effect that already happened under that key is reused instead of
   * caused a second time.
   */
  operationKey: string;
  operationId: Id<'agentOperations'>;
  attempt: number;
};

export type AgentOperationHandler = (
  payload: Record<string, unknown>,
  context: AgentOperationHandlerContext
) => Promise<unknown>;

function badRequest(message: string): never {
  throw new ConvexError({ code: 'BAD_REQUEST', message });
}

/** Read a required string field of the payload. */
function requireString(
  payload: Record<string, unknown>,
  field: string
): string {
  const value = payload[field];
  if (typeof value !== 'string' || value.length === 0) {
    badRequest(`Payload field "${field}" must be a non-empty string`);
  }
  return value;
}

/** Read an optional string field of the payload. */
function optionalString(
  payload: Record<string, unknown>,
  field: string
): string | undefined {
  const value = payload[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    badRequest(`Payload field "${field}" must be a string`);
  }
  return value;
}

/** Read an optional number field of the payload. */
function optionalNumber(
  payload: Record<string, unknown>,
  field: string
): number | undefined {
  const value = payload[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    badRequest(`Payload field "${field}" must be a number`);
  }
  return value;
}

/** The activity kinds the activities table accepts. */
const ACTIVITY_TYPES = [
  'call',
  'email',
  'meeting',
  'note',
  'status_change',
] as const;

/** The entity kinds an activity may point at. */
const ACTIVITY_ENTITY_TYPES = [
  'company',
  'contact',
  'deal',
  'product',
  'saleOrder',
  'invoice',
  'purchaseOrder',
  'ticket',
  'expense',
  'employee',
  'task',
] as const;

const ENTITY_TABLES = {
  company: 'companies',
  contact: 'contacts',
  deal: 'deals',
  product: 'products',
  saleOrder: 'saleOrders',
  invoice: 'invoices',
  employee: 'employees',
} as const;

async function requireActiveClaim(
  ctx: MutationCtx,
  args: {
    operationId: Id<'agentOperations'>;
    organizationId: Id<'organization'>;
    operationKey: string;
    attempt: number;
  },
  kind: string
) {
  const operation = await ctx.db.get(args.operationId);
  if (
    !operation ||
    operation.organizationId !== args.organizationId ||
    operation.idempotencyKey !== args.operationKey ||
    operation.kind !== kind ||
    operation.status !== 'executing' ||
    operation.attempts !== args.attempt
  ) {
    throw new ConvexError({
      code: 'CONFLICT',
      message: 'The effect does not have a current execution claim',
    });
  }
}

/**
 * Create the activity of an operation, once.
 *
 * The lookup and the write happen in one transaction, so two executions of
 * the same key cannot both write: the second one finds the effect of the
 * first one and returns it.
 */
export const createActivityOnce = createInternalMutation()({
  args: {
    organizationId: zid('organization'),
    userId: zid('user'),
    operationKey: z.string().min(1).max(200),
    operationId: zid('agentOperations'),
    attempt: z.number().int().positive(),
    type: z.enum(ACTIVITY_TYPES),
    entityType: z.string(),
    entityId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    dueAt: z.number().optional(),
  },
  handler: async (ctx, args) => {
    await requireActiveClaim(ctx, args, 'create_activity');
    const existing = await ctx.db
      .query('agentOperationEffects')
      .withIndex('organizationId_operationKey', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('operationKey', args.operationKey)
      )
      .first();

    if (existing) {
      if (
        existing.operationId !== args.operationId ||
        existing.kind !== 'create_activity'
      ) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: 'This key belongs to another effect',
        });
      }
      return { effectId: existing.effectId, duplicate: true };
    }

    const table = ENTITY_TABLES[args.entityType as keyof typeof ENTITY_TABLES];
    const entityId = table ? ctx.db.normalizeId(table, args.entityId) : null;
    const entity = entityId ? await ctx.db.get(entityId) : null;
    if (!entity || entity.organizationId !== args.organizationId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The activity entity does not exist in this organization',
      });
    }
    const activityId = await ctx.db.insert('activities', {
      organizationId: args.organizationId,
      type: args.type,
      entityType: args.entityType,
      entityId: args.entityId,
      title: args.title,
      description: args.description,
      dueAt: args.dueAt,
      createdBy: args.userId,
      createdAt: Date.now(),
    } as any);

    await ctx.db.insert('agentOperationEffects', {
      organizationId: args.organizationId,
      operationKey: args.operationKey,
      operationId: args.operationId,
      kind: 'create_activity',
      effectId: activityId,
      createdAt: Date.now(),
    });

    return { effectId: activityId, duplicate: false };
  },
});

export const updateDealStageOnce = createInternalMutation()({
  args: {
    organizationId: zid('organization'),
    operationId: zid('agentOperations'),
    operationKey: z.string().min(1).max(200),
    attempt: z.number().int().positive(),
    id: zid('deals'),
    stage: z.enum(DEAL_STAGES),
    lostReason: z.string().optional(),
  },
  handler: async (ctx, args) => {
    await requireActiveClaim(ctx, args, 'update_deal_stage');
    const existing = await ctx.db
      .query('agentOperationEffects')
      .withIndex('organizationId_operationKey', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('operationKey', args.operationKey)
      )
      .first();
    if (existing) {
      if (
        existing.operationId !== args.operationId ||
        existing.kind !== 'update_deal_stage'
      ) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: 'This key belongs to another effect',
        });
      }
      return { effectId: existing.effectId, duplicate: true };
    }
    const deal = await ctx.db.get(args.id);
    if (
      !deal ||
      deal.organizationId !== args.organizationId ||
      deal.archivedAt !== undefined
    ) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The deal does not exist in this organization',
      });
    }
    if (!isValidTransition(deal.stage, args.stage)) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'Invalid deal stage transition',
      });
    }
    if (args.stage === 'lost' && !args.lostReason?.trim()) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'lostReason is required for a lost deal',
      });
    }
    const now = Date.now();
    await ctx.db.patch(deal._id, {
      stage: args.stage,
      stageEnteredAt: now,
      ...(args.stage === 'won' ? { wonAt: now, probability: 100 } : {}),
      ...(args.stage === 'lost'
        ? { lostAt: now, lostReason: args.lostReason }
        : {}),
      ...(args.stage === 'new' &&
      (deal.stage === 'won' || deal.stage === 'lost')
        ? { wonAt: undefined, lostAt: undefined, lostReason: undefined }
        : {}),
    });
    await ctx.db.insert('agentOperationEffects', {
      organizationId: args.organizationId,
      operationKey: args.operationKey,
      operationId: args.operationId,
      kind: 'update_deal_stage',
      effectId: deal._id,
      createdAt: now,
    });
    return { effectId: deal._id, duplicate: false };
  },
});

export const AGENT_OPERATION_HANDLERS: Record<string, AgentOperationHandler> = {
  create_activity: async (payload, context) => {
    const type = requireString(payload, 'type');
    const entityType = requireString(payload, 'entityType');
    const entityId = requireString(payload, 'entityId');
    const title = requireString(payload, 'title');
    const description = optionalString(payload, 'description');
    const dueAt = optionalNumber(payload, 'dueAt');

    if (!(ACTIVITY_TYPES as readonly string[]).includes(type)) {
      badRequest(
        `Payload field "type" must be one of ${ACTIVITY_TYPES.join(', ')}`
      );
    }
    if (!(ACTIVITY_ENTITY_TYPES as readonly string[]).includes(entityType)) {
      badRequest(
        `Payload field "entityType" must be one of ${ACTIVITY_ENTITY_TYPES.join(', ')}`
      );
    }

    const result = await context.ctx.runMutation(
      internal.agentOperationHandlers.createActivityOnce,
      {
        organizationId: context.organizationId,
        userId: context.userId,
        operationKey: context.operationKey,
        operationId: context.operationId,
        attempt: context.attempt,
        type: type as (typeof ACTIVITY_TYPES)[number],
        entityType,
        entityId,
        title,
        ...(description !== undefined ? { description } : {}),
        ...(dueAt !== undefined ? { dueAt } : {}),
      }
    );

    return result;
  },

  update_deal_stage: async (payload, context) => {
    const id = requireString(payload, 'id');
    const stage = requireString(payload, 'stage');
    const lostReason = optionalString(payload, 'lostReason');

    const updated = await context.ctx.runMutation(
      internal.agentOperationHandlers.updateDealStageOnce,
      {
        organizationId: context.organizationId,
        operationId: context.operationId,
        operationKey: context.operationKey,
        attempt: context.attempt,
        id: id as Id<'deals'>,
        stage: z.enum(DEAL_STAGES).parse(stage),
        ...(lostReason !== undefined ? { lostReason } : {}),
      }
    );

    if (!updated) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The deal does not exist in this organization',
      });
    }

    return updated;
  },
};

/** True when a kind has a handler in the registry. */
export function isSupportedKind(kind: string): boolean {
  return Object.prototype.hasOwnProperty.call(AGENT_OPERATION_HANDLERS, kind);
}
