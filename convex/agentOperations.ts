// The ledger of agent operations: propose, approve or reject, execute, list
// and reconcile.
//
// Rules that hold for every function in this file:
// - The organization always comes from the session context, never from an
//   argument, so an operation can never cross an organization border.
// - The user id always comes from the session context, so an operation is
//   always attributed to a real member of that organization.
// - An approval is bound to one exact payload. The canonical payload text is
//   stored on both the operation and the approval and both are compared, so a
//   changed payload can never reuse an old approval.

import {
  DEFAULT_OPERATION_EXPIRY_MINUTES,
  MAX_OPERATION_EXPIRY_MINUTES,
  approvalMatchesApproval,
  canTransition,
  hashPayload,
  nextStatusAfterApproval,
  stableStringify,
  type ApprovalStatus,
  type OperationStatus,
} from '@crm/domain';
import { zid } from 'convex-helpers/server/zod';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import {
  AGENT_OPERATION_HANDLERS,
  isSupportedKind,
} from './agentOperationHandlers';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  createInternalMutation,
  createInternalQuery,
  createOrgAction,
  createOrgMutation,
  createOrgQuery,
} from './functions';

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const MAX_PENDING_APPROVALS = 100;
const MILLISECONDS_PER_MINUTE = 60 * 1000;

/** Parse a stored result text. A missing or broken text means no result. */
function parseStoredResult(resultJson: string | null | undefined): unknown {
  if (resultJson === undefined || resultJson === null) return null;
  try {
    return JSON.parse(resultJson);
  } catch {
    return null;
  }
}

/** Expiry moment of an operation, never longer than the allowed maximum. */
function computeExpiry(
  now: number,
  expiresInMinutes: number | undefined
): number {
  const minutes = Math.min(
    expiresInMinutes ?? DEFAULT_OPERATION_EXPIRY_MINUTES,
    MAX_OPERATION_EXPIRY_MINUTES
  );
  return now + minutes * MILLISECONDS_PER_MINUTE;
}

