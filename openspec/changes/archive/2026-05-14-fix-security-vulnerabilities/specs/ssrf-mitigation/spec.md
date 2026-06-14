## ADDED Requirements

### Requirement: External plugin URL validation on update
`convex/externalPlugins.ts` update mutation harus menjalankan `validateExternalUrl` saat mengubah URL, bukan hanya saat create.

#### Scenario: SSRF via URL update blocked
- **WHEN** user mengubah external plugin URL ke internal IP/domain
- **THEN** mutation reject — validateExternalUrl dipanggil pada update path juga

### Requirement: DNS rebinding protection
`validateExternalUrl` harus resolve DNS hostname sebelum memvalidasi, untuk mencegah DNS rebinding attacks.

#### Scenario: DNS rebinding attack blocked
- **WHEN** URL hostname resolves ke internal IP setelah validation
- **THEN** validation check DNS resolution result, block internal/private IPs

### Requirement: Webhook handler error message sanitization
`convex/http.ts` plugin webhook handler harus return generic error message, bukan internal error details.

#### Scenario: Internal errors not leaked
- **WHEN** webhook handler encounter error
- **THEN** return generic "webhook processing failed" tanpa stack trace atau internal details

### Requirement: HTTP plugin endpoint SSRF validation
`convex/http.ts` route handler untuk external plugins harus validate URLs sebelum membuat outgoing requests.

#### Scenario: Plugin endpoint SSRF blocked
- **WHEN** plugin webhook trigger membuat request ke URL yang tidak tervalidasi
- **THEN** request blocked — URL must pass SSRF validation
