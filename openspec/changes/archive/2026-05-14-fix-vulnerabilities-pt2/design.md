## Context

Deepsec scan lanjutan (113/252 analyzed) menemukan 23 temuan baru di area e-commerce yang belum tersentuh oleh fix security sebelumnya. Area yang terpengaruh: cart system, checkout flow, order management, product endpoints, dan infrastructure leaks. Codebase menggunakan Convex dengan auth primitives `createAuthQuery/Mutation`, `createOrgQuery/Mutation`, `createPublicQuery/Mutation`.

## Goals / Non-Goals

**Goals:**
- Fix HIGH_BUG: restore broken review, cancel order, guest access functionality
- Fix MEDIUM: add cross-tenant scoping and auth pada cart/checkout mutations
- Fix MEDIUM: sanitize public product data exposure, fix timing leak
- Fix infrastructure: remove committed creds, fix command injection, webhook signature

**Non-Goals:**
- Tidak mengubah schema/database structure (tapi mungkin tambah index untuk cart org-scoping)
- Tidak mengubah UI secara visual (hanya functional fixes)
- Tidak menyentuh area yang sudah difix sebelumnya

## Decisions

### 1. Cart Auth Strategy
**Decision**: Convert cart mutations dari `createPublicMutation` ke `createAuthMutation` atau tambahkan auth guard. Guest cart akan pakai session-based flow yang sudah ada.

**Rationale**: Semua cart mutations saat ini tanpa auth — risk abuse dan cross-tenant manipulation.

### 2. Guest Access Fixes
**Decision**: Guest order/payment access akan diverifikasi via session token atau order-specific token, bukan via auth user.

**Rationale**: Guest user memang tidak punya account auth. Butuh mechanism alternatif untuk verification (order token, session ID).

### 3. Webhook Security
**Decision**: `SERVER_KEY` env var harus diverifikasi tidak empty. Validation added on startup. Webhook handler tambahkan orgId scoping.

**Rationale**: Empty server key enables webhook signature forgery.

### 4. Infrastructure Fixes
**Decision**: Session export HTML files added to `.gitignore`. `sync-convex-env.ts` sanitize .env values atau ganti ke safe string building.

**Rationale**: Credential leaks dalam VCS adalah immediate risk. Command injection melalui .env values sama risk-nya.

## Risks / Trade-offs

- **Cart auth**: Guest users perlu mechanism alternatif — butuh session token flow
- **Performance**: Rate limiting pada checkout bisa impact legitimate users → monitor
- **Webhook**: Tightened validation bisa break existing external integrations → test carefully