/** Plain view of an operation for the list and the detail function. */
function toOperationView(operation: {
  _id: Id<'agentOperations'>;
  kind: string;
  status: string;
  requiresApproval: boolean;
  summary?: string | null;
  agentId?: string | null;
  agentLabel?: string | null;
  requestedByUserId: Id<'user'>;
  idempotencyKey: string;
  payloadHash: string;
  payloadJson: string;
  revision: number;
  approvalId?: Id<'approvals'> | null;
  resultJson?: string | null;
  errorMessage?: string | null;
  attempts: number;
  startedAt?: number | null;
  finishedAt?: number | null;
  expiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: operation._id,
    kind: operation.kind,
    status: operation.status,
    requiresApproval: operation.requiresApproval,
    summary: operation.summary ?? undefined,
    agentId: operation.agentId ?? undefined,
    agentLabel: operation.agentLabel ?? undefined,
    requestedByUserId: operation.requestedByUserId,
    idempotencyKey: operation.idempotencyKey,
    payloadHash: operation.payloadHash,
    payloadJson: operation.payloadJson,
    revision: operation.revision,
    approvalId: operation.approvalId ?? undefined,
    resultJson: operation.resultJson ?? undefined,
    errorMessage: operation.errorMessage ?? undefined,
    attempts: operation.attempts,
    startedAt: operation.startedAt ?? undefined,
    finishedAt: operation.finishedAt ?? undefined,
    expiresAt: operation.expiresAt ?? undefined,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// propose
// ---------------------------------------------------------------------------

export const propose = createOrgMutation({
  permission: { feature: 'agents', action: 'create' },
})({
  args: {
    kind: z.string().min(1).max(100),
    payload: z.any(),
    idempotencyKey: z.string().min(1).max(200),
    requiresApproval: z.boolean(),
    agentId: z.string().optional(),
    agentLabel: z.string().optional(),
    summary: z.string().max(500).optional(),
    expiresInMinutes: z.number().int().positive().optional(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // The canonical text is the identity of the payload. Two proposals with
    // the same idempotency key must carry the very same text.
    const payloadJson = stableStringify(args.payload);
    const payloadHash = hashPayload(args.payload);

    const existing = await ctx.db
      .query('agentOperations')
      .withIndex('organizationId_idempotencyKey', (q) =>
        q
          .eq('organizationId', ctx.orgId)
          .eq('idempotencyKey', args.idempotencyKey)
      )
      .first();

    if (existing) {
      if (existing.payloadJson !== payloadJson) {
        throw new ConvexError({
          code: 'CONFLICT',
          message:
            'The same idempotency key was used with a different payload',
        });
      }
      // Same key and same payload: the operation already exists, so no second
      // one is created.
      return {
        id: existing._id,
        status: existing.status,
        approvalId: existing.approvalId ?? undefined,
        duplicate: true,
      };
    }

    const expiresAt = computeExpiry(now, args.expiresInMinutes);
    const status = args.requiresApproval ? 'awaiting_approval' : 'pending';

    const operationId = await ctx.db.insert('agentOperations', {
      organizationId: ctx.orgId,
      kind: args.kind,
      status,
      requiresApproval: args.requiresApproval,
      idempotencyKey: args.idempotencyKey,
      payloadHash,
      payloadJson,
      revision: 1,
      summary: args.summary,
      agentId: args.agentId,
      agentLabel: args.agentLabel,
      requestedByUserId: ctx.userId,
      attempts: 0,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    let approvalId: Id<'approvals'> | undefined;

    if (args.requiresApproval) {
      // The approval stores the same canonical payload, so the execution can
      // check that the granted approval belongs to this exact payload.
      approvalId = await ctx.db.insert('approvals', {
        organizationId: ctx.orgId,
        operationId,
        status: 'pending',
        payloadHash,
        payloadJson,
        revision: 1,
        requestedByUserId: ctx.userId,
        expiresAt,
        createdAt: now,
      });

      await ctx.db.patch(operationId, { approvalId, updatedAt: now });
    }

    return {
      id: operationId,
      status,
      approvalId,
      duplicate: false,
    };
  },
});

// ---------------------------------------------------------------------------
// decide
// ---------------------------------------------------------------------------

export const decide = createOrgMutation({
  permission: { feature: 'agents', action: 'manage' },
})({
  args: {
    operationId: zid('agentOperations'),
    decision: z.enum(['approve', 'reject']),
    comment: z.string().max(1000).optional(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist in this organization',
      });
    }

    if (operation.status !== 'awaiting_approval') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `The operation is not awaiting approval (current status: ${operation.status})`,
      });
    }

    const approval = await ctx.db
      .query('approvals')
      .withIndex('organizationId_operationId', (q) =>
        q.eq('organizationId', ctx.orgId).eq('operationId', operation._id)
      )
      .first();

    if (!approval || approval.status !== 'pending') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'The operation has no pending approval',
      });
    }

    const approvalStatus = args.decision === 'approve' ? 'approved' : 'rejected';

    await ctx.db.patch(approval._id, {
      status: approvalStatus,
      approverUserId: ctx.userId,
      decidedAt: now,
      comment: args.comment,
    });

    const status = nextStatusAfterApproval(args.decision);

    await ctx.db.patch(operation._id, {
      status,
      updatedAt: now,
      ...(status === 'rejected' ? { finishedAt: now } : {}),
    });

    return {
      operationId: operation._id,
      status,
      approvalStatus,
    };
  },
});

// ---------------------------------------------------------------------------
// execute
// ---------------------------------------------------------------------------

