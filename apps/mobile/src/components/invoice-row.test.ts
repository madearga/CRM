/**
 * Regression tests for the `isInvoiceOverdue` classifier.
 *
 * Overdue = posted + unpaid (amountDue > 0) + dueDate in the past. The badge
 * math relies on this exact conjunction, so a drift here changes what reps
 * see in the list. `now` is injected for determinism.
 *
 * The classifier is pure logic but lives next to the RN component, so we stub
 * the React Native + UI deps before importing — that keeps vitest from parsing
 * the Flow-dialect `react-native` source. We assert behavior only.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', () => ({ memo: (x: unknown) => x }));
vi.mock('react-native', () => ({ Pressable: () => null, View: () => null }));
vi.mock('@/components/ui/badge', () => ({ Badge: () => null }));
vi.mock('@/components/ui/text', () => ({ Text: () => null }));
vi.mock('@/lib/format-date', () => ({ format: () => '' }));
vi.mock('@/lib/format-money', () => ({ formatMoney: () => '' }));

import { type InvoiceRowItem, isInvoiceOverdue } from './invoice-row';

const now = 1_700_000_000_000;

function base(overrides: Partial<InvoiceRowItem> = {}): InvoiceRowItem {
  return {
    id: 'inv_1',
    number: 'INV-001',
    state: 'posted',
    dueDate: now - 86_400_000,
    totalAmount: 1000,
    amountDue: 500,
    currency: 'USD',
    companyName: 'Acme',
    ...overrides,
  };
}

describe('isInvoiceOverdue', () => {
  it('is true when posted, unpaid, and dueDate is in the past', () => {
    expect(isInvoiceOverdue(base(), now)).toBe(true);
  });

  it('is false when dueDate is in the future', () => {
    expect(isInvoiceOverdue(base({ dueDate: now + 86_400_000 }), now)).toBe(false);
  });

  it('is false when dueDate is undefined (the typeof guard)', () => {
    expect(isInvoiceOverdue(base({ dueDate: undefined }), now)).toBe(false);
  });

  it('is false when amountDue is 0 (already paid)', () => {
    expect(isInvoiceOverdue(base({ amountDue: 0 }), now)).toBe(false);
  });

  it('is false when state is not "posted" (e.g. draft)', () => {
    expect(isInvoiceOverdue(base({ state: 'draft' }), now)).toBe(false);
  });

  it('is false when dueDate exactly equals now (strict <, not <=)', () => {
    expect(isInvoiceOverdue(base({ dueDate: now }), now)).toBe(false);
  });
});
