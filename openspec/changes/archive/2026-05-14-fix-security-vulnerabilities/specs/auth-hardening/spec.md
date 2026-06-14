## ADDED Requirements

### Requirement: Remove debug env endpoint
`convex/debug.ts` `getDebugEnv` harus dihapus dari production. Function ini mengekspos semua environment variables termasuk auth signing key tanpa authentication.

#### Scenario: Debug endpoint not accessible in production
- **WHEN** aplikasi di-deploy ke production
- **THEN** `getDebugEnv` query tidak tersedia — file dihapus atau di-guard dengan `process.env.NODE_ENV !== 'production'`

### Requirement: Admin-only user enumeration
`convex/admin.ts` queries `getAllUsers`, `getUserById`, `searchUsers` harus dibatasi hanya untuk admin organization.

#### Scenario: Non-admin cannot list all users
- **WHEN** non-admin user memanggil admin queries
- **THEN** return error "insufficient permissions" — harus pass `roleGuard(ctx, "admin")`

### Requirement: Active org membership validation
`convex/authHelpers.ts` `getActiveOrg` harus memvalidasi bahwa user adalah member dari organization yang diminta, bukan hanya menerima org ID apapun.

#### Scenario: User cannot use unowned org as context
- **WHEN** user mengirim `organizationId` yang bukan miliknya
- **THEN** return error — getActiveOrg harus verify membership

### Requirement: Test session creation guard
`convex/createTestSession.ts` mutation harus di-guard agar hanya berfungsi di development environment.

#### Scenario: Test session blocked in production
- **WHEN** `process.env.NODE_ENV === 'production'`
- **THEN** mutation throw error "test sessions not available in production"

### Requirement: Email action auth guard
`convex/emails.tsx` `sendEmail` action harus require authentication sebelum mengirim email.

#### Scenario: Unauthenticated email blocked
- **WHEN** unauthenticated user memanggil email action
- **THEN** return error "authentication required"

### Requirement: Admin email normalization
`convex/auth.ts` admin role assignment harus normalize email ke lowercase sebelum comparison.

#### Scenario: Case-insensitive admin email match
- **WHEN** admin email diset sebagai "Admin@Example.com"
- **THEN** user dengan email "admin@example.com" tetap diakui sebagai admin