export const execute = createOrgAction({
  permission: { feature: 'agents', action: 'manage' },
})({
  args: {
    operationId: zid('agentOperations'),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.runQuery(
      internal.agentOperations.getOperationForExecution,
      {
        organizationId: ctx.orgId,
        operationId: args.operationId,
      }
    );

    if (!operation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist in this organization',
      });
    }

    // The kind is checked before any state change, so an unsupported kind
    // never leaves a half claimed operation behind.
    if (!isSupportedKind(operation.kind)) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: `Unsupported operation kind: ${operation.kind}`,
      });
    }

    const claim = await ctx.runMutation(
      internal.agentOperations.claimOperation,
      {
        operationId: operation.id,
        organizationId: ctx.orgId,
        userId: ctx.userId,
      }
    );

    if (claim.outcome === 'already_succeeded') {
      return {
        operationId: operation.id,
        status: 'succeeded',
        result: parseStoredResult(claim.resultJson),
        duplicate: true,
      };
    }

    if (claim.outcome === 'in_flight') {
      return {
        operationId: operation.id,
        status: 'executing',
        duplicate: false,
      };
    }

    const handler = AGENT_OPERATION_HANDLERS[claim.kind];
    if (!handler) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: `Unsupported operation kind: ${claim.kind}`,
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(claim.payloadJson) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    try {
      const result = await handler(payload, {
        ctx,
        organizationId: ctx.orgId,
        userId: ctx.userId,
        // The key identifies the effect, so a repeated execution reuses the
        // effect that already happened instead of causing a second one.
        operationKey: claim.operationKey,
        operationId: operation.id,
      });

      // A result that cannot be serialised still means the effect happened, so
      // the operation is stored as succeeded with an empty result.
      let resultJson: string;
      try {
        resultJson = JSON.stringify(result ?? null);
      } catch {
        resultJson = 'null';
      }

      await ctx.runMutation(internal.agentOperations.completeOperation, {
        operationId: operation.id,
        resultJson,
      });

      return {
        operationId: operation.id,
        status: 'succeeded',
        result: result ?? null,
        duplicate: false,
      };
    } catch (error) {
      const errorMessage = String(
        error instanceof Error ? error.message : error
      );

      await ctx.runMutation(internal.agentOperations.failOperation, {
        operationId: operation.id,
        errorMessage,
      });

      return {
        operationId: operation.id,
        status: 'failed',
        error: errorMessage,
        duplicate: false,
      };
    }
  },
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export const list = createOrgQuery({
  permission: { feature: 'agents', action: 'view' },
})({
  args: {
    status: z.string().optional(),
    kind: z.string().optional(),
    limit: z.number().min(1).max(MAX_LIST_LIMIT).optional(),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? DEFAULT_LIST_LIMIT;

    let operations;
    if (args.status) {
      operations = await ctx.db
        .query('agentOperations')
        .withIndex('organizationId_status', (q) =>
          q.eq('organizationId', ctx.orgId).eq('status', args.status!)
        )
        .take(limit);
    } else if (args.kind) {
      operations = await ctx.db
        .query('agentOperations')
        .withIndex('organizationId_kind', (q) =>
          q.eq('organizationId', ctx.orgId).eq('kind', args.kind!)
        )
        .take(limit);
    } else {
      operations = await ctx.db
        .query('agentOperations')
        .withIndex('organizationId_createdAt', (q) =>
          q.eq('organizationId', ctx.orgId)
        )
        .order('desc')
        .take(limit);
    }

    return operations.map((operation) => ({
      id: operation._id,
      kind: operation.kind,
      status: operation.status,
      summary: operation.summary ?? undefined,
      requiresApproval: operation.requiresApproval,
      agentLabel: operation.agentLabel ?? undefined,
      requestedByUserId: operation.requestedByUserId,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

export const get = createOrgQuery({
  permission: { feature: 'agents', action: 'view' },
})({
  args: {
    operationId: zid('agentOperations'),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist in this organization',
      });
    }

    let approvalStatus: string | undefined;
    let approverUserId: Id<'user'> | undefined;
    let decidedAt: number | undefined;
    let comment: string | undefined;

    if (operation.approvalId) {
      const approval = await ctx.db.get(operation.approvalId);
      // The approval must belong to the same organization as the operation.
      if (approval && approval.organizationId === ctx.orgId) {
        approvalStatus = approval.status;
        approverUserId = approval.approverUserId ?? undefined;
        decidedAt = approval.decidedAt ?? undefined;
        comment = approval.comment ?? undefined;
      }
    }

    return {
      ...toOperationView(operation),
      approvalStatus,
      approverUserId,
      decidedAt,
      comment,
    };
  },
});

// ---------------------------------------------------------------------------
// listPendingApprovals
// ---------------------------------------------------------------------------

export const listPendingApprovals = createOrgQuery({
  permission: { feature: 'agents', action: 'view' },
})({
  handler: async (ctx) => {
    const approvals = await ctx.db
      .query('approvals')
      .withIndex('organizationId_status', (q) =>
        q.eq('organizationId', ctx.orgId).eq('status', 'pending')
      )
      .take(MAX_PENDING_APPROVALS);

    const result: {
      id: Id<'approvals'>;
      operationId: Id<'agentOperations'>;
      kind: string;
      summary?: string;
      requestedByUserId: Id<'user'>;
      createdAt: number;
      expiresAt?: number;
    }[] = [];
    for (const approval of approvals) {
      const operation = await ctx.db.get(approval.operationId);
      if (!operation || operation.organizationId !== ctx.orgId) continue;

      result.push({
        id: approval._id,
        operationId: approval.operationId,
        kind: operation.kind,
        summary: operation.summary ?? undefined,
        requestedByUserId: approval.requestedByUserId,
        createdAt: approval.createdAt,
        expiresAt: approval.expiresAt ?? undefined,
      });
    }

    return result;
  },
});

// ---------------------------------------------------------------------------
// reconcile
// ---------------------------------------------------------------------------

export const reconcile = createOrgMutation({
  permission: { feature: 'agents', action: 'manage' },
})({
  args: {
    operationId: zid('agentOperations'),
    resolution: z.enum(['retry', 'succeed', 'fail']),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist in this organization',
      });
    }

    if (operation.status !== 'unknown' && operation.status !== 'executing') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `Only an unknown or executing operation can be reconciled (current status: ${operation.status})`,
      });
    }

    const target =
      args.resolution === 'retry'
        ? 'pending'
        : args.resolution === 'succeed'
          ? 'succeeded'
          : 'failed';

    if (!canTransition(operation.status as OperationStatus, target as OperationStatus)) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `The operation cannot move from ${operation.status} to ${target}`,
      });
    }

    const isFinal = target === 'succeeded' || target === 'failed';

    await ctx.db.patch(operation._id, {
      status: target,
      updatedAt: now,
      ...(isFinal ? { finishedAt: now } : {}),
    });

    return {
      id: operation._id,
      status: target,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal functions, used by the execute action
// ---------------------------------------------------------------------------

/** Read one operation of an organization. Used by the execute action. */
export const getOperationForExecution = createInternalQuery()({
  args: {
    organizationId: zid('organization'),
    operationId: zid('agentOperations'),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.organizationId !== args.organizationId) {
      return null;
    }

    return {
      id: operation._id,
      kind: operation.kind,
      status: operation.status,
      payloadJson: operation.payloadJson,
      idempotencyKey: operation.idempotencyKey,
    };
  },
});

