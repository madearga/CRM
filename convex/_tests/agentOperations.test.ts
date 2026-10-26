/**
 * Contract tests for the pure agent operations ledger rules.
 *
 * These cover the deterministic payload text, the payload hash, the operation
 * status machine and the approval binding rules. They need no Convex
 * deployment.
 */
import { describe, it, expect } from 'vitest';
import {
  CREATE_WIDGET_PAYLOAD_FIELDS,
  WIDGET_SOURCES,
  WIDGET_TYPES,
  stableStringify,
  hashPayload,
  canTransition,
  isTerminalStatus,
  nextStatusAfterApproval,
  approvalMatchesApproval,
  OPERATION_STATUSES,
  APPROVAL_STATUSES,
  AGENT_OPERATION_KINDS,
  CREATE_COMPANY_PAYLOAD_FIELDS,
  CREATE_DEAL_PAYLOAD_FIELDS,
  unexpectedPayloadFields,
  TERMINAL_OPERATION_STATUSES,
  DEFAULT_OPERATION_EXPIRY_MINUTES,
  MAX_OPERATION_EXPIRY_MINUTES,
  type OperationStatus,
  type ApprovalStatus,
} from '@crm/domain';

// ============================================================
// stableStringify
// ============================================================

describe('create_widget contract', () => {
  it('is a supported kind with an allowlist of exactly type, title and source', () => {
    expect(AGENT_OPERATION_KINDS).toContain('create_widget');
    expect([...CREATE_WIDGET_PAYLOAD_FIELDS].sort()).toEqual([
      'source',
      'title',
      'type',
    ]);
  });

  it('flags payload fields the allowlist does not name', () => {
    expect(
      unexpectedPayloadFields(
        { type: 'bar', title: 'Pipeline', source: 'pipeline_overview' },
        CREATE_WIDGET_PAYLOAD_FIELDS
      )
    ).toEqual([]);
    expect(
      unexpectedPayloadFields(
        { type: 'bar', title: 'x', source: 'pipeline_overview', jsx: '<b/>' },
        CREATE_WIDGET_PAYLOAD_FIELDS
      )
    ).toEqual(['jsx']);
  });

  it('whitelists exactly one widget type and one data source', () => {
    expect(WIDGET_TYPES).toEqual(['bar']);
    expect(WIDGET_SOURCES).toEqual(['pipeline_overview']);
  });
});

describe('stableStringify', () => {
  it('gives the same text for the same keys in a different order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  it('sorts object keys so the text is stable', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('drops an undefined value inside an object', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('writes an undefined value on its own as null', () => {
    expect(stableStringify(undefined)).toBe('null');
  });

  it('keeps the order of array items', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('writes a Date as its ISO string', () => {
    expect(stableStringify(new Date('2024-01-02T03:04:05.000Z'))).toBe(
      '"2024-01-02T03:04:05.000Z"'
    );
  });

  it('writes a number that is not finite as null', () => {
    expect(stableStringify(NaN)).toBe('null');
    expect(stableStringify(Infinity)).toBe('null');
    expect(stableStringify(-Infinity)).toBe('null');
  });

  it('handles nested objects and arrays', () => {
    expect(stableStringify({ a: { b: [1, { c: 2 }] } })).toBe(
      '{"a":{"b":[1,{"c":2}]}}'
    );
  });

  it('sorts the keys of nested objects too', () => {
    expect(stableStringify({ a: { y: 1, x: 2 } })).toBe(
      stableStringify({ a: { x: 2, y: 1 } })
    );
  });
});

// ============================================================
// hashPayload
// ============================================================

describe('hashPayload', () => {
  it('gives the same hash for the same value', () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ a: 1, b: 2 }));
  });

  it('starts with fnv1a and ends with 8 hex digits', () => {
    expect(hashPayload({ a: 1 })).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });

  it('gives different hashes for different values', () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it('does not depend on the key order', () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
  });
});

// ============================================================
// canTransition
// ============================================================

