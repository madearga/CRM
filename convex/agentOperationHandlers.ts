// Registry of the effects an agent operation may cause.
//
// Each handler receives the payload that was proposed (and, when the effect
// is sensitive, approved) and performs the real write through the existing
// internal mutations. The organization and the user always come from the
// session context, never from the payload, so a payload cannot widen the
// scope of the effect.

import { ConvexError } from 'convex/values';
import {
  CREATE_COMPANY_PAYLOAD_FIELDS,
  CREATE_DEAL_PAYLOAD_FIELDS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEAL_STAGES,
  isValidTransition,
  unexpectedPayloadFields,
} from '@crm/domain';
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

/** Read an optional string array field of the payload. */
function optionalStringArray(
  payload: Record<string, unknown>,
  field: string
): string[] | undefined {
  const value = payload[field];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    badRequest(`Payload field "${field}" must be an array of strings`);
  }
  return value as string[];
}

/** Read an optional field that must be one of a fixed set of values. */
function optionalEnum<T extends readonly string[]>(
  payload: Record<string, unknown>,
  field: string,
  allowed: T
): T[number] | undefined {
  const value = optionalString(payload, field);
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    badRequest(`Payload field "${field}" must be one of ${allowed.join(', ')}`);
  }
  return value as T[number];
}

/** Refuse a payload field that the kind does not accept. */
function requireAllowedFields(
  payload: Record<string, unknown>,
  allowed: readonly string[],
  kind: string
) {
  const [field] = unexpectedPayloadFields(payload, allowed);
  if (field !== undefined) {
    badRequest(`Payload field "${field}" is not allowed for ${kind}`);
  }
}

/** The company fields whose values are fixed sets. */
const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
] as const;
const COMPANY_SOURCES = [
  'referral',
  'website',
  'linkedin',
  'cold',
  'event',
  'other',
] as const;
const COMPANY_STATUSES = ['active', 'inactive', 'prospect'] as const;

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
 * Claim check and effect lookup, shared by every effect mutation.
 *
 * Returns the effect of an earlier execution of the same key, or null when the
 * effect must still be caused. A key that belongs to another effect conflicts,
 * so a key always names one effect.
 */
async function previousEffect(
  ctx: MutationCtx,
  args: {
    organizationId: Id<'organization'>;
    operationId: Id<'agentOperations'>;
    operationKey: string;
    attempt: number;
  },
  kind: string
): Promise<{ effectId: string; duplicate: true } | null> {
  await requireActiveClaim(ctx, args, kind);
  const existing = await ctx.db
    .query('agentOperationEffects')
    .withIndex('organizationId_operationKey', (q) =>
      q
        .eq('organizationId', args.organizationId)
        .eq('operationKey', args.operationKey)
    )
    .first();

  if (!existing) return null;
  if (existing.operationId !== args.operationId || existing.kind !== kind) {
    throw new ConvexError({
      code: 'CONFLICT',
      message: 'This key belongs to another effect',
    });
  }
  return { effectId: existing.effectId, duplicate: true };
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
    const previous = await previousEffect(ctx, args, 'create_activity');
    if (previous) return previous;

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
    const previous = await previousEffect(ctx, args, 'update_deal_stage');
    if (previous) return previous;

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

/**
 * Create a company, once. The organization and the owner always come from the
 * operation context, so a payload cannot place the company in another
 * organization or give it to another owner.
 */
export const createCompanyOnce = createInternalMutation()({
  args: {
    organizationId: zid('organization'),
    userId: zid('user'),
    operationId: zid('agentOperations'),
    operationKey: z.string().min(1).max(200),
    attempt: z.number().int().positive(),
    name: z.string().min(1).max(200),
    website: z.string().optional(),
    industry: z.string().optional(),
    size: z.enum(COMPANY_SIZES).optional(),
    address: z.string().optional(),
    country: z.string().optional(),
    source: z.enum(COMPANY_SOURCES).optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(COMPANY_STATUSES).optional(),
    notes: z.string().optional(),
  },
  handler: async (ctx, args) => {
    const previous = await previousEffect(ctx, args, 'create_company');
    if (previous) return previous;

    const existing = await ctx.db
      .query('companies')
      .withIndex('organizationId_name', (q) =>
        q.eq('organizationId', args.organizationId).eq('name', args.name)
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `A company named "${args.name}" already exists in this organization`,
      });
    }

    const companyId = await ctx.db.insert('companies', {
      organizationId: args.organizationId,
      ownerId: args.userId,
      name: args.name,
      website: args.website,
      industry: args.industry,
      size: args.size,
      address: args.address,
      country: args.country,
      source: args.source,
      tags: args.tags,
      status: args.status,
      notes: args.notes,
    } as any);

    await ctx.db.insert('agentOperationEffects', {
      organizationId: args.organizationId,
      operationKey: args.operationKey,
      operationId: args.operationId,
      kind: 'create_company',
      effectId: companyId,
      createdAt: Date.now(),
    });

    return { effectId: companyId, duplicate: false };
  },
});

/**
 * Create a deal, once. The organization and the owner come from the operation
 * context. A company or contact of another organization is refused, and the
 * currency must match the currency of the organization.
 */