export const claimOperation = createInternalMutation()({
  args: {
    operationId: zid('agentOperations'),
    organizationId: zid('organization'),
    userId: zid('user'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.organizationId !== args.organizationId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist in this organization',
      });
    }

    if (operation.status === 'succeeded') {
      return {
        outcome: 'already_succeeded' as const,
        resultJson: operation.resultJson ?? null,
      };
    }

    if (operation.status === 'executing') {
      return { outcome: 'in_flight' as const };
    }

    if (operation.status === 'awaiting_approval') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'The effect is not approved yet',
      });
    }

    if (operation.status === 'pending' && operation.requiresApproval) {
      const approval = operation.approvalId
        ? await ctx.db.get(operation.approvalId)
        : await ctx.db
            .query('approvals')
            .withIndex('organizationId_operationId', (q) =>
              q
                .eq('organizationId', args.organizationId)
                .eq('operationId', operation._id)
            )
            .first();

      if (
        !approval ||
        !approvalMatchesApproval(
          {
            status: approval.status as ApprovalStatus,
            payloadHash: approval.payloadHash,
            payloadJson: approval.payloadJson,
            expiresAt: approval.expiresAt ?? undefined,
          },
          {
            payloadHash: operation.payloadHash,
            payloadJson: operation.payloadJson,
          },
          now
        )
      ) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message:
            'The approval is missing, expired or bound to another payload',
        });
      }
    }

    if (operation.status !== 'pending') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `The operation cannot be executed from status ${operation.status}`,
      });
    }

    await ctx.db.patch(operation._id, {
      status: 'executing',
      attempts: operation.attempts + 1,
      startedAt: now,
      updatedAt: now,
    });

    return {
      outcome: 'claimed' as const,
      kind: operation.kind,
      payloadJson: operation.payloadJson,
      operationKey: operation.idempotencyKey,
    };
  },
});

export const completeOperation = createInternalMutation()({
  args: {
    operationId: zid('agentOperations'),
    resultJson: z.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const operation = await ctx.db.get(args.operationId);
    if (!operation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist',
      });
    }

    if (operation.status !== 'executing') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `Only an executing operation can be completed (current status: ${operation.status})`,
      });
    }

    await ctx.db.patch(operation._id, {
      status: 'succeeded',
      resultJson: args.resultJson,
      finishedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

export const failOperation = createInternalMutation()({
  args: {
    operationId: zid('agentOperations'),
    errorMessage: z.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const operation = await ctx.db.get(args.operationId);
    if (!operation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist',
      });
    }

    if (operation.status !== 'executing') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: `Only an executing operation can be failed (current status: ${operation.status})`,
      });
    }

    await ctx.db.patch(operation._id, {
      status: 'failed',
      errorMessage: args.errorMessage,
      finishedAt: now,
      updatedAt: now,
    });

    return null;
  },
});
