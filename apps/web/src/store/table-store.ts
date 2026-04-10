import { create } from "zustand";

type TableId = "companies" | "contacts";

interface TableState {
  selections: Record<TableId, Set<string>>;
  toggleOne: (tableId: TableId, id: string) => void;
  toggleAll: (tableId: TableId, allIds: string[]) => void;
  clearSelection: (tableId: TableId) => void;
  getSelectedIds: (tableId: TableId) => Set<string>;
}

export const useTableStore = create<TableState>((set, get) => ({
  selections: {
    companies: new Set(),
    contacts: new Set(),
  },

  toggleOne: (tableId, id) =>
    set((state) => {
      const next = new Set(state.selections[tableId]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return {
        selections: { ...state.selections, [tableId]: next },
      };
    }),

  toggleAll: (tableId, allIds) =>
    set((state) => {
      const current = state.selections[tableId];
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

  getSelectedIds: (tableId) => get().selections[tableId],
}));
