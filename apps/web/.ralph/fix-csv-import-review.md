# Fix CSV Import Code Review Findings

Fix all issues from code review for CSV import contacts feature.

## Issues to fix (ordered by severity):

### Critical
1. **Intra-batch duplicate emails** — Add `Set<string>` tracking in `bulkCreate` mutation (`convex/contacts.ts`). Before DB check, check if email already seen in batch. If yes, push to errors with reason "Duplicate email in import" and continue.
2. **No file size limit** — Add `file.size > 5MB` check in `step-upload.tsx` before calling `onFileSelected`. Also add check in `use-csv-import.ts` `parseFile`.

### Important
3. **Missing `@types/papaparse`** — Run `pnpm add -D @types/papaparse` in root.
4. **`lifecycleStage` silent drop** — In `validateRows` in `use-csv-import.ts`, if lifecycleStage mapped but value invalid, mark row as invalid or show warning in preview.
5. **No error toast on import failure** — Add `toast.error()` in `use-csv-import.ts` catch block. Import `toast` from `sonner`.
6. **500 sequential DB ops** — Optimize `bulkCreate` in `convex/contacts.ts`: pre-fetch all existing emails in org, pre-fetch all matching companies in one pass, then loop for inserts only.
7. **Zero tests** — Add unit tests for `autoMapColumns`, `validateRows`, `getMappedContact` in `apps/web/src/components/csv-import/__tests__/csv-import.test.ts`. Add test for `bulkCreate` logic in `convex/__tests__/contacts.test.ts`.

### Minor
8. **Raw HTML elements** — Replace `<select>` with shadcn `Select` in `step-map-columns.tsx`. Replace raw `<button>` with `<Button>` in `import-contacts-dialog.tsx`.
9. **No loading state during parse** — Add loading spinner in `step-upload.tsx` while parsing.
10. **Dialog close during import** — Prevent dialog close while `isImporting` is true.
11. **`notes` length limit** — Add validation in `validateRows` or `getMappedContact` to truncate notes > 5000 chars.

## Files to modify:
- `convex/contacts.ts` — bulkCreate optimization + intra-batch dedup
- `apps/web/src/components/csv-import/use-csv-import.ts` — file size, lifecycleStage validation, toast, notes limit
- `apps/web/src/components/csv-import/step-upload.tsx` — file size check, loading state
- `apps/web/src/components/csv-import/step-map-columns.tsx` — shadcn Select
- `apps/web/src/app/(dashboard)/contacts/import-contacts-dialog.tsx` — shadcn Button, prevent close
- New test files

## Verification:
- Run `npx convex typecheck` after backend changes
- Run `npx tsc --noEmit` in apps/web after frontend changes  
- Run tests with `pnpm test`
- Commit after each batch of fixes
