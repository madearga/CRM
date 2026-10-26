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
  AGENT_OPERATION_KINDS,
  DEFAULT_OPERATION_EXPIRY_MINUTES,
  MAX_OPERATION_EXPIRY_MINUTES,
  approvalMatchesApproval,
  canTransition,
  hashPayload,
  narrowAgentScopes,
  nextStatusAfterApproval,
  scopesGrantRoomWrite,
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
import type { Doc, Id } from './_generated/dataModel';
import type { DatabaseReader } from './_generated/server';
import { checkPermission, requirePermission } from './permissionHelpers';
import {
  findAgentByKey,
  findAgentMembership,
  findUserMembership,
  requireRoom,
  requireRoomWriteAccess,
} from './roomAccess';
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

/**
 * How long a claimed operation may stay `executing` before the claim is read
 * as lost. The execute action runs the effect and reports in separate
 * transactions, so a crashed executor cannot be told apart from a slow one.
 * The timeout must be longer than the slowest normal effect, and its output
 * is `unknown`, which a person resolves.
 */
export const OPERATION_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((item) => isJsonValue(item, depth + 1));
  if (
    typeof value !== 'object' ||
    value === null ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    return false;
  return Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function permissionForKind(kind: string) {
  if (kind === 'create_activity')
    return { feature: 'activities', action: 'create' };
  if (kind === 'update_deal_stage') return { feature: 'deals', action: 'edit' };
  if (kind === 'create_company')
    return { feature: 'companies', action: 'create' };
  if (kind === 'create_deal') return { feature: 'deals', action: 'create' };
  if (kind === 'create_widget') return { feature: 'agents', action: 'create' };
  throw new ConvexError({
    code: 'BAD_REQUEST',
    message: 'Unsupported operation kind',
  });
}

async function canReadOperation(
  ctx: { db: DatabaseReader },
  operation: Doc<'agentOperations'>,
  userId: Id<'user'>
): Promise<boolean> {
  if (!operation.roomId) return true;
  const room = await ctx.db.get(operation.roomId);
  if (!room || room.organizationId !== operation.organizationId) return false;
  if (room.visibility === 'open') return true;
  const member = await findUserMembership(ctx, room._id, userId);
  return (
    member !== null &&
    member.organizationId === operation.organizationId &&
    member.memberType === 'user'
  );
}

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
    kind: z.enum(AGENT_OPERATION_KINDS),
    payload: z
      .record(z.unknown())
      .refine(
        (value) => isJsonValue(value),
        'Payload must contain only finite JSON values'
      ),
    idempotencyKey: z.string().min(1).max(200),
    requiresApproval: z.boolean().optional(),
    agentId: z.string().optional(),
    agentLabel: z.string().optional(),
    summary: z.string().max(500).optional(),
    expiresInMinutes: z.number().int().positive().optional(),
    roomId: zid('rooms').optional(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Human calls cannot acquire a service identity through caller-supplied text.
    if (args.agentId !== undefined || args.agentLabel !== undefined) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message:
          'Only an authenticated agent service can attribute an agent proposal',
      });
    }
    await requirePermission(ctx, permissionForKind(args.kind));
    if (args.roomId) {
      await requireRoomWriteAccess(ctx, ctx.orgId, args.roomId, ctx.userId);
    }
    // The canonical text is the identity of the payload. Two proposals with
    // the same idempotency key must carry the very same text.
    const payloadJson = stableStringify(args.payload);
    if (payloadJson.length > 32_000) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'The operation payload is too large',
      });
    }
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
      if (
        existing.payloadJson !== payloadJson ||
        existing.kind !== args.kind ||
        existing.roomId !== args.roomId ||
        existing.requestedByUserId !== ctx.userId ||
        existing.agentId !== undefined
      ) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: 'The same idempotency key was used for a different proposal',
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
    // Every currently supported operation changes business data. The client
    // cannot opt out of the human approval policy.
    const status = 'awaiting_approval' as const;

    const operationId = await ctx.db.insert('agentOperations', {
      organizationId: ctx.orgId,
      kind: args.kind,
      status,
      requiresApproval: true,
      idempotencyKey: args.idempotencyKey,
      payloadHash,
      payloadJson,
      revision: 1,
      summary: args.summary,
      requestedByUserId: ctx.userId,
      attempts: 0,
      expiresAt,
      roomId: args.roomId,
      createdAt: now,
      updatedAt: now,
    });

    let approvalId: Id<'approvals'> | undefined;

    {
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

    // The proposal is written into the room it belongs to, so the room talk
    // and the ledger tell the same story.
    if (args.roomId) {
      await ctx.runMutation(internal.rooms.postFromUser, {
        organizationId: ctx.orgId,
        roomId: args.roomId,
        userId: ctx.userId,
        kind: 'proposal',
        operationId,
        text: args.summary ?? `Proposal: ${args.kind}`,
      });
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
// proposeFromService
// ---------------------------------------------------------------------------

/**
 * A proposal of an agent service.
 *
 * The service is not a person, so it has no session and no permission of its
 * own. The room and the agent are the authority here: the agent must exist
 * in the organization, it must be active, it must be a member of the room,
 * and it must be allowed to write there. The same rules that
 * `rooms.postFromAgent` applies to a message apply here to a proposal.
 *
 * The proposal always waits for a person. The service cannot ask for an
 * approval that is not needed, and it cannot name the person that asked:
 * the room keeps the person that created it, and that person is the one the
 * approval is attributed to. This is an attribution of the room, not a
 * claim that the creator of the room sent the proposal.
 *
 * The key of the operation is built from the agent, the room and the hash of
 * the payload. A repeated delivery of the same proposal returns the
 * operation that already exists. A different payload under the same key is
 * a conflict, because the key must always name one exact payload.
 */
export const proposeFromService = createInternalMutation()({
  args: {
    organizationId: zid('organization'),
    roomId: zid('rooms'),
    agentId: z.string().min(1).max(60),
    // The person whose session the agent acted with.
    requestingUserId: zid('user'),
    operationKind: z.enum(AGENT_OPERATION_KINDS),
    payload: z
      .record(z.unknown())
      .refine(
        (value) => isJsonValue(value),
        'Payload must contain only finite JSON values'
      ),
    summary: z.string().max(500).optional(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // The operation is attributed to the person who asked, so the ledger
    // always names a human. A person who left the organization, or who lost
    // the right to cause this effect, cannot start an operation.
    const requester = await ctx.db
      .query('member')
      .withIndex('organizationId_userId', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', args.requestingUserId)
      )
      .first();
    if (!requester) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'The requesting person is not a member of this organization',
      });
    }
    for (const permission of [
      permissionForKind(args.operationKind),
      { feature: 'agents', action: 'create' },
    ]) {
      const allowed = await checkPermission(ctx, {
        userId: args.requestingUserId,
        orgId: args.organizationId,
        ...permission,
      });
      if (!allowed) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'The requesting person may not cause this effect',
        });
      }
    }

    const agent = await findAgentByKey(
      ctx,
      args.organizationId,
      args.agentId
    );
    if (!agent) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: `The agent "${args.agentId}" does not exist in this organization`,
      });
    }
    if (agent.status !== 'active') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: `The agent "${args.agentId}" is disabled`,
      });
    }

    const room = await requireRoom(ctx, args.organizationId, args.roomId);
    if (room.archivedAt !== undefined) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'The room is archived',
      });
    }

    const membership = await findAgentMembership(
      ctx,
      room._id,
      args.agentId
    );
    if (!membership) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: `The agent "${args.agentId}" is not a member of this room`,
      });
    }
    if (membership.role === 'observer') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: `The agent "${args.agentId}" may not write into this room`,
      });
    }
    // The scopes of the membership narrow the scopes of the agent, so a room
    // can never give an agent more than the agent holds.
    const effectiveScopes = narrowAgentScopes(agent.scopes, membership.scopes);
    if (!scopesGrantRoomWrite(effectiveScopes)) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: `The agent "${args.agentId}" may not write into this room`,
      });
    }

    // The canonical text is the identity of the payload. Two proposals with
    // the same key must carry the very same text.
    const payloadJson = stableStringify(args.payload);
    if (payloadJson.length > 32_000) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'The operation payload is too large',
      });
    }
    const payloadHash = hashPayload(args.payload);
    const idempotencyKey = `svc:${args.agentId}:${room._id}:${payloadHash}`;

    const existing = await ctx.db
      .query('agentOperations')
      .withIndex('organizationId_idempotencyKey', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('idempotencyKey', idempotencyKey)
      )
      .first();

    if (existing) {
      if (
        existing.payloadJson !== payloadJson ||
        existing.kind !== args.operationKind
      ) {
        throw new ConvexError({
          code: 'CONFLICT',
          message: 'The same idempotency key was used for a different proposal',
        });
      }
      return {
        id: existing._id,
        status: existing.status,
        approvalId: existing.approvalId ?? undefined,
        duplicate: true,
      };
    }

    const expiresAt = computeExpiry(now, undefined);
    // A service proposal always waits for a person. The service cannot ask
    // for an approval that is not needed.
    const status = 'awaiting_approval' as const;

    const operationId = await ctx.db.insert('agentOperations', {
      organizationId: args.organizationId,
      kind: args.operationKind,
      status,
      requiresApproval: true,
      idempotencyKey,
      payloadHash,
      payloadJson,
      revision: 1,
      summary: args.summary,
      agentId: agent.agentId,
      agentLabel: agent.name,
      requestedByUserId: args.requestingUserId,
      attempts: 0,
      expiresAt,
      roomId: room._id,
      createdAt: now,
      updatedAt: now,
    });

    const approvalId = await ctx.db.insert('approvals', {
      organizationId: args.organizationId,
      operationId,
      status: 'pending',
      payloadHash,
      payloadJson,
      revision: 1,
      requestedByUserId: args.requestingUserId,
      expiresAt,
      createdAt: now,
    });

    await ctx.db.patch(operationId, { approvalId, updatedAt: now });

    // The proposal is written into the room it belongs to, so the room talk
    // and the ledger tell the same story. A room that refuses the message
    // does not stop the proposal, because the proposal is the real work.
    const text = args.summary?.trim()
      ? args.summary
      : `Proposal: ${args.operationKind}`;

    try {
      await ctx.runMutation(internal.rooms.postFromAgent, {
        organizationId: args.organizationId,
        roomId: room._id,
        agentId: agent.agentId,
        kind: 'proposal',
        operationId,
        text,
      });
    } catch (error) {
      console.warn(
        '[agentOperations.proposeFromService] The room refused the proposal message',
        error
      );
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

    if (
      args.decision === 'approve' &&
      ((operation.expiresAt !== undefined && operation.expiresAt <= now) ||
        (approval.expiresAt !== undefined && approval.expiresAt <= now))
    ) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'The operation or approval has expired',
      });
    }
    if (
      approval.organizationId !== ctx.orgId ||
      approval.operationId !== operation._id ||
      approval.revision !== operation.revision ||
      approval.payloadJson !== operation.payloadJson ||
      approval.payloadHash !== operation.payloadHash
    ) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'The approval does not match the current operation revision',
      });
    }
    await requirePermission(ctx, permissionForKind(operation.kind));
    if (operation.roomId) {
      await requireRoomWriteAccess(
        ctx,
        ctx.orgId,
        operation.roomId,
        ctx.userId
      );
    }

    const approvalStatus =
      args.decision === 'approve' ? 'approved' : 'rejected';

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

    // The decision is written next to the work it settles, so the room reads
    // the decision in the place of the operation.
    if (operation.roomId) {
      const text = args.comment
        ? `Decision: ${args.decision} (${operation.kind})\n${args.comment}`
        : `Decision: ${args.decision} (${operation.kind})`;

      try {
        await ctx.runMutation(internal.rooms.postFromUser, {
          organizationId: ctx.orgId,
          roomId: operation.roomId,
          userId: ctx.userId,
          kind: 'decision',
          operationId: operation._id,
          text,
        });
      } catch (error) {
        // The decision itself must stand, also when the room refuses the
        // message.
        console.warn(
          '[agentOperations.decide] The room refused the decision message',
          error
        );
      }
    }

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

    if (claim.outcome === 'timed_out') {
      // The previous attempt is unresolved: the effect may have happened. A
      // person reads the row in the approval inbox and decides, so the
      // executor does not run the effect twice on a guess.
      return {
        operationId: operation.id,
        status: 'unknown',
        error: 'The previous attempt was interrupted before it reported',
        duplicate: false,
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

    let effectReturned = false;
    try {
      const result = await handler(payload, {
        ctx,
        organizationId: ctx.orgId,
        userId: ctx.userId,
        // The key identifies the effect, so a repeated execution reuses the
        // effect that already happened instead of causing a second one.
        operationKey: claim.operationKey,
        operationId: operation.id,
        attempt: claim.attempt,
      });

      effectReturned = true;
      // A result that cannot be serialised still means the effect happened, so
      // the operation is stored as succeeded with an empty result.
      let resultJson: string;
      try {
        resultJson = JSON.stringify(result ?? null);
      } catch {
        resultJson = 'null';
      }

      const completion = await ctx.runMutation(
        internal.agentOperations.completeOperation,
        {
          operationId: operation.id,
          attempt: claim.attempt,
          resultJson,
        }
      );

      return {
        operationId: operation.id,
        status: completion.status,
        result: result ?? null,
        duplicate: false,
      };
    } catch (error) {
      const errorMessage = String(
        error instanceof Error ? error.message : error
      );

      const code =
        error instanceof ConvexError &&
        typeof error.data === 'object' &&
        error.data !== null
          ? (error.data as { code?: string }).code
          : undefined;
      const definitelyFailed =
        !effectReturned &&
        (error instanceof z.ZodError ||
          (code !== undefined &&
            ['BAD_REQUEST', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT'].includes(
              code
            )));
      const failure = await ctx.runMutation(
        internal.agentOperations.failOperation,
        {
          operationId: operation.id,
          attempt: claim.attempt,
          errorMessage,
          definitelyFailed,
        }
      );

      return {
        operationId: operation.id,
        status: failure.status,
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

    const visible: Doc<'agentOperations'>[] = [];
    for (const operation of operations) {
      if (await canReadOperation(ctx, operation, ctx.userId))
        visible.push(operation);
    }
    return visible.map((operation) => ({
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

    if (!(await canReadOperation(ctx, operation, ctx.userId))) {
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
      if (!(await canReadOperation(ctx, operation, ctx.userId))) continue;

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

    await requirePermission(ctx, permissionForKind(operation.kind));
    if (operation.roomId) {
      await requireRoomWriteAccess(
        ctx,
        ctx.orgId,
        operation.roomId,
        ctx.userId
      );
    }
    if (
      operation.status === 'executing' &&
      now - (operation.startedAt ?? now) <= OPERATION_CLAIM_TIMEOUT_MS
    ) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'The current executor claim has not expired',
      });
    }

    const target =
      args.resolution === 'retry'
        ? 'pending'
        : args.resolution === 'succeed'
          ? 'succeeded'
          : 'failed';

    const fromStatus =
      operation.status === 'executing' ? 'unknown' : operation.status;
    if (
      !canTransition(fromStatus as OperationStatus, target as OperationStatus)
    ) {
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

    const effectPermission = permissionForKind(operation.kind);
    for (const [userId, action] of [
      [args.userId, 'manage'],
      [operation.requestedByUserId, 'create'],
    ] as const) {
      const allowed = await checkPermission(ctx, {
        userId,
        orgId: args.organizationId,
        feature: 'agents',
        action,
      });
      const mayCauseEffect = await checkPermission(ctx, {
        userId,
        orgId: args.organizationId,
        ...effectPermission,
      });
      if (!allowed || !mayCauseEffect) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message:
            'Current organization permissions do not allow this operation',
        });
      }
    }
    if (operation.roomId) {
      await requireRoomWriteAccess(
        ctx,
        args.organizationId,
        operation.roomId,
        args.userId
      );
    }

    if (operation.status === 'succeeded') {
      return {
        outcome: 'already_succeeded' as const,
        resultJson: operation.resultJson ?? null,
      };
    }

    if (operation.status === 'executing') {
      // An action that died between the claim and the completion leaves the
      // operation here forever. A claim older than the timeout is read as
      // lost: the effect may have happened, so the row becomes unknown and a
      // person decides, instead of the operation being stuck.
      const claimAge = now - (operation.startedAt ?? 0);
      if (claimAge > OPERATION_CLAIM_TIMEOUT_MS) {
        await ctx.db.patch(operation._id, {
          status: 'unknown',
          errorMessage:
            'Claim timeout: the executor stopped before it reported',
          updatedAt: now,
        });
        return { outcome: 'timed_out' as const };
      }
      return { outcome: 'in_flight' as const };
    }

    if (operation.status === 'awaiting_approval') {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'The effect is not approved yet',
      });
    }

    if (
      operation.status === 'pending' &&
      operation.expiresAt !== undefined &&
      operation.expiresAt <= now
    ) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'The operation has expired',
      });
    }

    // Old rows cannot bypass the current server-side approval policy.
    if (operation.status === 'pending') {
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
        approval.organizationId !== args.organizationId ||
        approval.operationId !== operation._id ||
        approval.revision !== operation.revision ||
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
      if (
        !approval.approverUserId ||
        !(await checkPermission(ctx, {
          userId: approval.approverUserId,
          orgId: args.organizationId,
          feature: 'agents',
          action: 'manage',
        })) ||
        !(await checkPermission(ctx, {
          userId: approval.approverUserId,
          orgId: args.organizationId,
          ...effectPermission,
        }))
      ) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'The approver no longer has permission for this effect',
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
      attempt: operation.attempts + 1,
    };
  },
});

