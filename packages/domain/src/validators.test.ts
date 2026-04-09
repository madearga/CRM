import { describe, it, expect } from 'vitest';
import {
  DEAL_STAGES,
  ACTIVITY_TYPES,
  ENTITY_TYPES,
  LIFECYCLE_STAGES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  ROLES,
  DEAL_AGING_THRESHOLD_MS,
  isValidTransition,
  type DealStage,
  type ActivityType,
  type EntityType,
  type LifecycleStage,
  type Currency,
  type Role,
} from './index';

describe('Domain Constants', () => {
  describe('ACTIVITY_TYPES', () => {
    it('has 5 types', () => {
      expect(ACTIVITY_TYPES).toHaveLength(5);
    });

    it('includes call, email, meeting, note, status_change', () => {
      expect(ACTIVITY_TYPES).toEqual(['call', 'email', 'meeting', 'note', 'status_change']);
    });
  });

  describe('ENTITY_TYPES', () => {
    it('has 3 types', () => {
      expect(ENTITY_TYPES).toHaveLength(3);
    });

    it('includes company, contact, deal', () => {
      expect(ENTITY_TYPES).toEqual(['company', 'contact', 'deal']);
    });
  });

  describe('LIFECYCLE_STAGES', () => {
    it('has 4 stages', () => {
      expect(LIFECYCLE_STAGES).toHaveLength(4);
    });

    it('goes from lead to churned', () => {
      expect(LIFECYCLE_STAGES).toEqual(['lead', 'prospect', 'customer', 'churned']);
    });
  });

  describe('CURRENCIES', () => {
    it('supports IDR and USD', () => {
      expect(CURRENCIES).toEqual(['IDR', 'USD']);
    });

    it('default currency is IDR', () => {
      expect(DEFAULT_CURRENCY).toBe('IDR');
    });
  });

  describe('ROLES', () => {
    it('has 3 roles: owner, admin, member', () => {
      expect(ROLES).toEqual(['owner', 'admin', 'member']);
    });
  });

  describe('DEAL_AGING_THRESHOLD_MS', () => {
    it('is 7 days in milliseconds', () => {
      expect(DEAL_AGING_THRESHOLD_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});

describe('Type Safety', () => {
  it('DealStage type narrows correctly', () => {
    const stage: DealStage = 'new';
    expect(DEAL_STAGES).toContain(stage);
  });

  it('ActivityType type narrows correctly', () => {
    const type: ActivityType = 'call';
    expect(ACTIVITY_TYPES).toContain(type);
  });

  it('EntityType type narrows correctly', () => {
    const entity: EntityType = 'company';
    expect(ENTITY_TYPES).toContain(entity);
  });

  it('LifecycleStage type narrows correctly', () => {
    const stage: LifecycleStage = 'lead';
    expect(LIFECYCLE_STAGES).toContain(stage);
  });

  it('Currency type narrows correctly', () => {
    const currency: Currency = 'IDR';
    expect(CURRENCIES).toContain(currency);
  });

  it('Role type narrows correctly', () => {
    const role: Role = 'owner';
    expect(ROLES).toContain(role);
  });
});
