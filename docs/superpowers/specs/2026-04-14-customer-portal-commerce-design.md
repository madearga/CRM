# Customer Portal & Headless Commerce — Design Spec

**Date:** 2026-04-14
**Status:** Approved
**Phases:** 3 (Portal → Store Integration → Full Headless)

---

## Overview

Add a customer-facing e-commerce portal to the CRM app and build a headless commerce API that can later be connected to external online stores (e.g., teluromegaJE). The CRM becomes a central hub: customers buy from the built-in portal, and external stores sync orders via API/webhook.

### Goals

- Customers can browse products, add to cart, checkout, and pay — all from the CRM portal
- Commerce backend is headless from day 1 — all logic in Convex functions, no UI coupling
- Pluggable payment gateway (Midtrans first, Stripe/others later)
- Store integration ready for Phase 2 (embeddable plugin/webhook for external stores)
- One auth system shared between CRM dashboard and shop portal

### Non-Goals (Phase 1)

- Two-way product sync (only one-way: store → CRM, later)
- Embeddable widget/script tag (Phase 3)
- Shipping provider integration (flat rate / free shipping only)
- Email notifications (later)
- Product reviews/ratings (later)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Convex Backend                     │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Commerce API │  │  Store Mgmt  │  │  CRM Core   │ │
│  │ (headless)   │  │  (Phase 2)   │  │  (existing)  │ │
│  │              │  │              │  │              │ │
│  │ products.ts  │  │ stores.ts    │  │ contacts.ts  │ │
│  │ cart.ts      │  │ webhooks.ts  │  │ companies.ts │ │
│  │ orders.ts    │  │ apiKeys.ts   │  │ deals.ts     │ │
│  │ checkout.ts  │  │ sync.ts      │  │ invoices.ts  │ │
│  │ customers.ts │  │              │  │ products.ts  │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────────┘ │
│         │                 │                           │
│  ┌──────┴─────────────────┴───────┐                  │
│  │     Payment Interface          │                  │
│  │  ┌──────────┐  ┌──────────┐   │                  │
│  │  │ Midtrans │  │ Stripe   │   │                  │
│  │  │ (plugin) │  │ (plugin) │   │                  │
│  │  └──────────┘  └──────────┘   │                  │
│  └────────────────────────────────┘                  │
└─────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
   ┌──────────────┐ ┌───────────┐ ┌──────────────┐
   │ (shop)/      │ │ Embeddable│ │ External     │
   │ CRM Portal   │ │ Widget    │ │ Stores       │
   │ (Phase 1)    │ │ (Phase 2) │ │ (Phase 2-3)  │
   │              │ │           │ │              │
   │ Next.js UI   │ │ JS Script │ │ teluromegaJE │
   │ thin layer   │ │ React     │ │ toko lain    │
   └──────────────┘ └───────────┘ └──────────────┘
```

**Key principles:**
- **Convex functions = API** — no UI logic, no React imports
- **`(shop)/` = presentation only** — calls commerce API, renders UI
- **Payment = plugin pattern** — interface + implementation, easy to add gateways
- **Store integration = webhook consumer** — stores send events, CRM receives & processes

---

## Database Schema

### New Entities (added to `convex/schema.ts`)

```typescript
// === CUSTOMER ===
customers: defineEnt({
  name: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  city: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  socialProvider: v.optional(v.string()), // 'google' | 'facebook'
  socialId: v.optional(v.string()),
})
  .field('organizationId', v.id('organization'), { index: true })
  .field('userId', v.optional(v.id('user'))) // link to CRM user if exists
  .index('organizationId_email', ['organizationId', 'email'])
  .index('organizationId_socialProvider', ['organizationId', 'socialProvider'])

// === CART ===
carts: defineEnt({
  status: v.union(v.literal('active'), v.literal('converted'), v.literal('abandoned')),
})
  .field('organizationId', v.id('organization'), { index: true })
  .field('customerId', v.id('customers'), { index: true })
  .field('sessionId', v.optional(v.string())) // for guest before login
  .index('organizationId_customerId_status', ['organizationId', 'customerId', 'status'])

// === CART ITEMS ===
cartItems: defineEnt({
  quantity: v.number(),
})
  .field('cartId', v.id('carts'), { index: true })
  .field('productId', v.id('products'))
  .field('variantId', v.optional(v.id('productVariants')))
  .field('unitPrice', v.number()) // price snapshot at time of adding
  .index('cartId', ['cartId'])

