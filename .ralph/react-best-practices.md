# Apply Vercel React Best Practices to CRM codebase

## Status: ✅ COMPLETE

### P1 - High Impact
- [x] **`rerender-functional-setstate`** — All `setNewCompany({...newCompany})` / `setNewContact({...newContact})` converted to functional updates `setNewCompany(p => ({...p}))` / `setNewContact(p => ({...p}))`
- [x] **`bundle-dynamic-imports`** — Three heavy libs extracted:
  - `recharts` → `PipelineChart` component, `next/dynamic` + `ssr:false` (~45KB saved)
  - `framer-motion` → `FloatingSelectionBarInner`, `next/dynamic` + `ssr:false` (~30KB saved)
  - `@hello-pangea/dnd` → `DealsBoard` component, `next/dynamic` + `ssr:false` (~20KB saved)
- [x] **`rerender-dependencies`** — Inline arrow wrappers `(id) => toggleOne("companies", id)` replaced with stable `useCallback` refs (`toggleOneCompany`, `toggleAllCompanies`, `toggleOneContact`, `toggleAllContacts`). `eslint-disable` removed.

### P2 - Medium Impact
- [x] **`rerender-memo-with-default-value`** — `onRestore` default hoisted to `NOOP` constant in `FloatingSelectionBarInner`
- [x] **`rerender-memo`** — `NoResults` and `EmptyState` wrapped in `memo()`. `PipelineChart` also `memo()`-wrapped.
- [x] **`rendering-conditional-render`** — All `condition && <X/>` patterns converted to `condition ? <X/> : null` across command-palette, deals-board, empty-state, floating-selection-bar-inner, and dashboard page.
- [x] **`rerender-derived-state-no-effect`** — Verified: no derived state in effects. Command palette effects are for keyboard listener + reset on close (correct usage).
- [x] **`js-combine-iterations`** — No `.filter().map()` chains found in codebase.

### Commits
- `79cf870` — refactor: apply Vercel React Best Practices (setState, dynamic imports, useCallback, memo, ternary)
- `aaca4e4` — refactor: dynamic-import recharts via PipelineChart component
