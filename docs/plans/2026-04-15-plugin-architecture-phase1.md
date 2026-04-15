# Plugin Architecture Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor shop dari hardcoded `ORG_SLUG='default'` menjadi multi-tenant plugin system dimana setiap org punya toko sendiri di `/shop/[slug]/*`, dengan plugin enable/disable di dashboard.

**Architecture:** Tambah `pluginInstances` table di Convex schema. Semua `/shop/*` routes dipindah ke `/shop/[slug]/*`. Plugin registry di frontend menentukan sidebar nav. Middleware handle custom domain → slug mapping.

**Tech Stack:** Next.js App Router, Convex, convex-ents, shadcn/ui, better-auth

---

## Overview Perubahan

```
SEBELUM:
  /shop                    → hardcoded ORG_SLUG = 'default'
  /shop/products           → lihat produk org 'default'
  /shop/checkout           → checkout org 'default'

SESUDAH:
  /shop/tokobudi           → slug dari URL → orgId Budi
  /shop/tokobudi/products  → produk org Budi
  /shop/tokobudi/checkout  → checkout org Budi
  /shop/tokoandi/products  → produk org Andi (data terisolasi)

  www.tokobudi.com         → middleware rewrite ke /shop/tokobudi/*
  
  Dashboard:
  /settings/plugins        → enable/disable plugin per org
  Sidebar                  → dynamic berdasarkan plugin aktif
```

---

### Task 1: Schema — `pluginInstances` Table

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Tambah `pluginInstances` table di schema.ts**

Tambahkan setelah `paymentProviders` table:

```typescript
    pluginInstances: defineEnt({
      pluginId: v.string(),                    // 'ecommerce', 'booking', 'pos'
      isActive: v.boolean(),                   // aktif atau tidak
      settings: v.optional(v.any()),           // plugin-specific settings JSON
      publicSlug: v.optional(v.string()),      // 'tokobudi' → /shop/tokobudi
      customDomain: v.optional(v.string()),    // 'www.tokobudi.com'
    })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_pluginId', ['organizationId', 'pluginId'])
      .index('publicSlug', ['publicSlug'])
      .index('customDomain', ['customDomain']),
```

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && npx convex typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add pluginInstances table"
```

---

### Task 2: Backend — Plugin CRUD Functions

**Files:**
- Create: `convex/plugins.ts`

**Step 1: Buat file `convex/plugins.ts`**

```typescript
import { z } from 'zod';
import { createOrgQuery, createOrgMutation } from './functions';
import { ConvexError } from 'convex/values';

// ─── Queries ──────────────────────────────────────────

export const list = createOrgQuery()({
  args: {},
  returns: z.array(z.object({
    id: z.string(),
    pluginId: z.string(),
    isActive: z.boolean(),
    publicSlug: z.string().optional(),
    customDomain: z.string().optional(),
    settings: z.any().optional(),
  })),
  handler: async (ctx, _args) => {
    const instances = await ctx.table('pluginInstances', 'organizationId', (q) =>
      q.eq('organizationId', ctx.orgId)
    );
    return instances.map((p: any) => ({
      id: p._id,
      pluginId: p.pluginId,
      isActive: p.isActive,
      publicSlug: p.publicSlug,
      customDomain: p.customDomain,
      settings: p.settings,
    }));
  },
});

export const getActive = createOrgQuery()({
  args: {},
  returns: z.array(z.string()),
  handler: async (ctx, _args) => {
    const instances = await ctx.table('pluginInstances', 'organizationId', (q) =>
      q.eq('organizationId', ctx.orgId)
    );
    return instances
      .filter((p: any) => p.isActive)
      .map((p: any) => p.pluginId);
  },
});

export const getBySlug = createOrgQuery()({
  args: { publicSlug: z.string() },
  returns: z.object({
    organizationId: z.string(),
    pluginId: z.string(),
    isActive: z.boolean(),
    publicSlug: z.string().optional(),
  }).nullable(),
  handler: async (ctx, args) => {
    const instance = await ctx.table('pluginInstances', 'publicSlug', (q) =>
      q.eq('publicSlug', args.publicSlug)
    ).first();
    if (!instance) return null;
    return {
      organizationId: instance.organizationId,
      pluginId: instance.pluginId,
      isActive: instance.isActive,
      publicSlug: instance.publicSlug,
    };
  },
});