const ALLOWED_TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
  pending: ['executing', 'failed', 'unknown'],
  awaiting_approval: ['pending', 'rejected', 'failed', 'unknown'],
  executing: ['succeeded', 'failed', 'unknown'],
  succeeded: [],
  failed: [],
  rejected: [],
  unknown: ['pending', 'failed', 'succeeded'],
};

describe('canTransition', () => {
  it.each(
    (Object.keys(ALLOWED_TRANSITIONS) as OperationStatus[]).flatMap((from) =>
      ALLOWED_TRANSITIONS[from].map((to) => [from, to] as const)
    )
  )('allows %s to move to %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['pending', 'succeeded'],
    ['succeeded', 'executing'],
    ['rejected', 'pending'],
    ['failed', 'executing'],
    ['pending', 'pending'],
    ['executing', 'pending'],
    ['awaiting_approval', 'executing'],
  ] as const)('refuses %s to move to %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it.each(OPERATION_STATUSES)('has a rule for the status %s', (status) => {
    expect(typeof canTransition(status, 'pending')).toBe('boolean');
  });
});

// ============================================================
// isTerminalStatus
// ============================================================

describe('isTerminalStatus', () => {
  it.each(['succeeded', 'failed', 'rejected'] as const)(
    'treats %s as terminal',
    (status) => {
      expect(isTerminalStatus(status)).toBe(true);
    }
  );

  it.each(['pending', 'awaiting_approval', 'executing', 'unknown'] as const)(
    'treats %s as not terminal',
    (status) => {
      expect(isTerminalStatus(status)).toBe(false);
    }
  );
});

// ============================================================
// nextStatusAfterApproval
// ============================================================

describe('nextStatusAfterApproval', () => {
  it('moves an approved operation to pending', () => {
    expect(nextStatusAfterApproval('approve')).toBe('pending');
  });

  it('moves a rejected operation to rejected', () => {
    expect(nextStatusAfterApproval('reject')).toBe('rejected');
  });
});

// ============================================================
// approvalMatchesApproval
// ============================================================

const NOW = 1_700_000_000_000;
const PAYLOAD = { kind: 'create_activity', body: 'call the customer' };
const PAYLOAD_JSON = stableStringify(PAYLOAD);
const PAYLOAD_HASH = hashPayload(PAYLOAD);

const approvedApproval = {
  status: 'approved' as ApprovalStatus,
  payloadHash: PAYLOAD_HASH,
  payloadJson: PAYLOAD_JSON,
};

const operation = { payloadHash: PAYLOAD_HASH, payloadJson: PAYLOAD_JSON };

describe('approvalMatchesApproval', () => {
  it('accepts an approved approval for the same payload', () => {
    expect(approvalMatchesApproval(approvedApproval, operation, NOW)).toBe(true);
  });

  it('rejects an approval that is still pending', () => {
    expect(
      approvalMatchesApproval({ ...approvedApproval, status: 'pending' }, operation, NOW)
    ).toBe(false);
  });

  it('rejects an approval that was rejected', () => {
    expect(
      approvalMatchesApproval({ ...approvedApproval, status: 'rejected' }, operation, NOW)
    ).toBe(false);
  });

  it('rejects an approval that expired', () => {
    expect(
      approvalMatchesApproval({ ...approvedApproval, status: 'expired' }, operation, NOW)
    ).toBe(false);
  });

  it('rejects a different payload hash', () => {
    expect(
      approvalMatchesApproval(
        { ...approvedApproval, payloadHash: hashPayload({ kind: 'other' }) },
        operation,
        NOW
      )
    ).toBe(false);
  });

  it('rejects a different payload text even when the hash is the same', () => {
    expect(
      approvalMatchesApproval(
        { ...approvedApproval, payloadJson: stableStringify({ ...PAYLOAD, body: 'changed' }) },
        operation,
        NOW
      )
    ).toBe(false);
  });

  it('rejects an approval whose expiry is in the past', () => {
    expect(
      approvalMatchesApproval({ ...approvedApproval, expiresAt: NOW - 1 }, operation, NOW)
    ).toBe(false);
  });

  it('accepts an approval whose expiry is in the future', () => {
    expect(
      approvalMatchesApproval({ ...approvedApproval, expiresAt: NOW + 1 }, operation, NOW)
    ).toBe(true);
  });
});