// === SHOP ORDERS (separate from CRM saleOrders) ===
shopOrders: defineEnt({
  orderNumber: v.string(), // auto-generated: ORD-20260414-XXXX
  status: v.union(
    v.literal('pending_payment'),
    v.literal('paid'),
    v.literal('processing'),
    v.literal('shipped'),
    v.literal('delivered'),
    v.literal('cancelled'),
    v.literal('expired'),
  ),
  paymentStatus: v.union(
    v.literal('pending'),
    v.literal('paid'),
    v.literal('failed'),
    v.literal('expired'),
    v.literal('refunded'),
  ),
  subtotal: v.number(),
  shippingCost: v.optional(v.number()),
  discountAmount: v.optional(v.number()),
  totalAmount: v.number(),
  notes: v.optional(v.string()),
})
  .field('organizationId', v.id('organization'), { index: true })
  .field('customerId', v.id('customers'), { index: true })
  .field('saleOrderId', v.optional(v.id('saleOrders'))) // link to CRM sale order
  .field('sourceStoreId', v.optional(v.id('connectedStores'))) // null = from CRM portal
  .field('paymentProvider', v.optional(v.string())) // 'midtrans' | 'stripe'
  .field('paymentRef', v.optional(v.string())) // external payment ID
  .field('paymentData', v.optional(v.record(v.string(), v.any()))) // snap token, etc
  .field('shippingAddress', v.optional(v.object({
    recipientName: v.string(),
    phone: v.string(),
    address: v.string(),
    city: v.string(),
    postalCode: v.string(),
  })))
  .index('organizationId_status', ['organizationId', 'status'])
  .index('organizationId_orderNumber', ['organizationId', 'orderNumber'])
  .index('organizationId_customerId', ['organizationId', 'customerId'])

// === ORDER ITEMS ===
shopOrderItems: defineEnt({
  productName: v.string(), // snapshot
  productPrice: v.number(), // snapshot
  quantity: v.number(),
  subtotal: v.number(),
})
  .field('shopOrderId', v.id('shopOrders'), { index: true })
  .field('productId', v.id('products'))
  .field('variantId', v.optional(v.id('productVariants')))
  .index('shopOrderId', ['shopOrderId'])

// === CONNECTED STORES (Phase 2) ===
connectedStores: defineEnt({
  name: v.string(),
  url: v.string(),
  apiKey: v.string(), // hashed
  apiKeyPrefix: v.string(), // for display: "tm_****xxxx"
  webhookUrl: v.optional(v.string()),
  webhookSecret: v.optional(v.string()),
  status: v.union(v.literal('active'), v.literal('suspended'), v.literal('disconnected')),
  lastSyncAt: v.optional(v.number()),
})
  .field('organizationId', v.id('organization'), { index: true })
  .index('organizationId_status', ['organizationId', 'status'])
  .index('apiKey', ['apiKey'])

// === PAYMENT PROVIDERS (config per org) ===
paymentProviders: defineEnt({
  provider: v.string(), // 'midtrans' | 'stripe'
  isActive: v.boolean(),
  config: v.record(v.string(), v.string()), // serverKey, clientKey, etc (encrypted)
  sandboxMode: v.optional(v.boolean()),
})
  .field('organizationId', v.id('organization'), { index: true })
  .index('organizationId_provider', ['organizationId', 'provider'])

// === EXTEND PRODUCTS with shop visibility ===
// Add to existing products entity:
//   visibleInShop: v.optional(v.boolean()),  // default false
//   slug: v.optional(v.string()),            // URL-friendly product slug
```

**Design decisions:**
- `shopOrders` separate from `saleOrders` — e-commerce flow vs CRM sales, can be linked via `saleOrderId`
- `customers` separate from `contacts` — customer = portal buyer, contact = CRM contact, linkable later
- Price snapshots in cart items & order items — prices change, orders must preserve purchase price
- `connectedStores` ready for Phase 2 but doesn't block Phase 1
- Product `visibleInShop` flag — owner controls which products appear in portal
- Product `slug` — URL-friendly identifier for public product pages

---

## Backend API (Convex Functions)

All headless — no UI dependencies:

```
convex/
  commerce/
    products.ts      → public product queries
    cart.ts          → cart CRUD
    customers.ts     → customer registration & profile
    orders.ts        → order CRUD & tracking
    checkout.ts      → payment initiation & callback
    payments/
      interface.ts   → PaymentProvider type definition
      midtrans.ts    → Midtrans implementation
      index.ts       → factory: get provider for org