export const getByDomain = createOrgQuery()({
  args: { domain: z.string() },
  returns: z.object({
    organizationId: z.string(),
    pluginId: z.string(),
    publicSlug: z.string().optional(),
  }).nullable(),
  handler: async (ctx, args) => {
    const instance = await ctx.table('pluginInstances', 'customDomain', (q) =>
      q.eq('customDomain', args.domain)
    ).first();
    if (!instance) return null;
    return {
      organizationId: instance.organizationId,
      pluginId: instance.pluginId,
      publicSlug: instance.publicSlug,
    };
  },
});

// ─── Mutations ────────────────────────────────────────

export const upsert = createOrgMutation({})({
  args: {
    pluginId: z.string(),
    isActive: z.boolean().optional(),
    publicSlug: z.string().optional(),
    customDomain: z.string().optional(),
    settings: z.any().optional(),
  },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.table('pluginInstances', 'organizationId_pluginId', (q) =>
      q.eq('organizationId', ctx.orgId).eq('pluginId', args.pluginId)
    ).first();

    if (existing) {
      await existing.patch({
        ...(args.isActive !== undefined && { isActive: args.isActive }),
        ...(args.publicSlug !== undefined && { publicSlug: args.publicSlug }),
        ...(args.customDomain !== undefined && { customDomain: args.customDomain }),
        ...(args.settings !== undefined && { settings: args.settings }),
      });
    } else {
      // Validate slug uniqueness
      if (args.publicSlug) {
        const slugTaken = await ctx.table('pluginInstances', 'publicSlug', (q) =>
          q.eq('publicSlug', args.publicSlug!)
        ).first();
        if (slugTaken) {
          throw new ConvexError({
            code: 'CONFLICT',
            message: `Slug "${args.publicSlug}" sudah digunakan toko lain`,
          });
        }
      }
      await ctx.table('pluginInstances').insert({
        organizationId: ctx.orgId,
        pluginId: args.pluginId,
        isActive: args.isActive ?? true,
        publicSlug: args.publicSlug,
        customDomain: args.customDomain,
        settings: args.settings,
      } as any);
    }
    return { success: true };
  },
});

export const remove = createOrgMutation({})({
  args: { pluginId: z.string() },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.table('pluginInstances', 'organizationId_pluginId', (q) =>
      q.eq('organizationId', ctx.orgId).eq('pluginId', args.pluginId)
    ).first();
    if (!existing) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Plugin tidak ditemukan' });
    }
    await existing.delete();
    return { success: true };
  },
});
```

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && npx convex typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/plugins.ts
git commit -m "feat(convex): plugin CRUD — list, getActive, getBySlug, getByDomain, upsert, remove"
```

---

### Task 3: Frontend — Plugin Registry & Types

**Files:**
- Create: `apps/web/src/lib/plugins/registry.ts`
- Create: `apps/web/src/lib/plugins/types.ts`

**Step 1: Buat types**

`apps/web/src/lib/plugins/types.ts`:

```typescript
import { type LucideIcon } from 'lucide-react';

export interface PluginSetting {
  key: string;
  label: string;
  type: 'text' | 'boolean' | 'select' | 'secret';
  default?: any;
  options?: { label: string; value: string }[];
}

export interface CRMPlugin {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  version: string;
  routePrefix: string;
  navItems: PluginNavItem[];
  settings: PluginSetting[];
}

export interface PluginNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface PluginInstance {
  id: string;
  pluginId: string;
  isActive: boolean;
  publicSlug?: string;
  customDomain?: string;
  settings?: any;
}
```

**Step 2: Buat registry**

`apps/web/src/lib/plugins/registry.ts`:

