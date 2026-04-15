# Plugin Architecture Design — CRM Platform

**Date**: 2026-04-15
**Status**: Draft — Brainstorm
**Author**: User + AI

---

## Context

Sekarang ada 2 project:

| | CRM | teluromegaJE (Boilerplate) |
|---|---|---|
| **Stack** | Next.js + Convex + convex-ents + better-auth | Next.js + Convex (vanilla) + better-auth |
| **Multi-tenant** | ✅ `organizationId` di semua table | ❌ Single-tenant |
| **Schema** | `defineEnt` (convex-ents) | `defineTable` (vanilla Convex) |
| **Auth** | better-auth + org system | better-auth + admin/customer role |
| **Data** | products, orders, payments scoped per org | products, orders, carts — 1 toko saja |

**Tujuan**: User bisa clone boilerplate seperti teluromegaJE, konek ke CRM kita, dan langsung jalan sebagai "plugin" di platform CRM.

---

## The Big Picture

```
┌──────────────────────────────────────────────────────────────┐
│                     CRM Platform                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    CRM Core                              │ │
│  │  Contacts · Companies · Deals · Invoices · Dashboard    │ │
│  │  Organization · Members · Permissions                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                          │                                    │
│                    Plugin API                                 │
│                          │                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Ecommerce   │  │   Booking    │  │     POS      │  ...   │
│  │   Plugin     │  │   Plugin     │  │    Plugin    │        │
│  │             │  │              │  │              │        │
│  │ /shop/*     │  │ /book/*      │  │ /pos/*       │        │
│  │ products    │  │ services     │  │ transactions │        │
│  │ carts       │  │ appointments │  │ cash-register│        │
│  │ orders      │  │ calendars    │  │ receipts     │        │
│  └─────────────┘  └──────────────┘  └──────────────┘        │
│                                                               │
│  ───── Data Layer: 1 Convex Instance ─────                   │
│  Semua table punya: organizationId + pluginId (opsional)      │
└──────────────────────────────────────────────────────────────┘
         │                              │
    ┌────▼────┐                   ┌─────▼─────┐
    │ Public  │                   │  Custom    │
    │ /shop/  │                   │  Domain    │
    │ [slug]  │                   │  Proxy     │
    └─────────┘                   └───────────┘
```

---

## Phase 1: Built-in Plugin System (Start Here)

### Konsep

Plugin = **module dalam monorepo CRM** yang bisa di-enable/disable per organization.

Setiap plugin punya:
1. **manifest** — metadata (id, nama, versi, routes, icon)
2. **convex functions** — backend logic (scoped by orgId)
3. **pages** — Next.js routes di bawah `/<plugin-route>/[orgSlug]/*`
4. **components** — UI elements

### Struktur Folder

```
apps/web/src/
  plugins/
    _registry.ts              ← Plugin registry (daftar semua plugin)
    
    ecommerce/
      manifest.ts             ← { id: 'ecommerce', name: 'Toko Online', ... }
      convex/                 ← Products, Cart, Orders, Payments
      pages/                  ← /shop/[slug]/* pages
      components/             ← ProductGrid, Cart, Checkout
      types.ts                ← Plugin-specific types
      
    booking/
      manifest.ts             ← { id: 'booking', name: 'Booking', ... }
      convex/                 ← Services, Appointments, Calendars
      pages/                  ← /book/[slug]/* pages
      components/
      
    pos/
      manifest.ts             ← { id: 'pos', name: 'Point of Sale', ... }
      convex/                 ← Transactions, Cash Register, Receipts
      pages/                  ← /pos/[slug]/* pages
      components/

convex/
  schema.ts                   ← Core tables + plugin tables (semua di 1 schema)
  plugins/
    ecommerce.ts              ← Ecommerce convex functions
    booking.ts                ← Booking convex functions
```

### Plugin Manifest Interface

