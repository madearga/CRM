## Why

Deepsec vulnerability scan menemukan 35 findings (1 CRITICAL, 12 HIGH, 4 HIGH_BUG, 14 MEDIUM, 4 BUG) yang perlu ditangani sebelum production. Temuan utama: secret exposure tanpa auth, cross-tenant IDOR, missing auth guards, dan SSRF vectors.

## What Changes

### CRITICAL
- **Hapus `convex/debug.ts` `getDebugEnv`** — query tanpa auth yang mengekspos semua env vars termasuk auth signing key

### HIGH — Auth & Access Control
- **`convex/admin.ts`**: Non-admin bisa enumerate semua user — tambahkan admin-only guard
- **`convex/authHelpers.ts`**: `getActiveOrg` menerima org yang bukan milik user — validasi membership
- **`convex/createTestSession.ts`**: Mutation tanpa auth bisa forge session — guard dengan environment check atau hapus
- **`convex/emails.tsx`**: Action tanpa auth bisa kirim email arbitrer — tambahkan auth guard
- **`convex/organization.ts`**: Role update & invitation template tidak scoped ke active org — fix cross-tenant IDOR
- **`convex/hrAttendance.ts`**: `clockOutFromWhatsApp` accept attacker-controlled `organizationId` — validasi ownership

### HIGH — SSRF
- **`convex/externalPlugins.ts`**: URL update bypass SSRF validation — validate on write, not just on create
- **`convex/http.ts`**: Plugin webhook handler SSRF — tambahkan DNS resolution check

### HIGH — RCE
- **`convex/pricelists.ts`**: `new Function('return ' + formula)()` mengeksekusi arbitrary JavaScript — sanitize atau replace dengan safe evaluator

### HIGH — Cross-Tenant / IDOR
- **`convex/activities.ts`**: Activity entity IDs bisa corrupt contacts di tenant lain — scope ke active org
- **`convex/aiChatHistory.ts`**: AI chat org-scoped tapi tidak user-scoped — tambahkan user filter

### HIGH_BUG — Logic Bugs
- **`convex/hrAttendance.ts`**: `autoCloseOpenRecords` unbounded cross-tenant scan dengan hard limit — scope ke org
- **`convex/invoices.ts`**: Duplicate invoice untuk SO yang sama + header-line mismatch — tambahkan unique check
- **`convex/payments.ts`**: Payment cancellation corrupt `amountDue` — fix calculation
- **`convex/permissionTemplates.ts`**: `deleteTemplate` skip members beyond `.take(500)` — paginate properly

### MEDIUM
- **`convex/aiChat.ts`**: CORS bypass via suffix-matching + no rate limiting pada paid LLM endpoint
- **`convex/auth.ts`**: Localhost trusted in production + admin email case sensitivity
- **`convex/hrAttendance.ts`**: Guessable QR codes + no rate limiting pada public endpoints
- **`convex/hrEmployees.ts`**: `userId` tidak diverifikasi belongs to org
- **`convex/http.ts`**: Webhook handler leaks internal error messages
- **`convex/organization.ts`**: Invitation overview exposes details tanpa recipient check
- **`convex/payments.ts`**: `companyId` tidak divalidasi against org
- **`convex/pricelists.ts`**: Cross-tenant pricelist data leak via unvalidated `companyId` in price resolution
- **`convex/subscriptions.ts`**: Foreign key IDs diterima tanpa org ownership validation — scope ke active org

### BUG
- **`convex/hrShiftAssignments.ts`**: Shift conflict check miss assignments beyond `.take(200)`
- **`convex/invoices.ts`**: `createFromSaleOrder` stores SO subtotals instead of recalculated + missing `invoiceDate` param
- **`convex/plugins.ts`**: `publicSlug` uniqueness race condition on update
- **`convex/subscriptions.ts`**: `update` mutation tidak recalculate `nextBillingDate` saat billing schedule berubah

## Capabilities

### New Capabilities
- `auth-hardening`: Per-file auth guard fixes — debug.ts removal, admin guard, session forge protection, email auth, cross-tenant org validation
- `idor-fixes`: Cross-tenant IDOR fixes — activities, aiChatHistory, attendance, organization role/templates, employees, payments
- `ssrf-mitigation`: SSRF validation on external plugins URL update + webhook handler + DNS rebinding protection
- `formula-sandboxing`: Replace `new Function()` formula evaluation with safe math parser + pricelist companyId org validation
- `logic-bug-fixes`: Invoice duplication, payment cancellation, shift conflict, template deletion, slug uniqueness

### Modified Capabilities
- `ai-chat-backend`: Rate limiting pada LLM endpoint + CORS fix + user-scoped chat history

## Impact

- **Files affected**: `convex/debug.ts`, `convex/admin.ts`, `convex/authHelpers.ts`, `convex/createTestSession.ts`, `convex/emails.tsx`, `convex/externalPlugins.ts`, `convex/http.ts`, `convex/activities.ts`, `convex/aiChatHistory.ts`, `convex/aiChat.ts`, `convex/auth.ts`, `convex/hrAttendance.ts`, `convex/hrEmployees.ts`, `convex/invoices.ts`, `convex/organization.ts`, `convex/payments.ts`, `convex/permissionTemplates.ts`, `convex/hrShiftAssignments.ts`, `convex/plugins.ts`, `convex/pricelists.ts`, `convex/subscriptions.ts`
- **API changes**: Beberapa public queries/mutations akan require auth atau tambahkan parameter validation
- ****BREAKING** `convex/debug.ts`**: `getDebugEnv` akan dihapus — dev-only, tidak boleh ada di production
- ****BREAKING** `convex/createTestSession.ts`**: Akan di-guard atau dihapus — hanya untuk testing
- **Dependencies**: Tidak ada dependency baru yang dibutuhkan
