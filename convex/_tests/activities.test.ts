/**
 * Tests for activity-related business logic extracted from convex/activities.ts.
 *
 * Tests cover: activity type validation, entity type validation,
 * org-scoping for activity access, and trigger-based lastActivityAt update logic.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Activity Type Validation
// ============================================================

const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'status_change'] as const;

describe('Activity Type Validation', () => {
  it.each(ACTIVITY_TYPES)('"%s" is a valid activity type', (type) => {
    expect(ACTIVITY_TYPES).toContain(type);
  });

  it('invalid types are rejected', () => {
    expect(ACTIVITY_TYPES as readonly string[]).not.toContain('sms');
    expect(ACTIVITY_TYPES as readonly string[]).not.toContain('chat');
    expect(ACTIVITY_TYPES as readonly string[]).not.toContain('task');
  });
});

// ============================================================
// Entity Type Validation
// ============================================================

const ENTITY_TYPES = ['company', 'contact', 'deal'] as const;

describe('Entity Type Validation', () => {
  it.each(ENTITY_TYPES)('"%s" is a valid entity type', (type) => {
    expect(ENTITY_TYPES).toContain(type);
  });

  it('invalid entity types are rejected', () => {
    expect(ENTITY_TYPES as readonly string[]).not.toContain('user');
    expect(ENTITY_TYPES as readonly string[]).not.toContain('organization');
  });
});

// ============================================================
// Activity Creation Validation
// ============================================================

interface ActivityInput {
  title: string;
  type: string;
  entityType: string;
  entityId: string;
}

function validateActivityInput(input: Partial<ActivityInput>): string | null {
  if (!input.title || input.title.trim().length === 0) {
    return 'Title is required';
  }
  if (!ACTIVITY_TYPES.includes(input.type as any)) {
    return `Invalid activity type "${input.type}"`;
  }
  if (!ENTITY_TYPES.includes(input.entityType as any)) {
    return `Invalid entity type "${input.entityType}"`;
  }
  if (!input.entityId) {
    return 'Entity ID is required';
  }
  return null;
}

describe('Activity Input Validation', () => {
  const validInput: ActivityInput = {
    title: 'Call with Budi',
    type: 'call',
    entityType: 'contact',
    entityId: 'contact_123',
  };

  it('valid input passes', () => {
    expect(validateActivityInput(validInput)).toBeNull();
  });

  it('rejects missing title', () => {
    expect(validateActivityInput({ ...validInput, title: '' })).not.toBeNull();
  });

  it('rejects whitespace-only title', () => {
    expect(validateActivityInput({ ...validInput, title: '   ' })).not.toBeNull();
  });

  it('rejects invalid activity type', () => {
    expect(validateActivityInput({ ...validInput, type: 'sms' })).not.toBeNull();
  });

  it('rejects invalid entity type', () => {
    expect(validateActivityInput({ ...validInput, entityType: 'user' })).not.toBeNull();
  });

  it('rejects missing entityId', () => {
    expect(validateActivityInput({ ...validInput, entityId: '' })).not.toBeNull();
  });

  it('all activity types are valid', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(validateActivityInput({ ...validInput, type })).toBeNull();
    }
  });

  it('all entity types are valid', () => {
    for (const entityType of ENTITY_TYPES) {
      expect(validateActivityInput({ ...validInput, entityType })).toBeNull();
    }
  });
});

// ============================================================
// Activity Org-Scoping
// ============================================================

describe('Activity Org-Scoping', () => {
  function isActivityInOrg(
    activityOrgId: string,
    userOrgId: string
  ): boolean {
    return activityOrgId === userOrgId;
  }

  it('activity in same org is accessible', () => {
    expect(isActivityInOrg('org1', 'org1')).toBe(true);
  });

  it('activity in different org is NOT accessible', () => {
    expect(isActivityInOrg('org1', 'org2')).toBe(false);
  });
});

// ============================================================
// Activity Completion Logic
// ============================================================

describe('Activity Completion', () => {
  function canComplete(activity: {
    completedAt?: number | undefined;
  }): boolean {
    return activity.completedAt === undefined;
  }

  it('incomplete activity can be completed', () => {
    expect(canComplete({ completedAt: undefined })).toBe(true);
  });

  it('already completed activity cannot be completed again', () => {
    expect(canComplete({ completedAt: Date.now() })).toBe(false);
  });
});

// ============================================================
// Trigger: lastActivityAt Update Logic
// ============================================================

describe('Activity Trigger — lastActivityAt Update', () => {
  interface ActivityDoc {
    entityType: string;
    entityId: string;
  }

  interface TriggerChange {
    operation: 'insert' | 'update' | 'delete';
    newDoc: ActivityDoc | null;
  }

  function shouldUpdateLastActivityAt(change: TriggerChange): {
    shouldUpdate: boolean;
    contactId?: string;
  } {
    if (change.operation !== 'insert') return { shouldUpdate: false };
    if (!change.newDoc) return { shouldUpdate: false };
    if (change.newDoc.entityType !== 'contact') return { shouldUpdate: false };

    return { shouldUpdate: true, contactId: change.newDoc.entityId };
  }

  it('insert activity for contact triggers update', () => {
    const result = shouldUpdateLastActivityAt({
      operation: 'insert',
      newDoc: { entityType: 'contact', entityId: 'contact_123' },
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.contactId).toBe('contact_123');
  });

  it('insert activity for deal does NOT trigger update', () => {
    const result = shouldUpdateLastActivityAt({
      operation: 'insert',
      newDoc: { entityType: 'deal', entityId: 'deal_456' },
    });
    expect(result.shouldUpdate).toBe(false);
  });

  it('insert activity for company does NOT trigger update', () => {
    const result = shouldUpdateLastActivityAt({
      operation: 'insert',
      newDoc: { entityType: 'company', entityId: 'company_789' },
    });
    expect(result.shouldUpdate).toBe(false);
  });

  it('update operation does NOT trigger update', () => {
    const result = shouldUpdateLastActivityAt({
      operation: 'update',
      newDoc: { entityType: 'contact', entityId: 'contact_123' },
    });
    expect(result.shouldUpdate).toBe(false);
  });

  it('delete operation does NOT trigger update', () => {
    const result = shouldUpdateLastActivityAt({
      operation: 'delete',
      newDoc: null,
    });
    expect(result.shouldUpdate).toBe(false);
  });
});
