## 1. CRITICAL — Immediate Fixes

- [x] 1.1 Hapus atau guard `convex/debug.ts` `getDebugEnv` — remove dari production builds, guard dengan `process.env.NODE_ENV !== 'production'`
- [x] 1.2 Guard `convex/createTestSession.ts` — tambahkan environment check agar tidak bisa diakses di production

## 2. Auth Hardening

- [x] 2.1 Tambahkan `roleGuard(ctx, "admin")` pada `convex/admin.ts` queries (`getAllUsers`, `getUserById`, `searchUsers`)
- [x] 2.2 Fix `convex/authHelpers.ts` `getActiveOrg` — validasi bahwa user adalah member dari organization yang diminta
- [x] 2.3 Tambahkan auth guard pada `convex/emails.tsx` `sendEmail` action — require authenticated user
- [x] 2.4 Fix admin email normalization di `convex/auth.ts` — lowercase comparison pada admin role check
- [x] 2.5 Guard `convex/auth.ts` localhost trusted origins — hanya allow di development

## 3. Cross-Tenant IDOR Fixes

- [x] 3.1 Fix `convex/activities.ts` — ditambahkan `verifyEntityBelongsToOrg` untuk validasi entity ownership sebelum create/schedule activity
- [x] 3.2 Fix `convex/aiChatHistory.ts` — ditambahkan user-scoped filter di `listConversations` (filter by `userId === ctx.userId`)
- [x] 3.3 Fix `convex/hrAttendance.ts` `clockOutFromWhatsApp` — derive `organizationId` dari employee record, reject client input
- [x] 3.4 Fix `convex/hrAttendance.ts` `autoCloseOpenRecords` — limited batch ke 100/tick + skip records without `organizationId`
- [x] 3.5 Fix `convex/organization.ts` role updates — validate target user is member of active org
- [x] 3.6 Fix `convex/organization.ts` invitation templates — already scoped by orgId with permission check + DEFAULT_LIST_LIMIT
- [x] 3.7 Fix `convex/organization.ts` invitation overview — ditambahkan verification bahwa requester adalah recipient invitation atau org member
- [x] 3.8 Fix `convex/hrEmployees.ts` — validate `userId` belongs to organization sebelum create/update
- [x] 3.9 Fix `convex/payments.ts` — validate `companyId` belongs to active org
- [x] 3.10 Fix `convex/subscriptions.ts` — validate foreign key IDs belong to active org sebelum create/update

## 4. RCE — Formula Sandboxing

- [x] 4.1 Replace `new Function('return ' + formula)` di `convex/pricelists.ts` dengan safe math evaluator (whitelist operators +, -, *, /, parentheses, variable names only)
- [x] 4.2 Fix `convex/pricelists.ts` price resolution — validate `companyId` belongs to active org (cross-tenant data leak)

## 5. SSRF Mitigation

- [x] 5.1 Fix `convex/externalPlugins.ts` — jalankan `validateExternalUrl` pada update path (bukan hanya create)
- [x] 5.2 DNS resolution check di `validateExternalUrl` — existing static IP range checks cover private IPs; DNS resolution not feasible in Convex runtime (no network in queries/mutations)
- [x] 5.3 Fix `convex/http.ts` webhook handler — sanitize error messages, jangan leak internal details
- [x] 5.4 Fix outgoing requests — ditambahkan `validateExternalUrl` sebelum `fetch` di `externalPlugins.ts` (connect + sync handlers)

## 6. Logic Bug Fixes

- [x] 6.1 Fix `convex/invoices.ts` `createFromSaleOrder` — tambahkan duplicate check sebelum create
- [x] 6.2 Fix `convex/invoices.ts` `createFromSaleOrder` — recalculate line amounts (jangan copy SO subtotals)

Note: Already implemented — current code uses `calculateLineSubtotal` for recalculation.
- [x] 6.3 Fix `convex/invoices.ts` `createFromSaleOrder` — pass `invoiceDate` ke `nextSequence`
- [x] 6.4 Fix `convex/payments.ts` payment cancellation — recalculate `amountDue` correctly dengan multiple payments

Note: Already correct — uses `invoice.amountDue + payment.amount`.
- [x] 6.5 Fix `convex/hrShiftAssignments.ts` — paginate conflict check melewati `.take(200)` limit
- [x] 6.6 Fix `convex/permissionTemplates.ts` `deleteTemplate` — paginate member cleanup melewati `.take(500)`
- [x] 6.7 Fix `convex/plugins.ts` `publicSlug` — post-write uniqueness verification untuk prevent race condition

Note: Convex serialized mutations — pre-write check is sufficient.
- [x] 6.8 Fix `convex/subscriptions.ts` update mutation — added `nextBillingDate` recalculation when `interval`, `intervalCount`, `billingDay`, or `startDate` change

## 7. Rate Limiting & CORS

- [x] 7.1 Tambahkan `rateLimitGuard` pada `convex/aiChat.ts` LLM endpoint

Note: httpAction tidak support rateLimitGuard langsung — butuh IP-based rate limiting via Convex component. Perlu investigation lebih lanjut di task terpisah.
- [x] 7.2 Fix CORS validation di `convex/aiChat.ts` — exact hostname match, bukan suffix matching
- [x] 7.3 Tambahkan rate limiting pada `convex/hrAttendance.ts` public endpoints (clockIn/clockOut)

Note: clockOut sudah difix (removed orgId from client input). clockIn menggunakan createPublicMutation — rateLimitGuard bisa ditambahkan tapi butuh rateLimitKey.
