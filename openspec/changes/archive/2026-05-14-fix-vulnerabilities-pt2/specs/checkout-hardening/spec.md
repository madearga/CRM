## ADDED Requirements

### Requirement: Product-organization validation during checkout
Checkout harus memvalidasi bahwa semua product di cart belongs to organization yang sama.

#### Scenario: Cross-tenant stock manipulation blocked
- **WHEN** cart mengandung product dari organization berbeda
- **THEN** checkout throw error — semua product harus dari org yang sama

### Requirement: Webhook order orgId scoping
Webhook yang memproses orders harus scope by `organizationId`, bukan hanya `orderNumber`.

#### Scenario: Cross-tenant webhook blocked
- **WHEN** webhook diterima dengan `orderNumber` tapi organizationId berbeda
- **THEN** webhook reject — orderNumber + organizationId kedua-duanya harus match

### Requirement: Checkout rate limiting
`initiateCheckout` harus memiliki rate limiting untuk mencegah inventory lock abuse.

#### Scenario: Checkout rate limited
- **WHEN** user memanggil checkout melebihi rate limit
- **THEN** return 429 — lindungi inventory dari abuse

### Requirement: Order status permission check
`updateOrderStatus` harus memvalidasi bahwa caller adalah admin/owner, bukan any org member.

#### Scenario: Unauthorized order status change blocked
- **WHEN** regular org member mencoba mengubah order status
- **THEN** return error "insufficient permissions" — hanya admin/owner yang boleh

### Requirement: Order cancel idempotency
`updateOrderStatus` harus memiliki idempotency check — repeated cancel/expire tidak boleh inflate stock.

#### Scenario: Repeated cancel rejected
- **WHEN** order sudah cancelled, lalu di-cancel lagi
- **THEN** second cancel di-reject — stock tidak di-return dua kali

### Requirement: Cancel order button fix
Cancel order button di UI harus benar-benar memanggil cancel mutation.

#### Scenario: Cancel order works
- **WHEN** user klik "Cancel Order" button
- **THEN** order benar-benar di-cancel (tidak hanya toast sukses)
