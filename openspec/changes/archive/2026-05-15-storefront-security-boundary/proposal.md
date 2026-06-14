## Why

CRM ini juga berfungsi sebagai online shop, jadi security model tidak bisa disederhanakan menjadi “semua harus login”. Storefront perlu tetap mendukung guest checkout, tetapi harus punya boundary keamanan yang eksplisit agar cart, checkout, order detail, payment status, dan cancel order tidak bergantung pada order number atau sessionId yang mudah disalahgunakan.

## What Changes

- Introduce a clear separation between **CRM/Admin private access**, **Storefront guest access**, and **Payment webhook access**.
- Add a reusable storefront security layer for session validation, order access token validation, cart ownership, and order state transitions.
- Keep guest checkout supported, but require `sessionId + organizationSlug` for cart access and `orderAccessToken` for post-checkout order actions.
- Replace ad-hoc order status updates with an idempotent order transition helper.
- Harden checkout and webhook flows with organization-scoped lookups and product-org validation.
- Add URL/data sanitization for public storefront output.

## Capabilities

### New Capabilities
- `storefront-security-boundary`: Defines the shared access model for public storefront, authenticated CRM, and webhook flows.
- `guest-order-access`: Order access token model for guest order detail, payment status, and cancellation.
- `cart-access-control`: Dual-mode cart access for authenticated users and guest sessions.
- `order-state-machine`: Idempotent status transitions and stock movement rules.
- `storefront-public-data`: Public product/company data sanitization and safe URL rendering.

### Modified Capabilities
- `checkout-hardening`: Use shared storefront boundaries for checkout, webhook, and stock validation.

## Impact

- **Backend**: `convex/commerce/cart.ts`, `checkout.ts`, `orders.ts`, `products.ts`, payment provider code.
- **Frontend**: storefront order/cart pages and company website rendering.
- **Data**: may require adding `orderAccessTokenHash`, `orderAccessTokenExpiresAt`, and indexes for `organizationId + sessionId` cart lookup.
- **Security posture**: replaces one-off guards with a sustainable boundary model.