```typescript
import {
  ShoppingBag,
  Package,
  CreditCard,
  Settings,
  Store,
} from 'lucide-react';
import type { CRMPlugin } from './types';

export const PLUGINS: CRMPlugin[] = [
  {
    id: 'ecommerce',
    name: 'Toko Online',
    description: 'Jual produk online, terima pembayaran, kelola pesanan',
    icon: ShoppingBag,
    version: '1.0.0',
    routePrefix: 'shop',
    navItems: [
      { label: 'Produk', href: '/products/manage', icon: Package },
      { label: 'Pesanan', href: '/shop-orders', icon: ShoppingBag },
      { label: 'Pembayaran', href: '/payments', icon: CreditCard },
      { label: 'Pengaturan Toko', href: '/settings/shop', icon: Settings },
    ],
    settings: [
      { key: 'isActive', label: 'Toko Aktif', type: 'boolean', default: false },
      {
        key: 'currency',
        label: 'Mata Uang',
        type: 'select',
        default: 'IDR',
        options: [
          { label: 'IDR (Rupiah)', value: 'IDR' },
          { label: 'USD (Dollar)', value: 'USD' },
        ],
      },
      { key: 'midtransClientKey', label: 'Midtrans Client Key', type: 'secret' },
      { key: 'midtransServerKey', label: 'Midtrans Server Key', type: 'secret' },
    ],
  },
];

export function getPlugin(id: string): CRMPlugin | undefined {
  return PLUGINS.find((p) => p.id === id);
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/plugins/
git commit -m "feat(web): plugin registry types + ecommerce plugin definition"
```

---

### Task 4: Refactor Shop Routes — `/shop/[slug]/*`

**Files:**
- Move: `apps/web/src/app/shop/page.tsx` → `apps/web/src/app/shop/[slug]/page.tsx`
- Move: `apps/web/src/app/shop/products/page.tsx` → `apps/web/src/app/shop/[slug]/products/page.tsx`
- Move: `apps/web/src/app/shop/products/[id]/page.tsx` → `apps/web/src/app/shop/[slug]/products/[id]/page.tsx`
- Move: `apps/web/src/app/shop/cart/page.tsx` → `apps/web/src/app/shop/[slug]/cart/page.tsx`
- Move: `apps/web/src/app/shop/checkout/page.tsx` → `apps/web/src/app/shop/[slug]/checkout/page.tsx`
- Move: `apps/web/src/app/shop/checkout/success/page.tsx` → `apps/web/src/app/shop/[slug]/checkout/success/page.tsx`
- Move: `apps/web/src/app/shop/checkout/failed/page.tsx` → `apps/web/src/app/shop/[slug]/checkout/failed/page.tsx`
- Move: `apps/web/src/app/shop/checkout/pending/page.tsx` → `apps/web/src/app/shop/[slug]/checkout/pending/page.tsx`
- Modify: semua file yang berpindah — ganti `const ORG_SLUG = 'default'` jadi `const slug = params.slug` (atau `useParams()`)

**Step 1: Buat struktur folder baru**

```bash
cd /Users/madearga/Desktop/crm/apps/web/src/app/shop
mkdir -p "[slug]"/products/"[id]" "[slug]"/cart "[slug]"/checkout/success "[slug]"/checkout/failed "[slug]"/checkout/pending
```

**Step 2: Pindahkan semua page ke `[slug]` subfolder**

```bash
mv page.tsx "[slug]/page.tsx"
mv products/page.tsx "[slug]/products/page.tsx"
mv products/[id]/page.tsx "[slug]/products/[id]/page.tsx"
mv cart/page.tsx "[slug]/cart/page.tsx"
mv checkout/page.tsx "[slug]/checkout/page.tsx"
mv checkout/success/page.tsx "[slug]/checkout/success/page.tsx"
mv checkout/failed/page.tsx "[slug]/checkout/failed/page.tsx"
mv checkout/pending/page.tsx "[slug]/checkout/pending/page.tsx"
```

**Step 3: Di setiap file, ganti hardcoded slug**

Pola yang sama di semua file:

