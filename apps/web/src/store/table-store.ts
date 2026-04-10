import { create } from "zustand";

interface TableState {
  selections: Record<string, Set<string>>;
  toggleOne: (tableId: string, id: string) => void;
  toggleAll: (tableId: string, allIds: string[]) => void;
  clearSelection: (tableId: string) => void;
}

const getOrCreate = (state: TableState, tableId: string): Set<string> =>
  state.selections[tableId] ?? new Set();

export const useTableStore = create<TableState>((set) => ({
  selections: {},

  toggleOne: (tableId, id) =>
    set((state) => {
      const current = getOrCreate(state, tableId);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return {
        selections: { ...state.selections, [tableId]: next },
      };
    }),

  toggleAll: (tableId, allIds) =>
    set((state) => {
      const current = getOrCreate(state, tableId);
      const allSelected = allIds.length > 0 && allIds.every((id) => current.has(id));
      return {
        selections: {
          ...state.selections,
          [tableId]: allSelected ? new Set() : new Set(allIds),
        },
      };
    }),

  clearSelection: (tableId) =>
    set((state) => ({
      selections: { ...state.selections, [tableId]: new Set() },
    })),
}));
