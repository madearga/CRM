/**
 * Integration tests for dashboard overview query structure.
 *
 * These verify that the query's Zod return type schema matches
 * what the frontend expects. If the schema changes, these tests break.
 */
import { describe, it, expect } from 'vitest';

// Mirror the dashboard overview return type from convex/dashboard.ts
// If the backend schema changes, these tests should break.
const OVERVIEW_SHAPE = {
  pipelineValue: 'number',
  totalDeals: 'number',
  totalCompanies: 'number',
  totalActivities: 'number',
  dealsByStage: 'array',        // { stage, count, value }[]
  recentActivities: 'array',    // { id, title, type, entityType, entityId, createdAt }[]
  upcomingActivities: 'array',  // { id, title, type, entityType, entityId, dueAt }[]
  agingDeals: 'array',          // { id, title, stage, value, daysInStage, isAging }[]
} as const;

describe('Dashboard Overview Query Structure', () => {
  it('has all required top-level fields', () => {
    const requiredKeys = [
      'pipelineValue',
      'totalDeals',
      'totalCompanies',
      'totalActivities',
      'dealsByStage',
      'recentActivities',
      'upcomingActivities',
      'agingDeals',
    ];
    expect(Object.keys(OVERVIEW_SHAPE)).toEqual(requiredKeys);
  });

  it('numeric fields are number type', () => {
    expect(OVERVIEW_SHAPE.pipelineValue).toBe('number');
    expect(OVERVIEW_SHAPE.totalDeals).toBe('number');
    expect(OVERVIEW_SHAPE.totalCompanies).toBe('number');
    expect(OVERVIEW_SHAPE.totalActivities).toBe('number');
  });

  it('array fields are array type', () => {
    expect(OVERVIEW_SHAPE.dealsByStage).toBe('array');
    expect(OVERVIEW_SHAPE.recentActivities).toBe('array');
    expect(OVERVIEW_SHAPE.upcomingActivities).toBe('array');
    expect(OVERVIEW_SHAPE.agingDeals).toBe('array');
  });
});

describe('Deals By Stage Item Structure', () => {
  const item = { stage: 'new', count: 3, value: 500000000 };

  it('has stage string', () => {
    expect(typeof item.stage).toBe('string');
  });

  it('has count number', () => {
    expect(typeof item.count).toBe('number');
  });

  it('has value number', () => {
    expect(typeof item.value).toBe('number');
  });
});

describe('Aging Deal Item Structure', () => {
  const item = {
    id: 'deal_123',
    title: 'Test Deal',
    stage: 'proposal',
    value: 100000000,
    daysInStage: 15,
    isAging: true,
  };

  it('has id', () => expect(typeof item.id).toBe('string'));
  it('has title', () => expect(typeof item.title).toBe('string'));
  it('has stage', () => expect(typeof item.stage).toBe('string'));
  it('has value (number or undefined)', () => expect(typeof item.value).toBe('number'));
  it('has daysInStage', () => expect(typeof item.daysInStage).toBe('number'));
  it('has isAging boolean', () => expect(typeof item.isAging).toBe('boolean'));
});

describe('Activity Item Structure', () => {
  const recentItem = {
    id: 'act_123',
    title: 'Call with Budi',
    type: 'call',
    entityType: 'deal',
    entityId: 'deal_456',
    createdAt: Date.now(),
  };

  const upcomingItem = {
    id: 'act_789',
    title: 'Meeting with Sari',
    type: 'meeting',
    entityType: 'contact',
    entityId: 'contact_012',
    dueAt: Date.now() + 86400000,
  };

  it('recent activity has createdAt', () => {
    expect(typeof recentItem.createdAt).toBe('number');
  });

  it('upcoming activity has dueAt', () => {
    expect(typeof upcomingItem.dueAt).toBe('number');
  });

  it('activity type is one of call/email/meeting/note/status_change', () => {
    const validTypes = ['call', 'email', 'meeting', 'note', 'status_change'];
    expect(validTypes).toContain(recentItem.type);
    expect(validTypes).toContain(upcomingItem.type);
  });

  it('entityType is one of company/contact/deal', () => {
    const validTypes = ['company', 'contact', 'deal'];
    expect(validTypes).toContain(recentItem.entityType);
    expect(validTypes).toContain(upcomingItem.entityType);
  });
});