```typescript
// SEBELUM:
const ORG_SLUG = 'default';
// ... gunakan ORG_SLUG

// SESUDAH (untuk page component dengan params):
export default async function ShopPage({ params }: { params: { slug: string } }) {
  return <ShopPageClient slug={params.slug} />;
}

// Atau untuk 'use client' components:
const params = useParams();
const slug = params.slug as string;
```

File yang perlu diubah (7 file):

1. `[slug]/page.tsx` — home toko
2. `[slug]/products/page.tsx` — katalog produk
3. `[slug]/products/[id]/page.tsx` — detail produk
4. `[slug]/cart/page.tsx` — keranjang
5. `[slug]/checkout/page.tsx` — checkout
6. `[slug]/checkout/success/page.tsx` — sukses
7. `[slug]/checkout/failed/page.tsx` — gagal
8. `[slug]/checkout/pending/page.tsx` — pending

Setiap file: hapus `const ORG_SLUG = 'default'`, dapatkan slug dari `params.slug`, ganti semua `ORG_SLUG` jadi `slug`.

**Step 4: Update layout.tsx**

`apps/web/src/app/shop/layout.tsx` — TIDAK berubah (masih wrap semua `/shop/*`).

Tambah validasi di layout: cek slug valid → lookup pluginInstances → redirect jika tidak ada.

**Step 5: Update internal links**

Semua `<Link href="/shop/...">` perlu tambah slug:
- `/shop/products` → `/shop/${slug}/products`
- `/shop/cart` → `/shop/${slug}/cart`
- `/shop/checkout` → `/shop/${slug}/checkout`

File komponen yang perlu update:
- `components/shop/shop-navbar.tsx` — navbar links
- `components/shop/shop-footer.tsx` — footer links
- `components/shop/product-card.tsx` — product link
- `components/shop/product-grid.tsx` — pass slug prop
- `components/shop/add-to-cart-button.tsx` — cart redirect
- `components/shop/checkout-form.tsx` — checkout action

**Step 6: Run build**

