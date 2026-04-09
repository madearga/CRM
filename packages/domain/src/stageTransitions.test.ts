import { describe, it, expect } from 'vitest';
import {
  DEAL_STAGES,
  ACTIVE_STAGES,
  CLOSED_STAGES,
  VALID_TRANSITIONS,
  isValidTransition,
  type DealStage,
} from './index';

describe('Deal Stages', () => {
  it('has exactly 5 stages', () => {
    expect(DEAL_STAGES).toHaveLength(5);
  });

  it('stages are in correct order', () => {
    expect(DEAL_STAGES).toEqual(['new', 'contacted', 'proposal', 'won', 'lost']);
  });

  it('active stages are new, contacted, proposal', () => {
    expect(ACTIVE_STAGES).toEqual(['new', 'contacted', 'proposal']);
  });

  it('closed stages are won, lost', () => {
    expect(CLOSED_STAGES).toEqual(['won', 'lost']);
  });

  it('every stage is either active or closed', () => {
    const all = [...ACTIVE_STAGES, ...CLOSED_STAGES];
    for (const stage of DEAL_STAGES) {
      expect(all).toContain(stage);
    }
  });
});

describe('Stage Transition State Machine', () => {
  describe('valid transitions', () => {
    it('new → contacted', () => {
      expect(isValidTransition('new', 'contacted')).toBe(true);
    });

    it('new → lost', () => {
      expect(isValidTransition('new', 'lost')).toBe(true);
    });

    it('contacted → proposal', () => {
      expect(isValidTransition('contacted', 'proposal')).toBe(true);
    });

    it('contacted → lost', () => {
      expect(isValidTransition('contacted', 'lost')).toBe(true);
    });

    it('contacted → new (go back)', () => {
      expect(isValidTransition('contacted', 'new')).toBe(true);
    });

    it('proposal → won', () => {
      expect(isValidTransition('proposal', 'won')).toBe(true);
    });

    it('proposal → lost', () => {
      expect(isValidTransition('proposal', 'lost')).toBe(true);
    });

    it('proposal → contacted (go back)', () => {
      expect(isValidTransition('proposal', 'contacted')).toBe(true);
    });

    it('won → new (reopen)', () => {
      expect(isValidTransition('won', 'new')).toBe(true);
    });

    it('lost → new (reopen)', () => {
      expect(isValidTransition('lost', 'new')).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('new → new (self-loop)', () => {
      expect(isValidTransition('new', 'new')).toBe(false);
    });

    it('new → won (skip stages)', () => {
      expect(isValidTransition('new', 'won')).toBe(false);
    });

    it('new → proposal (skip contacted)', () => {
      expect(isValidTransition('new', 'proposal')).toBe(false);
    });

    it('contacted → won (skip proposal)', () => {
      expect(isValidTransition('contacted', 'won')).toBe(false);
    });

    it('won → contacted (closed cannot go to active)', () => {
      expect(isValidTransition('won', 'contacted')).toBe(false);
    });

    it('won → proposal (closed cannot go to active)', () => {
      expect(isValidTransition('won', 'proposal')).toBe(false);
    });

    it('won → lost (must reopen first)', () => {
      expect(isValidTransition('won', 'lost')).toBe(false);
    });

    it('lost → contacted (must reopen first)', () => {
      expect(isValidTransition('lost', 'contacted')).toBe(false);
    });

    it('lost → proposal (must reopen first)', () => {
      expect(isValidTransition('lost', 'proposal')).toBe(false);
    });

    it('lost → won (must reopen first)', () => {
      expect(isValidTransition('lost', 'won')).toBe(false);
    });
  });

  describe('VALID_TRANSITIONS completeness', () => {
    it('every stage has a transitions array', () => {
      for (const stage of DEAL_STAGES) {
        expect(VALID_TRANSITIONS[stage]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[stage])).toBe(true);
      }
    });

    it('no stage allows self-transitions', () => {
      for (const stage of DEAL_STAGES) {
        expect(VALID_TRANSITIONS[stage]).not.toContain(stage);
      }
    });

    it('every listed target is a valid DealStage', () => {
      for (const stage of DEAL_STAGES) {
        for (const target of VALID_TRANSITIONS[stage]) {
          expect(DEAL_STAGES).toContain(target);
        }
      }
    });
  });

  describe('happy path: new deal to won', () => {
    it('follows the complete pipeline: new → contacted → proposal → won', () => {
      expect(isValidTransition('new', 'contacted')).toBe(true);
      expect(isValidTransition('contacted', 'proposal')).toBe(true);
      expect(isValidTransition('proposal', 'won')).toBe(true);
    });
  });

  describe('sad path: deal lost at any active stage', () => {
    for (const stage of ACTIVE_STAGES) {
      it(`${stage} → lost`, () => {
        expect(isValidTransition(stage, 'lost')).toBe(true);
      });
    }
  });

  describe('reopen closed deals', () => {
    it('won → new (reopen)', () => {
      expect(isValidTransition('won', 'new')).toBe(true);
    });

    it('lost → new (reopen)', () => {
      expect(isValidTransition('lost', 'new')).toBe(true);
    });
  });
});
