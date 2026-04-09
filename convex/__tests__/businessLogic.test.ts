/**
 * Business logic tests for Convex CRM mutations.
 *
 * These test the pure validation/business rules extracted from Convex functions,
 * without needing a running Convex deployment. For full mutation tests against
 * Convex Cloud, use `npx convex run` or upgrade to Convex 1.34+ test helpers.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Deal Stage Transition Validation
// ============================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'lost'],
  contacted: ['proposal', 'new', 'lost'],
  proposal: ['won', 'contacted', 'lost'],
  won: ['new'],
  lost: ['new'],
};

function validateStageTransition(from: string, to: string): string | null {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    return `Invalid stage transition from "${from}" to "${to}"`;
  }
  return null; // null = valid
}

describe('Deal Stage Transitions (backend logic)', () => {
  describe('forward pipeline', () => {
    it('new → contacted', () => {
      expect(validateStageTransition('new', 'contacted')).toBeNull();
    });
    it('contacted → proposal', () => {
      expect(validateStageTransition('contacted', 'proposal')).toBeNull();
    });
    it('proposal → won', () => {
      expect(validateStageTransition('proposal', 'won')).toBeNull();
    });
  });

  describe('backward pipeline', () => {
    it('contacted → new', () => {
      expect(validateStageTransition('contacted', 'new')).toBeNull();
    });
    it('proposal → contacted', () => {
      expect(validateStageTransition('proposal', 'contacted')).toBeNull();
    });
  });

  describe('lost at any stage', () => {
    it('new → lost', () => {
      expect(validateStageTransition('new', 'lost')).toBeNull();
    });
    it('contacted → lost', () => {
      expect(validateStageTransition('contacted', 'lost')).toBeNull();
    });
    it('proposal → lost', () => {
      expect(validateStageTransition('proposal', 'lost')).toBeNull();
    });
  });

  describe('reopen closed deals', () => {
    it('won → new', () => {
      expect(validateStageTransition('won', 'new')).toBeNull();
    });
    it('lost → new', () => {
      expect(validateStageTransition('lost', 'new')).toBeNull();
    });
  });

  describe('invalid transitions', () => {
    it('new → won (skip stages)', () => {
      expect(validateStageTransition('new', 'won')).not.toBeNull();
    });
    it('won → lost (must reopen)', () => {
      expect(validateStageTransition('won', 'lost')).not.toBeNull();
    });
    it('lost → won (must reopen)', () => {
      expect(validateStageTransition('lost', 'won')).not.toBeNull();
    });
    it('won → contacted (closed → active blocked)', () => {
      expect(validateStageTransition('won', 'contacted')).not.toBeNull();
    });
  });
});

// ============================================================
// Deal Value Validation
// ============================================================

function validateDealValue(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (value < 0) return 'Deal value cannot be negative';
  if (!Number.isFinite(value)) return 'Deal value must be a finite number';
  return null;
}

describe('Deal Value Validation', () => {
  it('undefined value is valid (optional)', () => {
    expect(validateDealValue(undefined)).toBeNull();
  });
  it('zero is valid', () => {
    expect(validateDealValue(0)).toBeNull();
  });
  it('positive value is valid', () => {
    expect(validateDealValue(150000000)).toBeNull();
  });
  it('negative value is rejected', () => {
    expect(validateDealValue(-100)).not.toBeNull();
  });
  it('NaN is rejected', () => {
    expect(validateDealValue(NaN)).not.toBeNull();
  });
  it('Infinity is rejected', () => {
    expect(validateDealValue(Infinity)).not.toBeNull();
  });
});

// ============================================================
// Probability Validation
// ============================================================

function validateProbability(prob: number | undefined): string | null {
  if (prob === undefined) return null;
  if (prob < 0 || prob > 100) return 'Probability must be between 0 and 100';
  if (!Number.isFinite(prob)) return 'Probability must be a finite number';
  return null;
}

describe('Probability Validation', () => {
  it('undefined is valid (optional)', () => {
    expect(validateProbability(undefined)).toBeNull();
  });
  it('0% is valid', () => {
    expect(validateProbability(0)).toBeNull();
  });
  it('100% is valid', () => {
    expect(validateProbability(100)).toBeNull();
  });
  it('50% is valid', () => {
    expect(validateProbability(50)).toBeNull();
  });
  it('negative is rejected', () => {
    expect(validateProbability(-1)).not.toBeNull();
  });
  it('101 is rejected', () => {
    expect(validateProbability(101)).not.toBeNull();
  });
});

// ============================================================
// Contact Email Duplicate Detection
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
  });

  it('empty existing list means no duplicates', () => {
    expect(isDuplicateContact({ email: 'any@example.com', organizationId: 'org1' }, [])).toBe(false);
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

describe('Archive/Restore Logic', () => {
  it('active entity can be archived', () => {
    expect(canArchive({ archivedAt: undefined })).toBe(true);
  });

  it('already archived entity cannot be archived again', () => {
    expect(canArchive({ archivedAt: Date.now() })).toBe(false);
  });

  it('archived entity can be restored', () => {
    expect(canRestore({ archivedAt: Date.now() })).toBe(true);
  });

  it('active entity cannot be restored', () => {
    expect(canRestore({ archivedAt: undefined })).toBe(false);
  });
});

// ============================================================
// Currency Validation
// ============================================================

const SUPPORTED_CURRENCIES = ['IDR', 'USD'];

function validateCurrency(
  requested: string,
  orgCurrency: string
): string | null {
  if (!SUPPORTED_CURRENCIES.includes(requested)) {
    return `Unsupported currency "${requested}"`;
  }
  if (requested !== orgCurrency) {
    return `Organization currency is "${orgCurrency}". Deals must use the same currency.`;
  }
  return null;
}

describe('Currency Validation', () => {
  it('IDR in IDR org is valid', () => {
    expect(validateCurrency('IDR', 'IDR')).toBeNull();
  });

  it('USD in USD org is valid', () => {
    expect(validateCurrency('USD', 'USD')).toBeNull();
  });

  it('USD in IDR org is rejected', () => {
    expect(validateCurrency('USD', 'IDR')).not.toBeNull();
  });

  it('EUR is unsupported', () => {
    expect(validateCurrency('EUR', 'EUR')).not.toBeNull();
  });

  it('case matters — lowercase "idr" is unsupported', () => {
    expect(validateCurrency('idr', 'IDR')).not.toBeNull();
  });
});

// ============================================================
// Deal Aging Computation
// ============================================================

const DAY_MS = 86_400_000;

function computeDaysInStage(stageEnteredAt: number | undefined, createdAt: number): number {
  const enteredAt = stageEnteredAt ?? createdAt;
  return Math.floor((Date.now() - enteredAt) / DAY_MS);
}

function isAgingDeal(daysInStage: number, avgDaysPerStage: number): boolean {
  return daysInStage > avgDaysPerStage;
}

describe('Deal Aging Computation', () => {
  const now = Date.now();

  it('uses stageEnteredAt when available', () => {
    const days = computeDaysInStage(now - 5 * DAY_MS, now - 30 * DAY_MS);
    expect(days).toBe(5);
  });

  it('falls back to createdAt when stageEnteredAt is undefined', () => {
    const days = computeDaysInStage(undefined, now - 10 * DAY_MS);
    expect(days).toBe(10);
  });

  it('deal with 15 days in stage is aging if avg is 14', () => {
    expect(isAgingDeal(15, 14)).toBe(true);
  });

  it('deal with 14 days in stage is NOT aging if avg is 14 (equal, not greater)', () => {
    expect(isAgingDeal(14, 14)).toBe(false);
  });

  it('deal with 5 days in stage is NOT aging if avg is 14', () => {
    expect(isAgingDeal(5, 14)).toBe(false);
  });
});