Run: `cd /Users/madearga/Desktop/crm/apps/web && npx next build --no-lint`
Expected: PASS (0 errors)

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor(shop): move /shop/* to /shop/[slug]/* — dynamic multi-tenant routing"
```

---

### Task 5: Update Shop Layout — Slug Context Provider

**Files:**
- Modify: `apps/web/src/app/shop/layout.tsx`
- Create: `apps/web/src/lib/plugins/shop-context.tsx`

**Step 1: Buat ShopSlug context**

`apps/web/src/lib/plugins/shop-context.tsx`:

```typescript
'use client';

import { createContext, useContext, type ReactNode } from 'react';

const ShopSlugContext = createContext<string>('');

export function ShopSlugProvider({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <ShopSlugContext.Provider value={slug}>
      {children}
    </ShopSlugContext.Provider>
  );
}

export function useShopSlug() {
  const slug = useContext(ShopSlugContext);
  if (!slug) throw new Error('useShopSlug must be used within ShopSlugProvider');
  return slug;
}
```

**Step 2: Update layout.tsx untuk wrap ShopSlugProvider**

Di `shop/layout.tsx`, tambahkan slug extraction dan provider.

**Step 3: Commit**

```bash
git add apps/web/src/lib/plugins/shop-context.tsx apps/web/src/app/shop/layout.tsx
git commit -m "feat(shop): ShopSlug context provider — all shop components access slug"
```

---

### Task 6: Shop Navbar & Footer — Dynamic Slug Links

**Files:**
- Modify: `apps/web/src/components/shop/shop-navbar.tsx`
- Modify: `apps/web/src/components/shop/shop-footer.tsx`
- Modify: `apps/web/src/components/shop/product-card.tsx`
- Modify: `apps/web/src/components/shop/product-grid.tsx`
- Modify: `apps/web/src/components/shop/add-to-cart-button.tsx`

**Step 1: Update semua komponen shop**

Setiap komponen yang hardcode `/shop/...` ganti pakai `useShopSlug()`:

```typescript
import { useShopSlug } from '@/lib/plugins/shop-context';

// Di dalam component:
const slug = useShopSlug();

// Link:
<Link href={`/shop/${slug}/products`}>Products</Link>
```

**Step 2: Run build**

Run: `cd /Users/madearga/Desktop/crm/apps/web && npx next build --no-lint`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(shop): dynamic slug links in navbar, footer, product cards"
```

---

### Task 7: Redirect `/shop` → Org Default Slug

**Files:**
- Create: `apps/web/src/app/shop/page.tsx` (redirect page)

**Step 1: Buat redirect page di `/shop` (tanpa slug)**

`apps/web/src/app/shop/page.tsx`:

```typescript
import { redirect } from 'next/navigation';

// /shop tanpa slug → redirect ke /shop/[org-slug] default
// Untuk sekarang redirect ke dashboard dengan pesan
export default function ShopRootPage() {
  redirect('/settings/plugins');
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/shop/page.tsx
git commit -m "feat(shop): redirect /shop root to plugin settings"
```

---

### Task 8: Middleware — Custom Domain → Slug Mapping

**Files:**
- Create: `apps/web/src/middleware.ts`

**Step 1: Buat middleware**

```typescript
import { NextRequest, NextResponse } from 'next/server';

const APP_DOMAINS = ['localhost', 'crmkita.com'];

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]; // strip port
  const url = request.nextUrl;

  // Skip jika domain utama atau localhost
  if (!host || APP_DOMAINS.some((d) => host.endsWith(d))) {
    return NextResponse.next();
  }

  // Custom domain: rewrite ke /shop/[slug]/*
  // Lookup akan dilakukan client-side di layout untuk sekarang
  // (edge function convex tidak tersedia di free tier)
  // Untuk Phase 1: simpan mapping di env, nanti pindah ke edge DB
  
  // FUTURE: lookup slug from edge KV / Convex HTTP endpoint
  // const slug = await fetch(`https://crm-api.com/api/resolve-domain?domain=${host}`);
  // if (slug) url.pathname = `/shop/${slug}${url.pathname}`;
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

Catatan: Full custom domain resolution butuh edge KV atau Convex HTTP endpoint. Phase 1 fokus path-based dulu. Middleware disiapkan sebagai placeholder.

**Step 2: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(middleware): placeholder custom domain → slug mapping"
```

---

### Task 9: Dashboard — Plugin Settings Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/plugins/page.tsx`

**Step 1: Buat halaman settings/plugins**

UI: Grid kartu plugin. Setiap kartu:
- Icon + nama + deskripsi
- Toggle aktif/nonaktif
- Input public slug (unique)
- Input custom domain
- Settings per plugin (Midtrans keys, dll)
- Tombol Simpan

Gunakan `useConfirmDialog`, `ui` messages dari lib/ui-messages.

Query: `api.plugins.list` → daftar plugin aktif
Mutation: `api.plugins.upsert` → simpan perubahan

**Step 2: Update settings layout**

Tambah tab "Plugins" di settings layout nav.

**Step 3: Run build**

Run: `cd /Users/madearga/Desktop/crm/apps/web && npx next build --no-lint`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(settings): plugin management page — enable/disable, slug, domain config"
```

---

### Task 10: Dynamic Sidebar — Show Plugin Nav Items

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

**Step 1: Query active plugins di dashboard layout**

```typescript
import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { PLUGINS } from '@/lib/plugins/registry';

// Di dalam DashboardLayout component:
const { data: activePluginIds } = useAuthQuery(api.plugins.getActive, {});

// Generate nav items dari plugin aktif
const pluginNavItems = useMemo(() => {
  if (!activePluginIds) return [];
  return activePluginIds.flatMap((pluginId: string) => {
    const plugin = PLUGINS.find((p) => p.id === pluginId);
    if (!plugin) return [];
    return plugin.navItems.map((item) => ({
      title: `${plugin.name}: ${item.label}`,
      href: item.href,
      icon: item.icon,
    }));
  });
}, [activePluginIds]);

// Gabungkan core nav + plugin nav
const allNavItems = [...navItems, ...pluginNavItems];
```

**Step 2: Gunakan allNavItems di sidebar**

Ganti `navItems` jadi `allNavItems` di sidebar render.

**Step 3: Run build**

Run: `cd /Users/madearga/Desktop/crm/apps/web && npx next build --no-lint`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "feat(dashboard): dynamic sidebar — plugin nav items shown when active"
```

---

### Task 11: Migration — Auto-Create Ecommerce Plugin for Existing Orgs

**Files:**
- Create: `convex/migrations/seedPluginInstances.ts`

**Step 1: Buat migration script**

```typescript
// convex/migrations/seedPluginInstances.ts
// Run manually via convex dashboard or http action
import { mutation } from '../_generated/server';
import { v } from 'convex/values';

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all organizations
    const orgs = await ctx.db.query('organization').collect();
    let created = 0;

    for (const org of orgs) {
      // Check if ecommerce plugin already exists
      const existing = await ctx.db
        .query('pluginInstances')
        .filter((q) => q.eq(q.field('organizationId'), org._id))
        .first();

      if (!existing && org.slug) {
        await ctx.db.insert('pluginInstances', {
          organizationId: org._id,
          pluginId: 'ecommerce',
          isActive: false, // Default inactive, user must enable
          publicSlug: org.slug,
        });
        created++;
      }
    }

    return { total: orgs.length, created };
  },
});
```

**Step 2: Run migration via Convex dashboard**

Buka `https://dashboard.convex.dev` → Functions → `migrations/seedPluginInstances:seedAll` → Run

**Step 3: Commit**

```bash
git add convex/migrations/
git commit -m "feat(migration): seed pluginInstances for existing orgs"
```

---

### Task 12: Final Verification — Build + Typecheck + Manual Test

**Step 1: Full typecheck**

Run: `cd /Users/madearga/Desktop/crm && npx convex typecheck`
Expected: PASS

**Step 2: Full build**

Run: `cd /Users/madearga/Desktop/crm/apps/web && npx next build`
Expected: 0 errors

**Step 3: Manual test checklist**

- [ ] `/settings/plugins` — muncul di sidebar settings
- [ ] Enable ecommerce plugin → isi slug → simpan
- [ ] `/shop/[slug]` — homepage toko tampil
- [ ] `/shop/[slug]/products` — produk tampil
- [ ] `/shop/[slug]/cart` — keranjang berfungsi
- [ ] `/shop/[slug]/checkout` — checkout berfungsi
- [ ] Sidebar dashboard — muncul nav items ecommerce setelah plugin aktif
- [ ] `/shop` (tanpa slug) → redirect ke settings

**Step 4: Final commit + push**

```bash
git add -A
git commit -m "chore: plugin architecture Phase 1 complete"
git push
```

---

## Dependency Graph

```
Task 1 (schema)
  └── Task 2 (convex functions)
       └── Task 3 (registry)
            ├── Task 4 (routes refactor)  ← biggest task
            │    ├── Task 5 (slug context)
            │    └── Task 6 (dynamic links)
            ├── Task 7 (redirect)
            └── Task 9 (settings page)
                 └── Task 10 (sidebar)

Task 8 (middleware) ← independent
Task 11 (migration) ← depends on Task 1
Task 12 (verify) ← depends on all
```

## Estimated Time

| Task | Est. |
|------|------|
| Task 1: Schema | 5 min |
| Task 2: Convex functions | 15 min |
| Task 3: Plugin registry | 10 min |
| Task 4: Route refactor | 30 min (biggest) |
| Task 5: Slug context | 10 min |
| Task 6: Dynamic links | 15 min |
| Task 7: Redirect | 5 min |
| Task 8: Middleware | 10 min |
| Task 9: Settings page | 20 min |
| Task 10: Sidebar | 10 min |
| Task 11: Migration | 10 min |
| Task 12: Verify | 15 min |
| **Total** | **~2.5 hours** |
