## ADDED Requirements

### Requirement: Public product endpoint data sanitization
Public product detail endpoint tidak boleh mengekspos internal business data (cost, notes, SKU, barcode) ke unauthorized users.

#### Scenario: Internal data hidden from public
- **WHEN** user yang tidak authenticated atau bukan org member mengakses product detail
- **THEN** hanya menampilkan public fields (name, price, description) — hide cost, SKU, barcode, notes

### Requirement: checkOrg timing leak fix
`checkOrg` endpoint harus menggunakan constant-time comparison, bukan sequential character matching.

#### Scenario: Timing leak mitigated
- **WHEN** attacker mengirim berbagai org slugs dan mengukur response time
- **THEN** response time konsisten terlepas dari match/mismatch — tidak bisa membedakan valid/invalid slugs via timing

### Requirement: Stored XSS prevention
Company website URL yang dirender di UI harus disanitasi — bukan raw href attribute.

#### Scenario: XSS via company website blocked
- **WHEN** admin mengisi company website dengan `javascript:alert(1)`
- **THEN** rendering di UI menggunakan sanitized URL (https-only, no javascript: protocol)

### Requirement: Review mutation argument fix
Review approve/reject mutation harus menerima dan memproses arguments dengan benar.

#### Scenario: Review approve works
- **WHEN** admin approve review
- **THEN** review status berubah menjadi "approved" — bukan error argument mismatch
