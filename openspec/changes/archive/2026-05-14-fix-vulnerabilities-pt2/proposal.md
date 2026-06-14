## Why

Deepsec scan lanjutan menemukan 23 findings baru di area yang belum tersentuh oleh fix sebelumnya: e-commerce/checkout system, cart management, order processing, product endpoints, dan infrastructure leaks. Temuan utama: guest user access control failures, unauthenticated cart/checkout mutations, webhook signature forgery, command injection vectors, dan credential leaks.

## What Changes

### HIGH — Credential & Session Leaks
- **Convex deployment credential leaked** di git-tracked pi session export HTML — hapus file atau tambahkan ke `.gitignore`

### HIGH_BUG — E-Commerce Critical Bugs
- **Review mutation broken** — argument mismatch bikin approve/reject tidak berfungsi (`page.tsx`)
- **Cancel Order button broken** — toast sukses tapi tidak benar-benar cancel order (`page.tsx`)
- **Guest users cannot check payment status** — `getPaymentStatus` tidak bisa diakses guest (`checkout.ts`)
- **Guest users cannot view own orders** — order detail tidak accessible untuk guest (`orders.ts`)
- **updateOrderStatus no idempotency check** — repeated cancel/expire inflates stock (`orders.ts`)

### MEDIUM — Cart & Checkout Security
- **Stored XSS** via company website rendered as unsanitized href (`page.tsx`)
- **Cross-tenant cart manipulation** — session-based cart lookup tidak scoped by orgId (`cart.ts`)
- **All cart mutations unauthenticated** — tanpa rate limiting (`cart.ts`)
- **Cross-tenant cart access** — findActiveCart sessionId lookup tidak scoped (`checkout.ts`)
- **No product-org validation during checkout** — cross-tenant stock manipulation (`checkout.ts`)
- **Webhook processes orders tanpa orgId scoping** — by non-unique orderNumber (`checkout.ts`)
- **initiateCheckout no rate limiting** — unauthenticated inventory lock (`checkout.ts`)
- **updateOrderStatus any org member can change** — no role/permission check (`orders.ts`)

### MEDIUM — Product & Infrastructure
- **Public product detail endpoint exposes internal data** — cost, notes, SKU, barcode (`products.ts`)
- **Server key env var falls back to empty string** — webhook signature forgery possible (`index.ts`)
- **Command injection via unsanitized .env values** — interpolated into execSync (`sync-convex-env.ts`)
- **Developer PII & infrastructure details in session exports** — committed HTML files

### BUG
- **Order detail page uses wrong org slug** — active org instead of URL slug (`page.tsx`)
- **checkOrg endpoint timing leak** — misleading constant-time comment, measurable timing (`products.ts`)

### Already in Previous Fix (complex — carry over)
- Activity entity scoping & aiChatHistory user scoping — remain as complex IDOR tasks

## Capabilities

### New Capabilities
- `ecommerce-guest-access`: Fix guest user access untuk payment status, order detail, dan cancel order
- `cart-security`: Cross-tenant cart scoping, authentication, dan rate limiting pada cart mutations
- `checkout-hardening`: Product-org validation, webhook scoping, rate limiting, dan stock protection
- `product-data-protection`: Sanitize public product endpoint, fix timing leak
- `infrastructure-secrets`: Remove committed credential leaks, fix command injection, webhook signature

## Impact

- **Files affected**: `convex/cart.ts`, `convex/checkout.ts`, `convex/orders.ts`, `convex/products.ts`, `convex/commerce/index.ts`, `scripts/sync-convex-env.ts`, UI `page.tsx` files
- **BREAKING** None intentional — guest access fixes are additive
- **Dependencies**: Tidak ada dependency baru
- **Cross-cutting**: E-commerce flow dari cart → checkout → order → payment
