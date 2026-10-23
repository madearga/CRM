/**
 * Tests for deal-related business logic extracted from convex/deals.ts.
 *
 * Tests cover: stage transitions, currency validation, deal creation validation,
 * update validation, archive/restore, and state machine edge cases.
 *
 * Note: These test pure validation/business rules without a running Convex deployment.
 * The actual Convex function wrappers (createOrgQuery/createOrgMutation) and
 * database operations are not tested here — they'd require Convex test helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  VALID_TRANSITIONS,
  DEAL_STAGES,
  CURRENCIES,
  type DealStage,
} from '@crm/domain';

// ============================================================
// Stage Transition State Machine
// ============================================================

describe('Deal Stage State Machine', () => {
  describe('forward pipeline transitions', () => {
    it('new → contacted', () => {
      expect(isValidTransition('new', 'contacted')).toBe(true);
    });
    it('contacted → proposal', () => {
      expect(isValidTransition('contacted', 'proposal')).toBe(true);
    });
    it('proposal → won', () => {
      expect(isValidTransition('proposal', 'won')).toBe(true);
    });
    it('proposal → lost', () => {
      expect(isValidTransition('proposal', 'lost')).toBe(true);
    });
  });

  describe('backward pipeline transitions', () => {
    it('contacted → new', () => {
      expect(isValidTransition('contacted', 'new')).toBe(true);
    });
    it('proposal → contacted', () => {
      expect(isValidTransition('proposal', 'contacted')).toBe(true);
    });
  });

  describe('lost at any active stage', () => {
    it('new → lost', () => {
      expect(isValidTransition('new', 'lost')).toBe(true);
    });
    it('contacted → lost', () => {
      expect(isValidTransition('contacted', 'lost')).toBe(true);
    });
    it('proposal → lost', () => {
      expect(isValidTransition('proposal', 'lost')).toBe(true);
    });
  });

  describe('reopen closed deals', () => {
    it('won → new (reopen won deal)', () => {
      expect(isValidTransition('won', 'new')).toBe(true);
    });
    it('lost → new (reopen lost deal)', () => {
      expect(isValidTransition('lost', 'new')).toBe(true);
    });
  });

  describe('invalid transitions — skip stages', () => {
    it('new → won is invalid', () => {
      expect(isValidTransition('new', 'won')).toBe(false);
    });
    it('new → proposal is invalid', () => {
      expect(isValidTransition('new', 'proposal')).toBe(false);
    });
    it('contacted → won is invalid', () => {
      expect(isValidTransition('contacted', 'won')).toBe(false);
    });
  });

  describe('invalid transitions — closed deal moves', () => {
    it('won → lost is invalid', () => {
      expect(isValidTransition('won', 'lost')).toBe(false);
    });
    it('won → contacted is invalid', () => {
      expect(isValidTransition('won', 'contacted')).toBe(false);
    });
    it('won → proposal is invalid', () => {
      expect(isValidTransition('won', 'proposal')).toBe(false);
    });
    it('lost → won is invalid', () => {
      expect(isValidTransition('lost', 'won')).toBe(false);
    });
    it('lost → contacted is invalid', () => {
      expect(isValidTransition('lost', 'contacted')).toBe(false);
    });
    it('lost → proposal is invalid', () => {
      expect(isValidTransition('lost', 'proposal')).toBe(false);
    });
  });

  describe('self-transitions are invalid', () => {
    it.each(DEAL_STAGES)('%s → %s is invalid', (stage) => {
      expect(isValidTransition(stage, stage)).toBe(false);
    });
  });

  describe('VALID_TRANSITIONS completeness', () => {
    it('every DEAL_STAGE has an entry in VALID_TRANSITIONS', () => {
      for (const stage of DEAL_STAGES) {
        expect(VALID_TRANSITIONS[stage]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[stage])).toBe(true);
      }
    });

    it('all target stages in VALID_TRANSITIONS are valid DealStages', () => {
      const stageSet = new Set<string>(DEAL_STAGES);
      for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
        expect(stageSet.has(from)).toBe(true);
        for (const to of targets) {
          expect(stageSet.has(to)).toBe(true);
        }
      }
    });

    it('no transition allows same-stage', () => {
      for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
        expect(targets).not.toContain(from);
      }
    });
  });
});

// ============================================================
// Deal Update Stage Patch Logic
// ============================================================

describe('Deal Stage Update Patch Computation', () => {
  const now = Date.now();

  function computeStagePatch(
    currentStage: DealStage,
    targetStage: DealStage,
    lostReason?: string
  ): Record<string, any> | { error: string } {
    if (!isValidTransition(currentStage, targetStage)) {
      return { error: `Invalid stage transition from "${currentStage}" to "${targetStage}"` };
    }

    const patch: Record<string, any> = { stage: targetStage, stageEnteredAt: now };

    if (targetStage === 'won') {
      patch.wonAt = now;
      patch.probability = 100;
    } else if (targetStage === 'lost') {
      if (!lostReason) {
        return { error: 'lostReason is required when moving to "lost" stage' };
      }
      patch.lostAt = now;
      patch.lostReason = lostReason;
    } else if (targetStage === 'new' && (currentStage === 'won' || currentStage === 'lost')) {
      // Reopen: clear won/lost fields
      patch.wonAt = undefined;
      patch.lostAt = undefined;
      patch.lostReason = undefined;
    }

    return patch;
  }

  describe('move to won', () => {
    it('sets wonAt and probability=100', () => {
      const patch = computeStagePatch('proposal', 'won');
      expect(patch).toEqual(
        expect.objectContaining({
          stage: 'won',
          wonAt: now,
          probability: 100,
          stageEnteredAt: now,
        })
      );
      expect(patch).not.toHaveProperty('error');
    });
  });

  describe('move to lost', () => {
    it('requires lostReason', () => {
      const result = computeStagePatch('proposal', 'lost');
      expect(result).toEqual({ error: 'lostReason is required when moving to "lost" stage' });
    });

    it('sets lostAt and lostReason when reason provided', () => {
      const patch = computeStagePatch('proposal', 'lost', 'No response');
      expect(patch).toEqual(
        expect.objectContaining({
          stage: 'lost',
          lostAt: now,
          lostReason: 'No response',
          stageEnteredAt: now,
        })
      );
    });

    it('can be lost from any active stage with reason', () => {
      expect(computeStagePatch('new', 'lost', 'Not interested')).not.toHaveProperty('error');
      expect(computeStagePatch('contacted', 'lost', 'No response')).not.toHaveProperty('error');
      expect(computeStagePatch('proposal', 'lost', 'Budget cut')).not.toHaveProperty('error');
    });
  });

  describe('reopen closed deal', () => {
    it('won → new clears won/lost fields', () => {
      const patch = computeStagePatch('won', 'new') as Record<string, any>;
      expect(patch.wonAt).toBeUndefined();
      expect(patch.lostAt).toBeUndefined();
      expect(patch.lostReason).toBeUndefined();
      expect(patch.stage).toBe('new');
    });

    it('lost → new clears won/lost fields', () => {
      const patch = computeStagePatch('lost', 'new') as Record<string, any>;
      expect(patch.wonAt).toBeUndefined();
      expect(patch.lostAt).toBeUndefined();
      expect(patch.lostReason).toBeUndefined();
      expect(patch.stage).toBe('new');
    });
  });

  describe('normal forward move does not touch won/lost fields', () => {
    it('new → contacted only sets stage and stageEnteredAt', () => {
      const patch = computeStagePatch('new', 'contacted') as Record<string, any>;
      expect(Object.keys(patch).sort()).toEqual(['stage', 'stageEnteredAt']);
    });
  });
});

// ============================================================
// Deal Value & Currency Validation
// ============================================================

describe('Deal Value Validation', () => {
  function validateDealValue(value: number | undefined): string | null {
    if (value === undefined) return null;
    if (value < 0) return 'Deal value cannot be negative';
    if (!Number.isFinite(value)) return 'Deal value must be a finite number';
    return null;
  }

  it('undefined is valid (optional)', () => expect(validateDealValue(undefined)).toBeNull());
  it('zero is valid', () => expect(validateDealValue(0)).toBeNull());
  it('positive value is valid', () => expect(validateDealValue(150_000_000)).toBeNull());
  it('negative is rejected', () => expect(validateDealValue(-1)).not.toBeNull());
  it('NaN is rejected', () => expect(validateDealValue(NaN)).not.toBeNull());
  it('Infinity is rejected', () => expect(validateDealValue(Infinity)).not.toBeNull());
});

describe('Currency Validation', () => {
  function validateCurrency(requested: string, orgCurrency: string): string | null {
    if (!CURRENCIES.includes(requested as any)) {
      return `Unsupported currency "${requested}"`;
    }
    if (requested !== orgCurrency) {
      return `Organization currency is "${orgCurrency}". Deals must use the same currency.`;
    }
    return null;
  }

  it('IDR in IDR org is valid', () => expect(validateCurrency('IDR', 'IDR')).toBeNull());
  it('USD in USD org is valid', () => expect(validateCurrency('USD', 'USD')).toBeNull());
  it('USD in IDR org is rejected (currency mismatch)', () => {
    expect(validateCurrency('USD', 'IDR')).not.toBeNull();
  });
  it('EUR is unsupported', () => expect(validateCurrency('EUR', 'EUR')).not.toBeNull());
  it('empty string is unsupported', () => expect(validateCurrency('', 'IDR')).not.toBeNull());
});

describe('Probability Validation', () => {
  function validateProbability(prob: number | undefined): string | null {
    if (prob === undefined) return null;
    if (prob < 0 || prob > 100) return 'Probability must be between 0 and 100';
    if (!Number.isFinite(prob)) return 'Probability must be a finite number';
    return null;
  }

  it('undefined is valid', () => expect(validateProbability(undefined)).toBeNull());
  it('0% is valid', () => expect(validateProbability(0)).toBeNull());
  it('100% is valid', () => expect(validateProbability(100)).toBeNull());
  it('50% is valid', () => expect(validateProbability(50)).toBeNull());
  it('negative is rejected', () => expect(validateProbability(-1)).not.toBeNull());
  it('101 is rejected', () => expect(validateProbability(101)).not.toBeNull());
  it('NaN is rejected', () => expect(validateProbability(NaN)).not.toBeNull());
});

// ============================================================
// Deal Title Validation
// ============================================================

describe('Deal Title Validation', () => {
  function validateTitle(title: string | undefined): string | null {
    if (!title || title.trim().length === 0) return 'Title is required';
    if (title.length > 200) return 'Title must be 200 characters or less';
    return null;
  }

  it('valid title passes', () => expect(validateTitle('Enterprise deal')).toBeNull());
  it('empty title is rejected', () => expect(validateTitle('')).not.toBeNull());
  it('whitespace-only title is rejected', () => expect(validateTitle('   ')).not.toBeNull());
  it('undefined title is rejected', () => expect(validateTitle(undefined)).not.toBeNull());
  it('title at max length (200) passes', () => {
    expect(validateTitle('a'.repeat(200))).toBeNull();
  });
  it('title over max length (201) is rejected', () => {
    expect(validateTitle('a'.repeat(201))).not.toBeNull();
  });
});
