## 1. Security Primitives

- [x] 1.1 Create `convex/commerce/security.ts` with helpers for storefront session, order token, cart access, and admin order access
- [x] 1.2 Add token hashing utilities for guest order access tokens
- [x] 1.3 Add public DTO builders for storefront product/company/order responses

## 2. Guest Order Access

- [x] 2.1 Generate order access token during guest checkout and store token hash
- [x] 2.2 Add token verification to guest order detail endpoint
- [x] 2.3 Add token verification to payment status endpoint
- [x] 2.4 Add token verification and state checks to guest cancel endpoint

## 3. Cart Access Control

- [x] 3.1 Change session cart lookup to include organizationId + sessionId
- [x] 3.2 Apply `requireCartAccess` to add/update/remove/clear cart mutations
- [x] 3.3 Add rate limiting to guest cart mutations by orgId + sessionId

## 4. Checkout and Webhook Hardening

- [x] 4.1 Validate every checkout product belongs to storefront organization before stock/payment changes
- [x] 4.2 Replace direct order status patches with `transitionOrderStatus`
- [x] 4.3 Make cancel/expire idempotent and stock-safe
- [x] 4.4 Scope webhook order lookup by provider transaction binding or organization metadata

## 5. Public Data and Frontend Fixes

- [x] 5.1 Use public product DTOs in storefront product detail endpoints
- [x] 5.2 Sanitize company website URL before rendering in page components
- [x] 5.3 Fix storefront cancel order button to call the correct mutation
- [x] 5.4 Fix review approve/reject mutation argument mismatch

## 6. Verification

- [x] 6.1 Run typecheck/lint
- [ ] 6.2 Re-run deepsec on commerce files
- [ ] 6.3 Manually test guest checkout → order detail → payment status → cancel flow

> **Note**: These are operational/verification tasks requiring manual testing or tool execution.
