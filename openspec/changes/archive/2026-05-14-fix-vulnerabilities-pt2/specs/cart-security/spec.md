## ADDED Requirements

### Requirement: Cart mutations authentication
Semua cart mutations (add, update, remove, clear) harus menggunakan `createAuthMutation` — guest cart pakai session-based identification.

#### Scenario: Unauthenticated cart blocked
- **WHEN** request tanpa auth token memanggil cart mutation
- **THEN** return error "authentication required"

### Requirement: Cross-tenant cart scoping
Session-based cart lookup (`findActiveCart`) harus di-scope by `organizationId` untuk mencegah cross-tenant cart manipulation.

#### Scenario: Cross-tenant cart access blocked
- **WHEN** user dengan session mencoba akses cart dari organization lain
- **THEN** cart lookup filter by `organizationId` — return empty jika tidak match

### Requirement: Cart rate limiting
Semua cart mutations harus memiliki rate limiting.

#### Scenario: Cart mutation rate limited
- **WHEN** user melebihi batas cart mutations per time window
- **THEN** return 429 "rate limit exceeded"
