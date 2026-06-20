## ADDED Requirements

### Requirement: Remove committed credential leaks
Pi session export HTML files (pi-session-*.html) yang mengandung deployment credentials tidak boleh di-commit ke git.

#### Scenario: Session files excluded from VCS
- **WHEN** pi session export HTML dibuat
- **THEN** file tidak pernah masuk staging area — `.gitignore` mengecualikan pattern `**/pi-session-*.html`

### Requirement: Webhook server key validation
`SERVER_KEY` environment variable harus diverifikasi tidak empty saat startup. Fallback ke empty string tidak diizinkan.

#### Scenario: Empty server key blocked
- **WHEN** `SERVER_KEY` env var kosong atau tidak diset
- **THEN** aplikasi throw error pada startup — webhook tidak bisa berfungsi tanpa signature key

### Requirement: Command injection in sync-convex-env.ts prevention
`sync-convex-env.ts` tidak boleh menggunakan `execSync` dengan interpolasi langsung dari `.env` values.

#### Scenario: Malformed .env value blocked
- **WHEN** `.env` value mengandung special shell characters (`;`, `|`, `$()`, dll)
- **THEN** value di-sanitize sebelum dipassing ke shell, atau diganti dengan safe API method
