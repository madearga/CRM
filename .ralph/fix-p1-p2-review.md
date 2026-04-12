# Fix P1 + P2 Review Issues

## P1 (Must Fix)
1. **Category FK** — change `products.category` from `v.string()` to `v.optional(v.id('productCategories'))` in schema, update all backend + frontend references
2. **Money utilities** — integrate `formatMoney()` from `money.ts` in frontend instead of hardcoded `Rp ${...}`
3. **Audit logging** — add `createAuditLog()` calls in product/category/variant mutations

## P2 (Should Fix)
4. **Post-pagination filtering** — use search index with filterFields when type/category specified without search
5. **CSV import** — add batch progress tracking and error collection
6. **Dead code** — keep workflowEngine + sequenceGenerator (future sprint), add note
7. **Duplicate category names** — add uniqueness check on create/update

## Files to modify:
- `convex/schema.ts` — category FK
- `convex/products.ts` — category FK, audit logging, pagination fix
- `convex/productCategories.ts` — audit logging, dup check
- `convex/productVariants.ts` — audit logging
- `convex/shared/money.ts` — update formatMoney for IDR (no division since IDR stored as-is)
- `apps/web/src/components/products/product-form.tsx` — category FK dropdown
- `apps/web/src/app/(dashboard)/products/columns.tsx` — money formatting
- `apps/web/src/app/(dashboard)/products/[id]/page.tsx` — money formatting
- `apps/web/src/components/products/variant-manager.tsx` — money formatting
- `apps/web/src/app/(dashboard)/products/page.tsx` — CSV import improvement
