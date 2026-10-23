// Agent operations contract: proposals, approvals, and the ledger of effects
// an agent may cause. An approval is bound to one exact canonical payload, so
// any change of the payload invalidates that approval and the operation must
// ask again.

export const OPERATION_STATUSES = [
  'pending',
  'awaiting_approval',
  'executing',
  'succeeded',
  'failed',
  'unknown',
  'rejected',
] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'expired',
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const AGENT_OPERATION_KINDS = [
  'create_activity',
  'update_deal_stage',
] as const;

export type AgentOperationKind = (typeof AGENT_OPERATION_KINDS)[number];

/** Statuses an operation cannot leave any more. */
export const TERMINAL_OPERATION_STATUSES: OperationStatus[] = [
  'succeeded',
  'failed',
  'rejected',
];

export const DEFAULT_OPERATION_EXPIRY_MINUTES = 60;
export const MAX_OPERATION_EXPIRY_MINUTES = 60 * 24 * 7;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

/**
 * Values JSON cannot carry would otherwise collapse into `null` and collide
 * with a real null, so two different payloads could hash the same. Each such
 * value gets its own marker instead.
 */
const markerFor = (value: unknown): string => {
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'symbol') return '[symbol]';
  if (typeof value === 'bigint') return `[bigint:${value.toString()}]`;
  return '[unserialisable]';
};

/**
 * Deterministic JSON: the same value always yields the same text, so a
 * payload can be compared for equality across processes and time.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return JSON.stringify(markerFor(value));
  }
  if (typeof value === 'bigint') {
    return JSON.stringify(markerFor(value));
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

/**
 * Change detector, not a security primitive. Security does not depend on this
 * hash: approval binding compares the canonical payload string exactly.
 */
export function hashPayload(value: unknown): string {
  const text = stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, '0')}`;
}

const ALLOWED_TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
  pending: ['executing', 'failed', 'unknown'],
  awaiting_approval: ['pending', 'rejected', 'failed', 'unknown'],
  executing: ['succeeded', 'failed', 'unknown'],
  succeeded: [],
  failed: [],
  rejected: [],
  unknown: ['pending', 'failed', 'succeeded'],
};

export function canTransition(
  from: OperationStatus,
  to: OperationStatus
): boolean {
  // A status read from storage may be one this version does not know, so the
  // lookup is guarded: an unknown status refuses every move instead of
  // throwing.
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: OperationStatus): boolean {
  return TERMINAL_OPERATION_STATUSES.includes(status);
}

export function nextStatusAfterApproval(
  decision: 'approve' | 'reject'
): OperationStatus {
  return decision === 'approve' ? 'pending' : 'rejected';
}

/**
 * An approval is only valid for the exact payload it was granted for, so a
 * mutated payload forces a new approval instead of reusing an old decision.
 */
export function approvalMatchesApproval(
  approval: {
    status: ApprovalStatus;
    payloadHash: string;
    payloadJson: string;
    expiresAt?: number;
  },
  operation: { payloadHash: string; payloadJson: string },
  now: number
): boolean {
  if (approval.status !== 'approved') return false;
  if (approval.payloadHash !== operation.payloadHash) return false;
  if (approval.payloadJson !== operation.payloadJson) return false;
  // An approval that expires exactly now has expired.
  if (approval.expiresAt !== undefined && approval.expiresAt <= now) return false;
  return true;
}
