import { describe, it, expect, beforeEach } from 'vitest';
import { useTableStore } from '@/store/table-store';

// Helper: get fresh snapshot of store state
function getStore() {
  return useTableStore.getState();
}

describe('useTableStore', () => {
  beforeEach(() => {
    // Reset store by clearing all known keys
    const store = getStore();
    for (const key of Object.keys(store.selections)) {
      store.clearSelection(key);
    }
  });

  describe('toggleOne', () => {
    it('adds an id to an empty selection', () => {
      getStore().toggleOne('companies', 'id-1');
      expect(getStore().selections.companies).toEqual(new Set(['id-1']));
    });

    it('removes an id when toggled again', () => {
      getStore().toggleOne('companies', 'id-1');
      getStore().toggleOne('companies', 'id-1');
      expect(getStore().selections.companies).toEqual(new Set());
    });

    it('tracks selections independently per table', () => {
      getStore().toggleOne('companies', 'c-1');
      getStore().toggleOne('contacts', 'ct-1');
      expect(getStore().selections.companies).toEqual(new Set(['c-1']));
      expect(getStore().selections.contacts).toEqual(new Set(['ct-1']));
    });

    it('works with arbitrary table keys (open-ended)', () => {
      getStore().toggleOne('deals', 'd-1');
      expect(getStore().selections.deals).toEqual(new Set(['d-1']));
    });
  });

  describe('toggleAll', () => {
    it('selects all ids when none selected', () => {
      getStore().toggleAll('companies', ['id-1', 'id-2', 'id-3']);
      expect(getStore().selections.companies).toEqual(new Set(['id-1', 'id-2', 'id-3']));
    });

    it('deselects all when all are selected', () => {
      getStore().toggleAll('companies', ['id-1', 'id-2']);
      getStore().toggleAll('companies', ['id-1', 'id-2']);
      expect(getStore().selections.companies).toEqual(new Set());
    });

    it('selects all when partially selected', () => {
      getStore().toggleOne('companies', 'id-1');
      // Partially selected → toggleAll should select all
      getStore().toggleAll('companies', ['id-1', 'id-2']);
      expect(getStore().selections.companies).toEqual(new Set(['id-1', 'id-2']));
    });

    it('handles empty allIds array', () => {
      getStore().toggleAll('companies', []);
      expect(getStore().selections.companies).toEqual(new Set());
    });
  });

  describe('clearSelection', () => {
    it('clears all selections for a table', () => {
      getStore().toggleOne('companies', 'id-1');
      getStore().toggleOne('companies', 'id-2');
      expect(getStore().selections.companies.size).toBe(2);
      getStore().clearSelection('companies');
      expect(getStore().selections.companies).toEqual(new Set());
    });

    it('does not affect other tables', () => {
      getStore().toggleOne('companies', 'c-1');
      getStore().toggleOne('contacts', 'ct-1');
      getStore().clearSelection('companies');
      expect(getStore().selections.companies).toEqual(new Set());
      expect(getStore().selections.contacts).toEqual(new Set(['ct-1']));
    });
  });

  describe('mutation safety', () => {
    it('does not mutate the selection Set directly', () => {
      getStore().toggleOne('companies', 'id-1');
      const originalSet = getStore().selections.companies;
      getStore().toggleOne('companies', 'id-2');
      // Original set should be unchanged (not mutated in place)
      expect(originalSet).toEqual(new Set(['id-1']));
      expect(getStore().selections.companies).toEqual(new Set(['id-1', 'id-2']));
    });
  });
});