describe('payload allowlists', () => {
  it('accepts the company fields and refuses an owner or organization field', () => {
    expect(
      unexpectedPayloadFields(
        { name: 'Acme', website: 'acme.test' },
        CREATE_COMPANY_PAYLOAD_FIELDS
      )
    ).toEqual([]);
    expect(
      unexpectedPayloadFields(
        { name: 'Acme', ownerId: 'user-1', organizationId: 'org-1' },
        CREATE_COMPANY_PAYLOAD_FIELDS
      )
    ).toEqual(['ownerId', 'organizationId']);
  });

  it('accepts the deal fields and refuses a stage or owner field', () => {
    expect(
      unexpectedPayloadFields(
        { title: 'Big deal', value: 10, currency: 'IDR' },
        CREATE_DEAL_PAYLOAD_FIELDS
      )
    ).toEqual([]);
    expect(
      unexpectedPayloadFields(
        { title: 'Big deal', stage: 'won', ownerId: 'user-1' },
        CREATE_DEAL_PAYLOAD_FIELDS
      )
    ).toEqual(['stage', 'ownerId']);
  });
});

// ============================================================
// Constants
// ============================================================

describe('agent operations constants', () => {
  it('holds exactly the terminal statuses in TERMINAL_OPERATION_STATUSES', () => {
    expect([...TERMINAL_OPERATION_STATUSES].sort()).toEqual(
      ['failed', 'rejected', 'succeeded']
    );
  });

  it('lists the supported operation kinds', () => {
    expect([...AGENT_OPERATION_KINDS]).toEqual([
      'create_activity',
      'update_deal_stage',
      'create_company',
      'create_deal',
      'create_widget',
    ]);
  });

  it('allows a maximum expiry that is at least the default expiry', () => {
    expect(MAX_OPERATION_EXPIRY_MINUTES).toBeGreaterThanOrEqual(
      DEFAULT_OPERATION_EXPIRY_MINUTES
    );
  });

  it('lists every operation status once', () => {
    expect(new Set(OPERATION_STATUSES).size).toBe(OPERATION_STATUSES.length);
  });

  it('lists every approval status once', () => {
    expect(new Set(APPROVAL_STATUSES).size).toBe(APPROVAL_STATUSES.length);
  });
});

describe('stableStringify marks values JSON cannot carry', () => {
  it('gives a function its own marker instead of a null', () => {
    expect(stableStringify({ handler: () => undefined })).toBe(
      '{"handler":"[function]"}'
    );
  });

  it('does not let a function collide with a real null', () => {
    expect(hashPayload({ handler: () => undefined })).not.toBe(
      hashPayload({ handler: null })
    );
  });

  it('gives a symbol its own marker', () => {
    expect(stableStringify({ marker: Symbol('x') })).toBe(
      '{"marker":"[symbol]"}'
    );
  });

  it('gives a bigint its own marker', () => {
    expect(stableStringify({ count: 9007199254740993n })).toBe(
      '{"count":"[bigint:9007199254740993]"}'
    );
  });
});

describe('canTransition refuses a status it does not know', () => {
  it('returns false instead of throwing for an unknown status', () => {
    expect(
      canTransition('archived' as never, 'pending' as never)
    ).toBe(false);
  });
});

describe('approvalMatchesApproval treats the expiry boundary as expired', () => {
  it('is false when the approval expires exactly now', () => {
    const now = 1_700_000_000_000;
    expect(
      approvalMatchesApproval(
        {
          status: 'approved',
          payloadHash: 'fnv1a:00000000',
          payloadJson: '{"a":1}',
          expiresAt: now,
        },
        { payloadHash: 'fnv1a:00000000', payloadJson: '{"a":1}' },
        now
      )
    ).toBe(false);
  });
});