```

### convex/commerce/products.ts

```typescript
// Public — no auth required, scoped by org
export const listPublished = query({
  args: {
    organizationSlug: v.string(),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsType,
  },
  // Returns products where active=true AND visibleInShop=true
  // With category name, price, image, variants
})

export const getBySlug = query({
  args: { organizationSlug: v.string(), slug: v.string() },
  // Single product detail + variants + related products
})

export const listCategories = query({
  args: { organizationSlug: v.string() },
  // Categories that have published products
})
```

### convex/commerce/cart.ts

```typescript
// Authenticated — customer session
export const getCart = query({
  args: { organizationSlug: v.string() },
  // Returns cart with items, product snapshots, calculated total
})

export const addItem = mutation({
  args: {
    organizationSlug: v.string(),
    productId: v.id('products'),
    variantId: v.optional(v.id('productVariants')),
    quantity: v.number(),
  },
  // Get or create active cart, add item, snapshot price
})

export const removeItem = mutation({
  args: { cartItemId: v.id('cartItems') },
})

export const updateQuantity = mutation({
  args: { cartItemId: v.id('cartItems'), quantity: v.number() },
})

export const clearCart = mutation({
  args: { organizationSlug: v.string() },
})

export const mergeGuestCart = mutation({
  args: { organizationSlug: v.string(), sessionId: v.string() },
  // Migrate guest cart items to authenticated customer cart
})
```

### convex/commerce/customers.ts

```typescript
// Called after social login
export const registerOrLogin = mutation({
  args: {
    organizationSlug: v.string(),
    name: v.string(),
    email: v.string(),
    socialProvider: v.string(),
    socialId: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  // Upsert: create customer if new, return existing if already registered
  // Link to CRM user if same email exists
})

export const getProfile = query({
  args: { organizationSlug: v.string() },
  // Customer detail + order history summary
})

export const getOrders = query({
  args: { organizationSlug: v.string(), paginationOpts: paginationOptsType },
  // Customer's orders with items
})

export const updateProfile = mutation({
  args: {
    organizationSlug: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
  },
})
```

### convex/commerce/checkout.ts

```typescript
export const initiateCheckout = mutation({
  args: {
    organizationSlug: v.string(),
    shippingAddress: v.object({
      recipientName: v.string(),
      phone: v.string(),
      address: v.string(),
      city: v.string(),
      postalCode: v.string(),
    }),
    notes: v.optional(v.string()),
  },
  // 1. Validate cart (stock, price changes)
  // 2. Create shopOrder (pending_payment)
  // 3. Call paymentProvider.initiatePayment(order)
  // 4. Return { orderId, paymentData: { snapToken, redirectUrl } }
  // 5. Mark cart as 'converted'
})

export const handlePaymentCallback = mutation({
  args: {
    organizationSlug: v.string(),
    orderId: v.id('shopOrders'),
    provider: v.string(),
    paymentData: v.record(v.string(), v.any()),
  },
  // 1. Verify payment with provider
  // 2. Update shopOrder status + paymentStatus
  // 3. Auto-create saleOrder in CRM (link via saleOrderId)
  // 4. Auto-create contact in CRM if not exists
})

export const cancelOrder = mutation({
  args: { orderId: v.id('shopOrders') },
  // Only if status is pending_payment
})

export const getOrderDetail = query({
  args: { organizationSlug: v.string(), orderNumber: v.string() },
  // Full order detail with items, payment status, timeline
})
```

### convex/commerce/payments/interface.ts

```typescript
// Plugin interface — every payment provider implements this
export interface PaymentProvider {
  name: string;
  initiatePayment(ctx: any, order: ShopOrder, config: ProviderConfig): Promise<PaymentResult>;
  verifyPayment(ctx: any, paymentRef: string, config: ProviderConfig): Promise<VerificationResult>;
  handleWebhook(ctx: any, payload: any, config: ProviderConfig): Promise<WebhookResult>;
  refund(ctx: any, order: ShopOrder, config: ProviderConfig): Promise<RefundResult>;
}

export type PaymentResult = {
  paymentRef: string;
  clientData: Record<string, any>; // snapToken, redirectUrl, etc
};

export type VerificationResult = {
  success: boolean;
  status: 'paid' | 'failed' | 'pending' | 'expired';
  paymentRef: string;
  metadata?: Record<string, any>;
};

export type ProviderConfig = {
  serverKey: string;
  clientKey: string;
  sandboxMode: boolean;
  // provider-specific fields
};
```

### convex/commerce/payments/midtrans.ts

```typescript
// Midtrans implementation of PaymentProvider
export const midtransProvider: PaymentProvider = {
  name: 'midtrans',
  async initiatePayment(ctx, order, config) {
    // Call Midtrans API → get snap token
    // Return { paymentRef: midtransOrderId, clientData: { snapToken } }
  },
  async verifyPayment(ctx, paymentRef, config) {
    // Call Midtrans transaction status API
  },
  async handleWebhook(ctx, payload, config) {
    // Verify signature, parse notification
  },
  async refund(ctx, order, config) {
    // Call Midtrans refund API
  },
};
```

**Design decisions:**
- `organizationSlug` as parameter — each org has its own store, slug can be subdomain later
- Cart operations stateless — no server-side session, cart tied to customer ID
- Checkout = atomic operation — validation, order creation, payment initiation in one mutation
- Payment callback updates order AND auto-creates CRM entities (saleOrder + contact)
- Payment interface allows adding Stripe/etc without changing business logic

---

## Customer Portal UI

### Routes

```
apps/web/src/app/
  (shop)/
    layout.tsx              → Store layout (navbar, footer, no CRM sidebar)
    page.tsx                → Store home (featured products, categories)
    products/
      page.tsx              → Catalog (grid, filters, search)
      [slug]/page.tsx       → Product detail (images, variants, price, add to cart)
    cart/
      page.tsx              → Cart (items, quantities, total, checkout)
    checkout/
      page.tsx              → Shipping + payment
      success/page.tsx      → Order confirmed
      pending/page.tsx      → Payment pending (instructions)
      failed/page.tsx       → Payment failed (retry)
    auth/
      callback/page.tsx     → Social login callback (Google)
    orders/
      page.tsx              → Order history (requires login)
      [orderNumber]/page.tsx → Order detail + status tracking
    account/
      page.tsx              → Customer profile (requires login)
```

### Shop Layout

```tsx
// (shop)/layout.tsx — no CRM sidebar, no command palette
// Navbar: Store logo | Search | Cart icon (count) | Login/Account
// Footer: About | Policy | Contact

export default function ShopLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <ShopNavbar />
      <main className="flex-1">{children}</main>
      <ShopFooter />
    </div>
  );
}
```

### Shared Components

```
apps/web/src/components/shop/
  product-card.tsx         → Product card (image, name, price, cart button)
  product-grid.tsx         → Responsive grid layout with infinite scroll
  product-filters.tsx      → Filter sidebar (category, price range, search)
  cart-icon.tsx            → Navbar cart icon with badge count
  add-to-cart-button.tsx   → Button with loading/stock status
  order-status-badge.tsx   → Status colors (pending=red, paid=blue, etc)
  checkout-form.tsx        → Address form + order summary