export const createDealOnce = createInternalMutation()({
  args: {
    organizationId: zid('organization'),
    userId: zid('user'),
    operationId: zid('agentOperations'),
    operationKey: z.string().min(1).max(200),
    attempt: z.number().int().positive(),
    title: z.string().min(1).max(200),
    value: z.number().optional(),
    currency: z.string().optional(),
    probability: z.number().optional(),
    expectedCloseDate: z.number().optional(),
    companyId: z.string().optional(),
    primaryContactId: z.string().optional(),
  },
  handler: async (ctx, args) => {
    const previous = await previousEffect(ctx, args, 'create_deal');
    if (previous) return previous;

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }

    const orgCurrency = organization.settings?.currency ?? DEFAULT_CURRENCY;
    const requestedCurrency = (args.currency ?? orgCurrency).toUpperCase();
    if (!(CURRENCIES as readonly string[]).includes(requestedCurrency)) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: `Unsupported currency "${requestedCurrency}"`,
      });
    }
    if (requestedCurrency !== orgCurrency) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: `Organization currency is "${orgCurrency}". Deals must use the same currency.`,
      });
    }
    if (args.value !== undefined && args.value < 0) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'Payload field "value" must not be negative',
      });
    }

    let companyId: Id<'companies'> | undefined;
    if (args.companyId !== undefined) {
      const normalized = ctx.db.normalizeId('companies', args.companyId);
      const company = normalized ? await ctx.db.get(normalized) : null;
      if (
        !normalized ||
        !company ||
        company.organizationId !== args.organizationId ||
        company.archivedAt !== undefined
      ) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'The company does not exist in this organization',
        });
      }
      companyId = normalized;
    }

    let primaryContactId: Id<'contacts'> | undefined;
    if (args.primaryContactId !== undefined) {
      const normalized = ctx.db.normalizeId('contacts', args.primaryContactId);
      const contact = normalized ? await ctx.db.get(normalized) : null;
      if (
        !normalized ||
        !contact ||
        contact.organizationId !== args.organizationId ||
        contact.archivedAt !== undefined
      ) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'The contact does not exist in this organization',
        });
      }
      primaryContactId = normalized;
    }

    const now = Date.now();
    const dealId = await ctx.db.insert('deals', {
      organizationId: args.organizationId,
      ownerId: args.userId,
      title: args.title,
      value: args.value,
      currency: requestedCurrency,
      probability: args.probability,
      expectedCloseDate: args.expectedCloseDate,
      companyId,
      primaryContactId,
      stage: 'new',
      stageEnteredAt: now,
    });

    await ctx.db.insert('agentOperationEffects', {
      organizationId: args.organizationId,
      operationKey: args.operationKey,
      operationId: args.operationId,
      kind: 'create_deal',
      effectId: dealId,
      createdAt: now,
    });

    return { effectId: dealId, duplicate: false };
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

  create_company: async (payload, context) => {
    requireAllowedFields(
      payload,
      CREATE_COMPANY_PAYLOAD_FIELDS,
      'create_company'
    );
    const name = requireString(payload, 'name');
    const website = optionalString(payload, 'website');
    const industry = optionalString(payload, 'industry');
    const size = optionalEnum(payload, 'size', COMPANY_SIZES);
    const address = optionalString(payload, 'address');
    const country = optionalString(payload, 'country');
    const source = optionalEnum(payload, 'source', COMPANY_SOURCES);
    const tags = optionalStringArray(payload, 'tags');
    const status = optionalEnum(payload, 'status', COMPANY_STATUSES);
    const notes = optionalString(payload, 'notes');

    return await context.ctx.runMutation(
      internal.agentOperationHandlers.createCompanyOnce,
      {
        organizationId: context.organizationId,
        userId: context.userId,
        operationId: context.operationId,
        operationKey: context.operationKey,
        attempt: context.attempt,
        name,
        ...(website !== undefined ? { website } : {}),
        ...(industry !== undefined ? { industry } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(country !== undefined ? { country } : {}),
        ...(source !== undefined ? { source } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
      }
    );
  },

  create_deal: async (payload, context) => {
    requireAllowedFields(payload, CREATE_DEAL_PAYLOAD_FIELDS, 'create_deal');
    const title = requireString(payload, 'title');
    const value = optionalNumber(payload, 'value');
    const currency = optionalString(payload, 'currency');
    const probability = optionalNumber(payload, 'probability');
    const expectedCloseDate = optionalNumber(payload, 'expectedCloseDate');
    const companyId = optionalString(payload, 'companyId');
    const primaryContactId = optionalString(payload, 'primaryContactId');

    if (value !== undefined && value < 0) {
      badRequest('Payload field "value" must not be negative');
    }
    if (probability !== undefined && (probability < 0 || probability > 100)) {
      badRequest('Payload field "probability" must be between 0 and 100');
    }

    return await context.ctx.runMutation(
      internal.agentOperationHandlers.createDealOnce,
      {
        organizationId: context.organizationId,
        userId: context.userId,
        operationId: context.operationId,
        operationKey: context.operationKey,
        attempt: context.attempt,
        title,
        ...(value !== undefined ? { value } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(probability !== undefined ? { probability } : {}),
        ...(expectedCloseDate !== undefined ? { expectedCloseDate } : {}),
        ...(companyId !== undefined ? { companyId } : {}),
        ...(primaryContactId !== undefined ? { primaryContactId } : {}),
      }
    );
  },
};

/** True when a kind has a handler in the registry. */
export function isSupportedKind(kind: string): boolean {
  return Object.prototype.hasOwnProperty.call(AGENT_OPERATION_HANDLERS, kind);
}
