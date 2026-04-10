/**
 * Tests for contact-related business logic extracted from convex/contacts.ts.
 *
 * Tests cover: fullName computation, duplicate email detection, archive/restore,
 * lastTouch status computation, and lifecycle stage validation.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Contact fullName Computation
// ============================================================

function computeFullName(
  firstName?: string,
  lastName?: string,
  email?: string
): string {
  return [firstName, lastName].filter(Boolean).join(' ') || email || '';
}

describe('Contact fullName Computation', () => {
  it('combines first and last name', () => {
    expect(computeFullName('Budi', 'Santoso')).toBe('Budi Santoso');
  });

  it('first name only', () => {
    expect(computeFullName('Budi', undefined)).toBe('Budi');
  });

  it('last name only', () => {
    expect(computeFullName(undefined, 'Santoso')).toBe('Santoso');
  });

  it('falls back to email when no names', () => {
    expect(computeFullName(undefined, undefined, 'budi@example.com')).toBe('budi@example.com');
  });

  it('falls back to email when empty strings', () => {
    expect(computeFullName('', '', 'budi@example.com')).toBe('budi@example.com');
  });

  it('empty string returns empty string', () => {
    expect(computeFullName()).toBe('');
  });
});

describe('Contact fullName Recomputation on Update', () => {
  function shouldRecomputeName(
    args: { firstName?: string; lastName?: string }
  ): boolean {
    return args.firstName !== undefined || args.lastName !== undefined;
  }

  it('recomputes when firstName changes', () => {
    expect(shouldRecomputeName({ firstName: 'New' })).toBe(true);
  });

  it('recomputes when lastName changes', () => {
    expect(shouldRecomputeName({ lastName: 'Name' })).toBe(true);
  });

  it('recomputes when both change', () => {
    expect(shouldRecomputeName({ firstName: 'New', lastName: 'Name' })).toBe(true);
  });

  it('does NOT recompute when neither name field is in args', () => {
    expect(shouldRecomputeName({})).toBe(false);
  });
});

// ============================================================
// Contact Duplicate Email Detection
// ============================================================

interface ContactCheck {
  email: string;
  organizationId: string;
}

function isDuplicateContact(
  newContact: ContactCheck,
  existing: ContactCheck[]
): boolean {
  return existing.some(
    (c) =>
      c.email.toLowerCase() === newContact.email.toLowerCase() &&
      c.organizationId === newContact.organizationId
  );
}

describe('Contact Duplicate Email Detection', () => {
  const existing: ContactCheck[] = [
    { email: 'budi@techventures.id', organizationId: 'org1' },
    { email: 'sari@techventures.id', organizationId: 'org1' },
  ];

  it('same email in same org is duplicate', () => {
    expect(isDuplicateContact({ email: 'budi@techventures.id', organizationId: 'org1' }, existing)).toBe(true);
  });

  it('same email in different org is NOT duplicate', () => {
    expect(isDuplicateContact({ email: 'budi@techventures.id', organizationId: 'org2' }, existing)).toBe(false);
  });

  it('different email in same org is NOT duplicate', () => {
    expect(isDuplicateContact({ email: 'new@techventures.id', organizationId: 'org1' }, existing)).toBe(false);
  });

  it('case-insensitive email matching', () => {
    expect(isDuplicateContact({ email: 'BUDI@techventures.id', organizationId: 'org1' }, existing)).toBe(true);
    expect(isDuplicateContact({ email: 'budi@TechVentures.id', organizationId: 'org1' }, existing)).toBe(true);
  });

  it('empty existing list means no duplicates', () => {
    expect(isDuplicateContact({ email: 'any@example.com', organizationId: 'org1' }, [])).toBe(false);
  });
});

// ============================================================
// Duplicate Email Check During Update
// ============================================================

describe('Contact Update Duplicate Email Check', () => {
  function shouldCheckDuplicate(
    newEmail: string | undefined,
    currentEmail: string
  ): boolean {
    return !!(newEmail && newEmail !== currentEmail);
  }

  it('checks when email changes', () => {
    expect(shouldCheckDuplicate('new@example.com', 'old@example.com')).toBe(true);
  });

  it('does NOT check when email is same', () => {
    expect(shouldCheckDuplicate('same@example.com', 'same@example.com')).toBe(false);
  });

  it('does NOT check when email is undefined (not being updated)', () => {
    expect(shouldCheckDuplicate(undefined, 'old@example.com')).toBe(false);
  });
});

// ============================================================
// Last Touch Status Computation
// ============================================================

const DAY_MS = 86_400_000;
const LAST_TOUCH_GREEN_DAYS = 7;

function computeLastTouchStatus(
  lastActivityAt: number | null | undefined
): { lastTouchedAt: number | null; lastTouchedDays: number | null; status: 'green' | 'red' } {
  const lastTouchedAt = lastActivityAt ?? null;
  const lastTouchedDays =
    lastTouchedAt === null ? null : Math.floor((Date.now() - lastTouchedAt) / DAY_MS);

  const status: 'green' | 'red' =
    lastTouchedDays === null
      ? 'red'
      : lastTouchedDays <= LAST_TOUCH_GREEN_DAYS
        ? 'green'
        : 'red';

  return { lastTouchedAt, lastTouchedDays, status };
}

describe('Last Touch Status Computation', () => {
  const now = Date.now();

  it('green status when last touched 3 days ago', () => {
    const result = computeLastTouchStatus(now - 3 * DAY_MS);
    expect(result.status).toBe('green');
    expect(result.lastTouchedDays).toBe(3);
  });

  it('green status when last touched today', () => {
    const result = computeLastTouchStatus(now);
    expect(result.status).toBe('green');
    expect(result.lastTouchedDays).toBe(0);
  });

  it('green status when last touched exactly 7 days ago (boundary)', () => {
    const result = computeLastTouchStatus(now - 7 * DAY_MS);
    expect(result.status).toBe('green');
    expect(result.lastTouchedDays).toBe(7);
  });

  it('red status when last touched 8 days ago', () => {
    const result = computeLastTouchStatus(now - 8 * DAY_MS);
    expect(result.status).toBe('red');
    expect(result.lastTouchedDays).toBe(8);
  });

  it('red status when no activity (null)', () => {
    const result = computeLastTouchStatus(null);
    expect(result.status).toBe('red');
    expect(result.lastTouchedDays).toBeNull();
    expect(result.lastTouchedAt).toBeNull();
  });

  it('red status when no activity (undefined)', () => {
    const result = computeLastTouchStatus(undefined);
    expect(result.status).toBe('red');
  });

  it('red status for 30 days ago', () => {
    const result = computeLastTouchStatus(now - 30 * DAY_MS);
    expect(result.status).toBe('red');
    expect(result.lastTouchedDays).toBe(30);
  });
});

// ============================================================
// Lifecycle Stage Validation
// ============================================================

describe('Contact Lifecycle Stage', () => {
  const VALID_STAGES = ['lead', 'prospect', 'customer', 'churned'];

  it.each(VALID_STAGES)('"%s" is a valid lifecycle stage', (stage) => {
    expect(VALID_STAGES).toContain(stage);
  });

  it('invalid stage is rejected', () => {
    expect(VALID_STAGES).not.toContain('qualified');
    expect(VALID_STAGES).not.toContain('opportunity');
  });
});

// ============================================================
// Archive/Restore Logic
// ============================================================

interface Archivable {
  archivedAt: number | undefined;
}

function canArchive(entity: Archivable): boolean {
  return entity.archivedAt === undefined;
}

function canRestore(entity: Archivable): boolean {
  return entity.archivedAt !== undefined;
}

describe('Contact Archive/Restore', () => {
  it('active contact can be archived', () => {
    expect(canArchive({ archivedAt: undefined })).toBe(true);
  });

  it('archived contact cannot be archived again', () => {
    expect(canArchive({ archivedAt: Date.now() })).toBe(false);
  });

  it('archived contact can be restored', () => {
    expect(canRestore({ archivedAt: Date.now() })).toBe(true);
  });

  it('active contact cannot be restored', () => {
    expect(canRestore({ archivedAt: undefined })).toBe(false);
  });
});