```

**Design decisions:**
- Mobile-first — most store customers on mobile
- Midtrans Snap popup — not full redirect (better UX)
- Price snapshots in cart — user sees exact price at time of adding
- Login optional while browsing — only required at checkout
- Clean design — consistent with teluromegaJE store

---

## Auth & Organization Flow

### Shop Context Resolution

**Phase 1:** Active CRM org's store
- Owner configures "shop slug" in settings
- `/shop/*` uses that slug as store context
- Simplest approach for single-org setups

**Future:** Multi-tenant routing
- `/shop/teluromega/products` → org by slug
- `teluromega.localhost:3005/products` → org by subdomain

### Customer Auth Flow

```
1. Customer visits /shop → browse products (no auth)
2. Add to cart → create temporary cart (sessionId in localStorage)
3. Click "Checkout" → checkout page
4. Checkout page:
   ├── Already logged in? → straight to shipping form
   └── Not logged in? → show:
       ├── [Continue with Google] ← social login (same as CRM)
       └── [Continue as Guest] → email + name form (creates customer)
5. After login/customer created → migrate temp cart → to authenticated customer
6. Fill shipping address → click "Pay"
7. Payment initiation → Midtrans Snap popup/redirect
8. Payment callback → update order → show success/failed page
```

### Shop vs CRM Sessions

```
CRM session (existing):
  - Login at /signin
  - Roles: owner, admin, member
  - Access to all CRM features

Shop session (new, shared better-auth):
  - Login at /shop/auth/callback
  - Role: customer (auto-created)
  - Access to shop features only

Same better-auth instance, two entry points:
  - CRM login → callbackURL = /dashboard
  - Shop login → callbackURL = /shop/checkout

After social login:
  - better-auth creates/finds user
  - CRM: check activeOrganization → show dashboard
  - Shop: upsert customer → migrate cart → redirect to checkout
```

### Entity Relationships

```
User (better-auth)
  ├── member → organization (CRM role: owner/admin/member)
  └── customer → organization (shop role: customer)

Same user can be:
  - CRM member (managing business)
  - Shop customer (buying from another store)
```

### Portal Product Settings (in CRM)

```
CRM Settings → Shop:
  ├── Enable customer portal: [yes/no]
  ├── Shop slug: [teluromega]
  ├── Visible products: [all | selected only]
  │   └── Mark individual products as "Show in shop"
  ├── Payment methods: [✓ Midtrans] [  Stripe]
  │   └── Config per method (server key, client key, sandbox)
  ├── Shipping:
  │   ├── Flat rate: Rp [15000]
  │   └── Or free shipping above: Rp [500000]
  └── Notifications:
      ├── Order confirmation email: [yes/no]
      └── Order event webhook: [URL]
```

---

## Store Integration (Phase 2 Architecture)

### Store Registration

```
1. CRM owner: "Connect Store" → fill store name + URL
2. CRM generates: apiKey + webhookUrl + embed script
3. Owner installs plugin in store:
   └── npm install @crm/store-plugin
   └── or: <script src="crm.com/plugin.js" data-key="tm_xxx">
4. Plugin syncs: products, orders, customers → CRM
```

### Embeddable Plugin Contract

```typescript
// @crm/store-plugin — install in external store
import { CRMStorePlugin } from '@crm/store-plugin';

const plugin = CRMStorePlugin.init({
  apiKey: 'tm_abc123def456',
  crmEndpoint: 'https://crm.com/api/store',
});

// Auto-sync events:
plugin.on('order.created', (order) => {
  // → POST to CRM webhook → create shopOrder + contact
});

plugin.on('product.updated', (product) => {
  // → POST to CRM webhook → update product in CRM catalog
});

plugin.on('customer.registered', (customer) => {
  // → POST to CRM webhook → create/update customer
});
```

### Data Sync Flow (Store → CRM)

```
External Store                     CRM
    │                              │
    │  POST /api/store/webhook     │
    │  { event, apiKey, data }     │
    │ ──────────────────────────►  │
    │                              │ 1. Verify apiKey
    │                              │ 2. Find connectedStore
    │                              │ 3. Verify webhookSignature
    │                              │ 4. Process event:
    │                              │    order.created → create shopOrder
    │                              │    + create/update contact
    │                              │    + create saleOrder (link)
    │                              │ 5. Respond 200 OK
    │  ◄────────────────────────── │
    │  { received: true }          │
```

### Security

- **API keys**: `tm_` prefix + 32 random bytes, stored hashed in CRM
- **Webhook secret**: HMAC-SHA256 signature on every payload
- **Rate limiting**: 100 req/min per store
- **API key scopes**: restrictable per permission (read_products, write_orders, etc)
- **Key rotation**: rotate without downtime (old key valid 24h after rotation)

---

## Phase Plan

### Phase 1: Customer Portal (this implementation)
- Schema: customers, carts, cartItems, shopOrders, shopOrderItems, paymentProviders
- Backend: commerce API (products, cart, customers, orders, checkout)
- Payment: Midtrans plugin (interface + implementation)
- UI: (shop)/ routes — home, catalog, product detail, cart, checkout, order tracking
- Auth: social login integration, guest → customer migration
- CRM integration: shopOrders auto-create saleOrders + contacts
- Settings: enable portal, product visibility, payment config, shipping config

### Phase 2: Store Integration
- Schema: connectedStores
- Backend: webhook receiver, API key management, store registration
- Plugin: @crm/store-plugin npm package
- CRM UI: Connected Stores management page
- One-way sync: external store → CRM

### Phase 3: Full Headless Commerce
- Embeddable script tag for any website
- Two-way product sync
- REST/HTTP wrapper for non-Convex clients
- SDK/library for easy integration
- Multi-store dashboard