```typescript
// apps/web/src/plugins/_registry.ts

export interface CRMPlugin {
  id: string;                    // 'ecommerce', 'booking', 'pos'
  name: string;                  // 'Toko Online'
  description: string;           // 'Jual produk online dengan pembayaran otomatis'
  icon: LucideIcon;              // ShoppingBag, Calendar, Monitor
  version: string;               // '1.0.0'
  
  // Routes — plugin punya route prefix sendiri
  routePrefix: string;           // 'shop', 'book', 'pos'
  
  // Public routes — accessible tanpa login
  publicRoutes: string[];        // ['/products', '/products/[id]', '/cart']
  
  // Dashboard routes — accessible dari CRM dashboard
  dashboardRoutes: string[];     // ['/settings', '/orders', '/products/manage']
  
  // Convex functions yang plugin butuh
  convexModules: string[];       // ['commerce/products', 'commerce/cart']
  
  // Schema tables yang plugin define
  tables: string[];              // ['products', 'carts', 'orders']
  
  // Navigation items (muncul di sidebar saat plugin aktif)
  navItems: NavItem[];
  
  // Settings fields (konfigurasi per org)
  settings: PluginSetting[];
}

export interface PluginSetting {
  key: string;
  label: string;
  type: 'text' | 'boolean' | 'select' | 'secret';
  default?: any;
  options?: { label: string; value: string }[];
}

// ─── Registered Plugins ──────────────────────────────

export const PLUGINS: CRMPlugin[] = [
  {
    id: 'ecommerce',
    name: 'Toko Online',
    description: 'Jual produk online, terima pembayaran, kelola pesanan',
    icon: ShoppingBag,
    version: '1.0.0',
    routePrefix: 'shop',
    publicRoutes: ['/products', '/products/[id]', '/cart', '/checkout'],
    dashboardRoutes: ['/orders', '/products/manage', '/settings'],
    convexModules: ['commerce/products', 'commerce/cart', 'commerce/orders'],
    tables: ['products', 'carts', 'cartItems', 'shopOrders', 'shopOrderItems'],
    navItems: [
      { label: 'Pesanan', href: '/orders', icon: Package },
      { label: 'Produk', href: '/products/manage', icon: ShoppingBag },
      { label: 'Pembayaran', href: '/payments', icon: CreditCard },
    ],
    settings: [
      { key: 'isActive', label: 'Toko Aktif', type: 'boolean', default: false },
      { key: 'currency', label: 'Mata Uang', type: 'select', options: [
        { label: 'IDR', value: 'IDR' },
        { label: 'USD', value: 'USD' },
      ]},
      { key: 'midtransClientKey', label: 'Midtrans Client Key', type: 'secret' },
      { key: 'midtransServerKey', label: 'Midtrans Server Key', type: 'secret' },
    ],
  },
  // ... booking, pos, dll
];
```

### Schema: Plugin Tables di Convex

```typescript
// convex/schema.ts — tambahan untuk plugin system

// Core table: plugin registry per org
pluginInstances: defineEnt({
  pluginId: v.string(),            // 'ecommerce', 'booking'
  isActive: v.boolean(),           // aktif atau tidak
  settings: v.optional(v.any()),   // plugin-specific settings JSON
  publicSlug: v.optional(v.string()), // 'tokobudi' → /shop/tokobudi
  customDomain: v.optional(v.string()), // 'www.tokobudi.com'
})
  .field('organizationId', v.id('organization'), { index: true })
  .index('organizationId_pluginId', ['organizationId', 'pluginId'])
  .index('publicSlug', ['publicSlug'], { unique: true })
  .index('customDomain', ['customDomain'])
  .edge('organization', { to: 'organization', field: 'organizationId' }),
```

### Routing Architecture

```
Path-based public access:
  /shop/tokobudi           → Ecommerce plugin, org slug 'tokobudi'
  /shop/tokobudi/products  → Product listing
  /shop/tokobudi/checkout  → Checkout flow

Custom domain (via middleware):
  www.tokobudi.com → internally maps to /shop/tokobudi/*
  (lookup customDomain → pluginInstances → publicSlug → org)

Dashboard access:
  /dashboard/plugins       → Plugin marketplace (enable/disable)
  /dashboard/ecommerce/*   → Ecommerce management (orders, products)
  /dashboard/booking/*     → Booking management
```

### Middleware: Domain Resolution

```typescript
// apps/web/src/middleware.ts (NEW)

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const url = request.nextUrl;
  
  // Custom domain lookup
  // www.tokobudi.com → lookup pluginInstances by customDomain
  // → redirect internally to /shop/[publicSlug]/*
  if (host && !host.includes('crmkita.com') && !host.includes('localhost')) {
    const slug = await lookupDomain(host); // fetch Convex or edge cache
    if (slug) {
      url.pathname = `/shop/${slug}${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  
  return NextResponse.next();
}
```

---

## Phase 2: External Plugin Integration (Boilerplate → Plugin)

### Konsep

User clone boilerplate (seperti teluromegaJE), deploy sendiri, lalu **register** sebagai plugin di CRM.

```
User flow:
1. User clone boilerplate ecommerce
2. User customize (tema, produk, dll)
3. User deploy ke Vercel/Railway sendiri
4. User masuk CRM Dashboard → Plugins → "Connect External Plugin"
5. User input: plugin URL + API key
6. CRM verifikasi koneksi
7. Plugin muncul di dashboard, data sync 2-arah via API
```

### Plugin API Contract

```typescript
// Setiap external plugin harus expose endpoint ini:

// GET /api/plugin/manifest
// → { id, name, version, tables, routes }

// GET /api/plugin/data?orgId=xxx&table=products
// → List data dari plugin (CRM pull)

