## Context

CRM monorepo menggunakan Convex backend dengan multi-tenant architecture. Auth menggunakan `createAuthQuery/Mutation` (require login) dan `createPublicQuery/Mutation` (no auth). Organization scoping via `getActiveOrg()` helper. Deepsec scan menemukan 33 vulnerabilities yang sebagian besar berasal dari missing auth guards dan cross-tenant IDOR.

Key patterns di codebase:
- `ctx.table()` (convex-ents) bukan `ctx.db`
- `createOrgQuery/Mutation` = auth + org scoped
- `createAuthQuery/Mutation` = auth only, no org scope
- `createPublicQuery/Mutation` = no auth
- `roleGuard(ctx, "admin")` untuk admin-only
- `requirePermission(ctx, permission)` untuk permission check

## Goals / Non-Goals

**Goals:**
- Fix CRITICAL: hapus `getDebugEnv` yang expose secrets
- Fix HIGH: tambahkan auth guards dan org-scoping pada semua mutations/queries yang missing
- Fix HIGH_BUG: perbaiki logic bugs yang bisa corrupt data
- Fix MEDIUM: rate limiting, CORS, error message leaking
- Pastikan semua cross-tenant vectors ditutup

**Non-Goals:**
- Tidak menambah dependency baru
- Tidak mengubah schema/database structure
- Tidak mengubah UI/frontend
- Tidak membuat test suite baru (hanya fix bugs)
- Tidak mengubah auth architecture secara fundamental

## Decisions

### 1. Auth Guard Pattern
**Decision**: Gunakan pattern yang sudah ada di codebase (`createOrgQuery/Mutation`, `roleGuard`) secara konsisten. Jangan buat pattern baru.

**Rationale**: Codebase sudah punya auth helpers yang solid. Masalahnya adalah beberapa functions menggunakan `createPublicQuery/Mutation` atau raw `query`/`mutation` yang seharusnya menggunakan auth variant.

### 2. Debug & Test Endpoints
**Decision**: Hapus `convex/debug.ts` sepenuhnya. Guard `convex/createTestSession.ts` dengan environment check (`process.env.NODE_ENV !== 'production'`).

**Rationale**: Debug endpoint yang expose env vars tidak boleh ada di production. Test session hanya berguna di development.

### 3. Cross-Tenant IDOR Fix Strategy
**Decision**: Setiap mutation/query yang menerima `organizationId` dari client harus diverifikasi bahwa user adalah member of that org. Gunakan existing `getActiveOrg()` + membership check.

**Rationale**: Banyak findings menunjukkan client bisa mengirim `organizationId` arbitrary. Fix: selalu derive dari authenticated session, jangan trust client input.

### 4. SSRF Mitigation
**Decision**: Validate URL pada **write time** (create + update), bukan hanya saat create. Tambahkan DNS resolution check untuk mencegah rebinding.

**Rationale**: Bug `externalPlugins.ts` validasi URL hanya saat create, tidak saat update. Fix: shared validation function yang dipanggil di kedua path.

### 5. Rate Limiting
**Decision**: Gunakan existing `rateLimitGuard` dari `convex/helpers/rateLimiter.ts` pada public endpoints (aiChat, attendance).

**Rationale**: Helper sudah ada, tinggal apply pada endpoints yang missing.

### 6. Formula Sandboxing
**Decision**: Replace `new Function('return ' + formula)` dengan custom safe math parser yang hanya mengizinkan: angka, variabel, operators (+, -, *, /, %), parentheses, dan min/max/round functions.

**Rationale**: `new Function()` adalah eval-equivalent — bisa mengeksekusi arbitrary JavaScript. Safe math parser menghilangkan RCE risk tanpa mengubah formula DSL secara fundamental.

### 7. Logic Bug Fixes
**Decision**: Fix per-case — invoice duplicate check via unique index query, payment cancellation recalculation, paginate shift conflict check, paginate template deletion.

**Rationale**: Setiap bug punya root cause berbeda, tidak ada one-size-fits-all fix.

## Risks / Trade-offs

- **Breaking changes**: `getDebugEnv` dan `createTestSession` removal bisa break dev workflow → guard dengan env check, jangan hapus total
- **Performance**: Pagination pada template deletion dan shift check bisa slightly slower → acceptable trade-off untuk correctness
- **False positives**: Beberapa MEDIUM findings mungkin acceptable risk (localhost CORS, email case) → review per-case saat implementasi
- **Rate limiting granularity**: Mungkin terlalu aggressive untuk legitimate users → monitor dan adjust limits setelah deploy