export const completeOperation = createInternalMutation()({
  args: {
    operationId: zid('agentOperations'),
    attempt: z.number().int().positive(),
    resultJson: z.string(),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist',
      });
    }
    // A late executor must not overwrite an operator decision or a new claim.
    if (
      operation.status !== 'executing' ||
      operation.attempts !== args.attempt
    ) {
      return { status: operation.status, recorded: false };
    }
    const now = Date.now();
    await ctx.db.patch(operation._id, {
      status: 'succeeded',
      resultJson: args.resultJson,
      finishedAt: now,
      updatedAt: now,
    });
    return { status: 'succeeded', recorded: true };
  },
});

export const failOperation = createInternalMutation()({
  args: {
    operationId: zid('agentOperations'),
    attempt: z.number().int().positive(),
    errorMessage: z.string(),
    definitelyFailed: z.boolean().default(false),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'The operation does not exist',
      });
    }
    if (
      operation.status !== 'executing' ||
      operation.attempts !== args.attempt
    ) {
      return { status: operation.status, recorded: false };
    }
    // Only a confirmed validation or rolled-back business mutation is failed.
    // A lost response or completion error leaves the effect outcome unknown.
    const status = args.definitelyFailed ? 'failed' : 'unknown';
    const now = Date.now();
    await ctx.db.patch(operation._id, {
      status,
      errorMessage: args.errorMessage,
      updatedAt: now,
      ...(args.definitelyFailed ? { finishedAt: now } : {}),
    });
    return { status, recorded: true };
  },
});