// POST /api/plugin/data
// → Push data ke plugin (CRM push: contacts, orders)

// POST /api/plugin/webhook
// → Plugin notify CRM saat ada event baru (new order, payment received)

// GET /api/plugin/health
// → Health check
```

### Sync Strategy

```
┌──────────┐                    ┌──────────────┐
│   CRM    │                    │   External   │
│  Core    │                    │   Plugin     │
│ (Convex) │                    │  (Vercel +   │
│          │                    │   Convex)    │
└─────┬────┘                    └──────┬───────┘
      │                                │
      │  POST /api/plugin/webhook      │
      │  { event: 'order.created',     │
      │    orgId, orderId, data }      │
      │ ──────────────────────────────>│
      │                                │
      │  GET /api/plugin/data          │
      │  { orgId, table: 'orders' }    │
      │ ──────────────────────────────>│
      │                                │
      │  <──────────────────────────────│
      │  { data: [...orders] }         │
      │                                │
      │  POST /api/plugin/data         │
      │  { orgId, table: 'contacts',   │
      │    action: 'sync', data: [...] }│
      │ ──────────────────────────────>│
      │                                │
```

---

## Phase 3: Plugin Marketplace

```
/dashboard/plugins/marketplace
  ├── Browse plugins (grid view)
  ├── Plugin detail page (screenshots, reviews, pricing)
  ├── Install → auto-enable for org
  ├── Plugin settings per org
  └── Developer portal (submit plugin)
```

---

## How teluromegaJE Fits

teluromegaJE = **Phase 2 external plugin boilerplate**.

Saat ini:
```
teluromegaJE (standalone toko)
  ├── convex/products.ts    → listPublic, create, update, remove
  ├── convex/orders.ts      → createFromCart, listMine, updateStatus
  ├── convex/carts.ts       → getActiveCart, addItem, removeItem
  └── convex/users.ts       → admin/customer auth
```

Untuk jadi plugin CRM, perlu:

| Perubahan | Detail |
|-----------|--------|
| **Tambah organizationId** | Setiap table dapat `organizationId` |
| **Expose plugin API** | `/api/plugin/manifest`, `/api/plugin/data`, dll |
| **Webhook ke CRM** | Notify saat order baru, payment received |
| **Auth bridge** | better-auth session → CRM org context |
| **Settings endpoint** | Midtrans keys dari CRM, bukan hardcode |

### Boilerplate Template (setelah refactor)

```
teluromegaJE/
  src/
    app/
      api/plugin/
        manifest/route.ts     ← GET plugin manifest
        data/route.ts         ← GET/POST sync data
        webhook/route.ts      ← POST receive CRM events
        health/route.ts       ← GET health check
      (store)/                ← Public shop pages
      (admin)/                ← Admin dashboard
    lib/
      plugin-bridge.ts        ← CRM ↔ Plugin communication
      plugin-auth.ts          ← Auth bridge (CRM token → local session)
  convex/
    schema.ts                 ← +organizationId di semua table
    products.ts               ← +filter by organizationId
    orders.ts                 ← +filter by organizationId
    carts.ts                  ← +filter by organizationId
  plugin.config.ts            ← Plugin manifest + CRM connection config
```

---

## Open Questions (Perlu Jawaban User)

1. **Priority**: Phase 1 dulu (built-in) atau langsung Phase 2 (external boilerplate)?
2. **Boilerplate target**: teluromegaJE jadi template pertama? Atau buat fresh?
3. **Custom domain tech**: Vercel (perlu enterprise) atau Cloudflare/Nginx reverse proxy?
4. **Plugin billing**: Plugin gratis semua? Atau ada premium plugin yang bayar?
5. **Data isolation**: Plugin boleh baca data CRM core (contacts)? Atau fully isolated?

---

## Recommended Implementation Order

```
Week 1-2: Phase 1 Built-in Plugin System
  ├── pluginInstances table + schema
  ├── Plugin registry + manifest types
  ├── Dashboard: enable/disable plugin per org
  ├── Dynamic sidebar berdasarkan active plugins
  └── Refactor ecommerce jadi plugin pertama

Week 3-4: Public Shop Routing
  ├── /shop/[slug]/* dynamic routes
  ├── middleware.ts untuk custom domain
  ├── Public slug reservation saat create org
  └── SEO meta per toko

Week 5-6: Phase 2 External Plugin Bridge
  ├── Plugin API contract spec
  ├── teluromegaJE refactor jadi plugin template
  ├── CRM webhook listener
  ├── Dashboard: connect external plugin UI
  └── Data sync (pull orders, push contacts)

Week 7+: Phase 3 Marketplace (optional)
  ├── Plugin listing UI
  ├── Developer portal
  └── Plugin review/approval flow
```
