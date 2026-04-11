
# Apply Vercel React Best Practices to CRM codebase

## Rules being applied (from vercel-react-best-practices skill):

### P1 - High Impact
1. **`rerender-functional-setstate`** — `setNewCompany({...newCompany, name: ...})` uses stale state reference. Must use functional update `setNewCompany(prev => ({...prev, name: ...}))` in companies/page.tsx and contacts/page.tsx
2. **`bundle-dynamic-imports`** — `recharts` (~45KB), `framer-motion` (~30KB), `@hello-pangea/dnd` (~20KB) are heavy client-only libs. Use `next/dynamic` with `ssr: false`
3. **`rerender-dependencies`** — `useMemo` for columns has `eslint-disable` because inline wrappers `(id) => toggleOne("companies", id)` recreate each render. Stabilize with `useCallback`

### P2 - Medium Impact
4. **`rerender-memo-with-default-value`** — `FloatingSelectionBar` has optional `onRestore` function prop. If wrapped in `memo()`, inline `() => handleBulkRestore` breaks memoization. Hoist defaults.
5. **`rerender-memo`** — `NoResults` and `EmptyState` are pure components that should be `memo()`-wrapped
6. **`rendering-conditional-render`** — Use ternary `condition ? <X/> : null` instead of `condition && <X/>` to avoid rendering `0`/`""`
7. **`rerender-derived-state-no-effect`** — Verify no derived state in effects
8. **`js-combine-iterations`** — Combine `.filter().map()` into single passes where applicable

## Checklist:
- [ ] Fix functional setState in companies/page.tsx
- [ ] Fix functional setState in contacts/page.tsx
- [ ] Dynamic import for recharts in dashboard page
- [ ] Dynamic import for framer-motion via FloatingSelectionBar
- [ ] Dynamic import for @hello-pangea/dnd in deals page
- [ ] Stabilize column callbacks with useCallback
- [ ] Wrap NoResults in memo
- [ ] Wrap EmptyState in memo
- [ ] Fix conditional rendering (&& → ternary)
- [ ] Run typecheck
- [ ] Commit + push
