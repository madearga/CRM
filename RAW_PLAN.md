# CRM Modular — Strategic Plan

> Versi: 1.0 | Tanggal: 2026-05-08  
> Status: Explore mode output — belum committed  
> Stack: Convex + Next.js + Better Auth + TypeScript  
> Deployment: Convex Cloud (managed) / Self-host (Docker)

---

## Daftar Isi

1. [Visi Produk](#1-visi-produk)
2. [Status Codebase Saat Ini](#2-status-codebase-saat-ini)
3. [Arsitektur Modular](#3-arsitektur-modular)
4. [Infrastruktur & Biaya](#4-infrastruktur--biaya)
5. [Analisis Kompetitor](#5-analisis-kompetitor)
6. [Pricing Strategy](#6-pricing-strategy)
7. [Open Source Strategy](#7-open-source-strategy)
8. [Ansoff Matrix — Growth Strategy](#8-ansoff-matrix--growth-strategy)
9. [Module Pipeline](#9-module-pipeline)
10. [Revenue Projection](#10-revenue-projection)
11. [Risks & Mitigasi](#11-risks--mitigasi)
12. [Phased Roadmap](#12-phased-roadmap)

---

## 1. Visi Produk

**"Modular Business OS untuk UMKM — mulai dari yang kamu butuh, tambah seiring bertumbuh."**

Platform CRM/ERP modular multi-tenant yang memungkinkan user memilih dan membayar hanya fitur yang mereka butuhkan:

- Hanya butuh toko online? Aktifkan Commerce module.
- Hanya butuh manajemen HR? Aktifkan HR module.
- Butuh semuanya? Aktifkan semua module.

**Target market utama**: UMKM Indonesia (5-50 karyawan), dengan potensi ekspansi ke Asia Tenggara dan vertical industry tertentu.

**Model**: Multi-tenant SaaS + self-hostable open source.

---

## 2. Status Codebase Saat Ini

### 2.1 Codebase Inventory

| Area | Detail |
|------|--------|
| Monorepo | Turborepo + pnpm workspaces |
| Backend | `convex/` — 99 files, 28,646 LOC, 281 functions |
| Frontend | `apps/web/` — 275 files (Next.js 15, App Router) |
| Mobile | `apps/mobile/` — Expo placeholder (kosong) |
| Schema | 57 tabel, 1,428 baris (`convex/schema.ts`) |
| Auth | Better Auth + organization system |
| Payment | Midtrans Snap API |
| Email | Resend (via `@convex-dev/resend`) |
| AI | AI Chat + Tools (built-in assistant) |
| Plugins | `pluginInstances` + `externalPlugins` tables |
| License | MIT (perlu review untuk open source launch) |

### 2.2 Modularitas yang Sudah Ada

```
✅ SUDAH TERSEDIA
├── organizationId di 147 index → data isolation per org
├── pluginInstances table → toggle plugin per org
├── externalPlugins table → URL-based plugin system
├── isActive flag → on/off per org
├── publicSlug → /shop/tokobudi (public storefront)
├── createOrgQuery() / createOrgMutation() → org-scoped queries
├── member + invitation tables → multi-member org
├── permissionTemplates + permissionEntries → RBAC per org
├── navGroups dengan ID per module di navigation.ts
├── featureMap untuk route-to-feature mapping
├── PaymentProvider interface → pluggable payment gateway
└── /settings/plugins → UI manage plugins

❌ BELUM ADA
├── org.modules config (module registry per org)
├── Module guard pattern di backend
├── Conditional sidebar/route berdasarkan modules
├── License validation untuk premium modules
├── Docker Compose untuk self-host
└── Marketplace infrastructure
```

### 2.3 Module yang Teridentifikasi dari Codebase

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ Module   │ Fitur dalam codebase                                        │
├──────────┼──────────────────────────────────────────────────────────────┤
│ CORE     │ Auth, Organization, Members, Invitations, Permissions,      │
│ (wajib)  │ Settings, Search                                            │
├──────────┼──────────────────────────────────────────────────────────────┤
│ CRM      │ Dashboard, Companies, Contacts, Deals pipeline, Activities, │
│          │ Analytics, Weekly Digest, Search                             │
├──────────┼──────────────────────────────────────────────────────────────┤
│ FINANCE  │ Products, Sale Orders, Invoices, Invoice Lines, Payments,   │
│          │ Payment Terms, Taxes, Recurring Invoices, Templates,        │
│          │ Pricelists, Price Rules                                      │
├──────────┼──────────────────────────────────────────────────────────────┤
│ HR       │ Employees, Branches, Shifts, Shift Assignments, Attendance, │
│          │ Corrections, Holidays, Reports                               │
├──────────┼──────────────────────────────────────────────────────────────┤
│ COMMERCE │ Public storefront ([slug]/), Products, Cart, Checkout,       │
│          │ Shop Orders, Shop Order Items, Order Counters,               │
│          │ Connected Stores, Payment Providers, Customers               │
├──────────┼──────────────────────────────────────────────────────────────┤
│ BILLING  │ Subscription Templates, Subscription Lines,                  │
│          │ Auto-generate Invoice, Recurring Billing Cycle               │
├──────────┼──────────────────────────────────────────────────────────────┤
│ AI CHAT  │ AI Chat Conversations, AI Chat Messages, AI Tools,           │
│          │ AI System Prompt, Tool Execution                             │
└──────────┴──────────────────────────────────────────────────────────────┘
```

### 2.4 Module Dependency Map

```
           CORE (always on)
          /    |    \
      CRM    HR    Products ←──── shared resource
        \         /    \
       Finance ──→    Billing
          \               
         Commerce

Rules:
• Commerce requires Finance + Products
• Billing requires Finance
• Finance requires Products
• HR is fully independent
• CRM is fully independent
• AI Chat can work with any module (reads data across modules)
```

---

## 3. Arsitektur Modular

### 3.1 Arsitektur Target

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  TENANT LEVEL                                                               │
│                                                                             │
│  org.settings = {                                                           │
│    currency: 'IDR',                                                         │
│    modules: ['crm', 'finance', 'commerce'],  ← module registry per org     │
│    ...                                                                      │
│  }                                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │                                                             │            │
│  │  BACKEND (convex/)                                          │            │
│  │                                                             │            │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │            │
│  │  │ CRM     │  │ Finance │  │ HR      │  │ Commerce│      │            │
│  │  │ queries │  │ queries │  │ queries │  │ queries │      │            │
│  │  │ mut.    │  │ mut.    │  │ mut.    │  │ mut.    │      │            │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘      │            │
│  │       │            │            │            │             │            │
│  │       ▼            ▼            ▼            ▼             │            │
│  │  ┌──────────────────────────────────────────────────┐      │            │
│  │  │           MODULE GUARD LAYER                      │      │            │
│  │  │  requireModule('hr') → check org.settings.modules │      │            │
│  │  │  throw ConvexError if module not active            │      │            │
│  │  └──────────────────────────────────────────────────┘      │            │
│  │                                                             │            │
│  │  Schema: tetap 1 schema (Convex limitation)                │            │
│  │  Tabel tetap ada semua, tapi di-guard di application layer │            │
│  │                                                             │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │                                                             │            │
│  │  FRONTEND (apps/web/)                                       │            │
│  │                                                             │            │
│  │  navigation.ts → filter navGroups by org.modules            │            │
│  │  Route guard → redirect ke /upgrade kalau module inactive   │            │
│  │  Conditional render → hide UI element berdasarkan modules   │            │
│  │                                                             │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Implementasi Module Guard

**Backend — functions.ts addition:**

```typescript
// Convex function wrapper — module guard
function requireModule(module: string) {
  return async (ctx: OrgCtx) => {
    const modules = ctx.org.settings?.modules ?? ['crm'];
    if (!modules.includes(module)) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: `Module "${module}" not activated for this organization`,
      });
    }
  };
}

// Usage in hrEmployees.ts
export const list = createOrgQuery({
  guards: [requireModule('hr')],
})({ ... });
```

**Frontend — navigation.ts update:**

```typescript
export function getNavGroups(activeModules: string[]): NavGroupConfig[] {
  return navGroups.filter((g) => {
    if (g.id === 'system') return true; // always visible
    if (g.id === 'crm') return true;    // base module
    return activeModules.includes(g.id);
  });
}
```

**Onboarding — module selection:**

```typescript
// Step 1: Create org (sudah ada)
// Step 2: Pilih modul (BARU)
// Step 3: Setup each module (BARU)

const defaultModules = ['crm']; // base always included
const selectedModules = ['hr', 'commerce']; // user picks
await ctx.org.patch({
  settings: { ...settings, modules: [...defaultModules, ...selectedModules] }
});
```

### 3.3 Convex & Self-Host

Convex backend **bisa di-self-host** via Docker:

- GitHub: `github.com/get-convex/convex-backend` (11,540 stars)
- License: FSL-1.1-Apache-2.0 (auto-convert ke Apache 2.0 setelah 2 tahun)
- Self-host: Docker binary, support SQLite/PostgreSQL
- Dashboard included
- Works with: Neon, Fly.io, Vercel, Netlify, RDS

**Implikasi untuk produk ini:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SELF-HOST USER EXPERIENCE:                                 │
│                                                             │
│  1. Fork/clone CRM repo                                    │
│  2. docker compose up (Convex backend + Next.js)            │
│  3. Setup env vars                                          │
│  4. npx convex deploy (ke Convex self-hosted)               │
│  5. Jalan! Data 100% di server user                        │
│                                                             │
│  CLOUD USER EXPERIENCE:                                     │
│                                                             │
│  1. Signup di website                                       │
│  2. Pilih modul                                             │
│  3. Langsung pakai                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

FSL license Convex memperbolehkan penggunaan untuk membangun produk di atas Convex — tidak melanggar karena CRM ini bukan "substitutes for Convex", melainkan produk yang BERTUMPUK pada Convex.

---

## 4. Infrastruktur & Biaya

### 4.1 Arsitektur Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Browser / Mobile App                                                      │
│      │                                                                      │
│      ▼                                                                      │
│   ┌──────────────────┐         ┌─────────────────────────┐                 │
│   │   Next.js (SSR)  │────────▶│    Convex Cloud         │                 │
│   │   Vercel Pro     │  API    │    (or self-hosted)      │                 │
│   │                  │────────▶│                         │                 │
│   │  • App Router    │         │  • 57 tabel             │                 │
│   │  • SSR + RSC     │         │  • 281 functions        │                 │
│   │  • shadcn/ui     │         │  • 3 cron jobs          │                 │
│   └──────────────────┘         │  • Realtime subscriptions│                 │
│         │                      │  • Better Auth           │                 │
│         │                      │  • Rate limiting         │                 │
│         ▼                      │  • Aggregate indexes     │                 │
│   ┌──────────────┐             │  • Email (Resend)        │                 │
│   │  Midtrans    │◀── webhook ─│                         │                 │
│   │  (Snap API)  │             └─────────────────────────┘                 │
│   │  Payment GW  │                     │                                    │
│   └──────────────┘                     ▼                                    │
│          │                     ┌──────────────┐                             │
│          ▼                     │  Resend      │                             │
│   ┌──────────────┐             │  Email        │                             │
│   │  QRIS, VA    │             │  delivery     │                             │
│   │  GoPay, dll  │             └──────────────┘                             │
│   └──────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Convex Cloud Pricing

| Plan | Free | Pro ($25/bln) | Enterprise |
|------|------|---------------|------------|
| Storage | 1 GB | 10 GB | custom |
| Bandwidth | 5 GB/bln | 50 GB/bln | custom |
| Function calls | 1M/bln | 10M/bln | custom |
| Cron jobs | 3 | 20 | custom |
| WebSocket conn | 100 | 10,000 | custom |

Overages (Pro): Storage $0.15/GB, Bandwidth $0.10/GB, Functions $0.50/1M

**Key insight**: Convex pricing per deployment, bukan per user. Semua org share 1 deployment = efisien untuk multi-tenant.

### 4.3 Next.js Hosting

| Option | Cost/bln | Notes |
|--------|----------|-------|
| Vercel Pro | $20 | Recommended — native Next.js, edge, auto-scaling |
| Railway | ~$5-20 | Docker-based, simple |
| Fly.io | ~$5-20 | Docker, multi-region |
| Self-host VPS | ~$10-30 | Full control, maintenance |

### 4.4 Cost Projection per Scale

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  1-100 ORG (LAUNCH)                                             │
│  ─────────────────                                              │
│  Convex Pro          $25     Rp400k                              │
│  Vercel Pro          $20     Rp320k                              │
│  Domain              $2      Rp32k                               │
│  Resend (email)      $0-20   Rp0-320k                            │
│  ──────────────────────────────────                              │
│  TOTAL               ~$47    Rp750k/bln                          │
│                                                                  │
│  Revenue: 50 org × Rp99k = Rp4.95jt → PROFIT Rp4.2jt ✓        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  100-500 ORG (GROWTH)                                           │
│  ──────────────────────                                          │
│  Convex Pro+overage   $50-80    Rp800k-1.3jt                     │
│  Vercel Pro+usage     $30-50    Rp480k-800k                      │
│  Resend               $20       Rp320k                           │
│  Monitoring (Sentry)  $26       Rp416k                           │
│  ──────────────────────────────────                              │
│  TOTAL               ~$130-180  Rp2-3jt/bln                      │
│                                                                  │
│  Revenue: 300 org × avg Rp200k = Rp60jt → PROFIT Rp57jt ✓     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  500-2000 ORG (SCALE)                                           │
│  ────────────────────────                                        │
│  Convex Enterprise    custom    est Rp3-5jt                       │
│  Vercel Enterprise    custom    est Rp1-2jt                       │
│  Resend               $50-100   est Rp800k-1.6jt                  │
│  Infra lain           est       Rp500k-1jt                       │
│  ──────────────────────────────────                              │
│  TOTAL               est Rp5-10jt/bln                            │
│                                                                  │
│  Revenue: 1500 org × avg Rp250k = Rp375jt → PROFIT Rp365jt ✓  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.5 Unit Economics

```
Revenue per org:      Rp99k-545k/bln (base + add-ons)
Cost per org:         ~Rp5-15k (Convex + Vercel marginal cost)
Gross margin:         90-95%

Convex marginal cost per org:
• Storage: ~5-50MB per org (contacts, deals, invoices)
• Function calls: ~500-5,000/org/hari (active use)
• At 500 org → ~2.5M calls/hari → fits Pro plan

Break-even: Rp750k fixed cost ÷ Rp99k per org = ~8 org bayar
```

### 4.6 Convex sebagai Competitive Advantage

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Competitor stack (Jurnal, Kledo, HashMicro):               │
│  • PostgreSQL (RDS)        ~$50-200/bln                    │
│  • Redis cache             ~$10-50/bln                     │
│  • App server (EC2/ECS)    ~$50-500/bln                    │
│  • WebSocket infrastructure ~$20-100/bln                   │
│  • Background jobs         ~$10-50/bln                     │
│  • DevOps maintenance      TIME                            │
│  ────────────────────────────                               │
│  TOTAL                    ~$140-900/bln                     │
│                                                             │
│  Our stack (Convex):                                        │
│  • Database           ✅ included                           │
│  • Realtime           ✅ built-in                           │
│  • Backend functions  ✅ included                           │
│  • Cron jobs          ✅ included                           │
│  • File storage       ✅ included                           │
│  • Auth integration   ✅ Better Auth                        │
│  • Rate limiting      ✅ built-in                           │
│  • Zero DevOps        ✅ no server management               │
│  ────────────────────────────                               │
│  TOTAL                    $25-80/bln                        │
│                                                             │
│  3-10x lebih murah di awal. Scaling otomatis tanpa devops. │
│  Ini memungkinkan pricing UMKM yang competitor tidak bisa. │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Analisis Kompetitor

### 5.1 Market Overview

- **Market**: SaaS platform UMKM Indonesia — CRM, billing, toko online, HR
- **UMKM Indonesia**: ~66 juta usaha (Kemenkop 2024)
- **SaaS penetration UMKM**: sangat rendah (~5-8%)
- **SAM**: ~3-5 juta UMKM yang sudah digital aktif
- **Key dynamics**: price-sensitive, mayoritas masih pakai WhatsApp + Excel, permintaan all-in-one tinggi tapi budget rendah

### 5.2 Competitive Set

```
┌──────────┬───────────────────┬──────────────────────────────────────┐
│ #        │ Competitor        │ Focus                                 │
├──────────┼───────────────────┼──────────────────────────────────────┤
│ 1        │ Jurnal by Mekari  │ Accounting + Billing (LEADER)         │
│ 2        │ Kledo             │ Accounting + Inventory (CHALLENGER)   │
│ 3        │ Paper.id          │ Invoicing + Inventory (NICHE)         │
│ 4        │ HashMicro         │ ERP Modular — CRM+HR+Inv (CHALLENGER)│
│ 5        │ Odoo              │ Full modular ERP (GLOBAL LEADER)      │
├──────────┼───────────────────┼──────────────────────────────────────┤
│ Adjacent │ Moka POS          │ F&B retail POS                        │
│          │ Olsera            │ POS + toko online UMKM                │
│          │ Juragan ERP       │ ERP UMKM Indonesia                    │
│          │ Twenty CRM        │ Open source CRM (global, AGPLv3)      │
│          │ Midday.ai         │ Open source finance (AGPLv3)          │
└──────────┴───────────────────┴──────────────────────────────────────┘
```

### 5.3 Competitor Profiles

#### Jurnal by Mekari

| Aspect | Detail |
|--------|--------|
| Founded | 2015, bagian Mekari (Series C+) |
| Customers | 40,000+ bisnis Indonesia |
| Strengths | Brand trust, accounting depth (jurnal, neraca, pajak), ekosistem Mekari (KlikPajak, Talenta, Qontak), compliance Indonesia |
| Weaknesses | CRM basic (via Qontak terpisah), tidak ada toko online, HR terpisah (Talenta — bayar terpisah), pricing mahal untuk UMKM |
| Pricing | Pro Rp549k/bln (1 user), Enterprise custom |
| Threat | ●●●○○ SEDANG — kuat di accounting, bukan all-in-one |

#### Kledo

| Aspect | Detail |
|--------|--------|
| Founded | 2017, Bandung |
| Customers | 35,000+ bisnis |
| Strengths | Pricing accessible (Rp99k start), inventory kuat, multi-cabang/gudang, integrasi marketplace (Tokopedia, Shopee) |
| Weaknesses | Tidak ada CRM, tidak ada HR, tidak ada toko online, murni accounting/inventory |
| Pricing | Lite Rp99k, Pro Rp299k, Enterprise Rp599k |
| Threat | ●●●○○ SEDANG — saingan di finance/inventory |

#### Paper.id

| Aspect | Detail |
|--------|--------|
| Founded | 2017, YC-backed |
| Customers | ~10,000 bisnis |
| Strengths | Invoice management terbaik, payment link, integrasi Midtrans/Xendit, free tier generous, recurring invoice |
| Weaknesses | Hanya invoicing — tidak ada CRM, HR, commerce, deal pipeline |
| Pricing | Free (10 invoice/bln), Pro Rp149k, Business Rp399k |
| Threat | ●●○○○ RENDAH — overlap kecil di invoicing |

#### HashMicro

| Aspect | Detail |
|--------|--------|
| Founded | 2012, Singapore-based |
| Strengths | **MODULAR** — ini pesaing paling dekat dengan visi kita, CRM + HRM + Inventory + Accounting dalam 1 platform, reporting kuat |
| Weaknesses | Pricing opaque (request quote), UI enterprise/berat, implementasi lama, tidak ada toko online, tidak ada payment gateway native, tidak ada AI chat |
| Pricing | Estimasi Rp500k-2jt/bln + setup fee |
| Threat | ●●●●● TINGGI — paling dekat visi modular, tapi beda segment |

#### Odoo

| Aspect | Detail |
|--------|--------|
| Founded | 2005, Belgium |
| Users | ~5M worldwide |
| Strengths | SANGAT MODULAR (install/uninstall apps), 30,000+ modules, mature ecosystem, community edition free |
| Weaknesses | Lokalisasi Indonesia lemah, UI overwhelming, self-host butuh technical expertise, pricing $25-40/user/bln, bahasa Indonesia partial |
| Pricing | Community free (self-host), Enterprise $25-40/user/bln |
| Threat | ●●●●● TINGGI — competitor konseptual terbesar, tapi gap di lokal Indonesia besar |

### 5.4 Feature Matrix

```
                     Jurnal  Kledo  Paper  HashM  Odoo  │  KAMU
                    ─────── ────── ────── ────── ─────  │  ──────────────
  Accounting           ●●●    ●●●    ●●     ●●    ●●●   │  ●●
  Invoicing            ●●●    ●●●    ●●●    ●●    ●●●   │  ●●●
  CRM / Pipeline       ●      ○      ○      ●●    ●●●   │  ●●●
  HR / Attendance      ●*     ○      ○      ●●●   ●●●   │  ●●●
  Toko Online          ○      ○      ○      ○     ●●    │  ●●●
  Payment Gateway ID   ●●     ●●     ●●●    ●     ○     │  ●●●
  Modular              ○      ○      ○      ●●    ●●●   │  ●●●  ← key
  AI Chat              ○      ○      ○      ○     ○     │  ●●●  ← unique
  Localization ID      ●●●    ●●●    ●●●    ●●    ●     │  ●●●
  Pricing UMKM         ●      ●●     ●●●    ●     ●     │  ●●●  ← key
  Subscription Billing ●      ●●     ●●     ●     ●●    │  ●●●

  ●●● = kuat   ●● = baik   ● = basic   ○ = tidak ada
  * = terpisah sebagai produk lain
```

### 5.5 Differentiation Opportunities

**5 keunggulan competitive yang bisa dikuasai:**

1. **Modular + Terjangkau**
   - Odoo modular tapi mahal & tidak localized
   - HashMicro modular tapi enterprise-priced
   - Kita: modular + UMKM price (Rp99k start)
   - **Space ini KOSONG. Tidak ada yang punya keduanya.**

2. **Toko Online Terintegrasi + CRM**
   - Competitor punya invoicing ATAU toko, tidak keduanya
   - Kita: storefront + checkout + CRM + invoice otomatis
   - Order masuk → invoice auto-generate → payment tracking
   - **Tidak ada di pasar Indonesia.**

3. **AI Assistant Native**
   - Tidak ada competitor Indonesia yang punya AI chat di CRM
   - aiChat + aiTools sudah di codebase
   - "Tolong buat invoice untuk PT X senilai 5juta" → done
   - **Game-changer untuk UMKM yang tidak terbiasa software.**

4. **HR UMKM (bukan enterprise)**
   - Jurnal HR = Talenta (mahal, enterprise)
   - Odoo HR = kompleks, overkill untuk 5-20 karyawan
   - Kita: Shift, attendance, basic payroll = cukup UMKM
   - **HR sederhana + absensi = kebutuhan UMKM yang tidak diserved.**

5. **Payment Gateway Deeply Integrated**
   - Kledo/Paper.id: invoice + payment link
   - Kita: invoice + checkout + recurring + payment + storefront semua terhubung
   - **Money flow end-to-end, bukan fitur terpisah.**

### 5.6 Competitive Positioning

```
"Modular Business OS untuk UMKM Indonesia"
Tagline: "Mulai dari yang kamu butuh. Tambah seiring bertumbuh."

         PREMIUM
            ▲
   $50+/mo  │  Odoo Ent.
            │  Jurnal
            │
   $15-30   │  HashMicro        ┌─────────────────────┐
            │                    │   🎯 KAMU            │
            │  Kledo Pro         │   Modular + UMKM     │
            │                    │   Rp99k start        │
   $5-15    │  Paper.id          │   All-in-one capable │
            │                    └─────────────────────┘
            │
   FREE     │  Spreadsheets, WhatsApp
            └──────────────────────────────────────────────────────▶ FEATURE
            Basic      CRM    Finance   HR    Commerce   AI
```

**Segmen prioritas:**
1. UMKM 5-30 karyawan yang sudah pakai WhatsApp + Excel
2. Online shop yang butuh CRM + invoice + toko terintegrasi
3. Jasa/konsultan yang butuh invoicing + subscription billing

**Threats to monitor:**
- Mekari bisa integrasikan Qontak + Jurnal + Talenta = all-in-one
- Odoo bisa improve localization Indonesia
- HashMicro bisa turun harga ke UMKM segment
- Kledo bisa tambah CRM module
- New entrant: AI-native ERP startup

---

## 6. Pricing Strategy

### 6.1 Model: Hybrid Base + Add-ons

Dipilih setelah analisis kompetitor — ini model yang paling cocok:

- Match dengan "bongkar pasang" vision
- Match dengan codebase (modular plugin system sudah ada)
- Match dengan target market (UMKM Indonesia price-sensitive)
- Confirmed oleh data kompetitor pricing

### 6.2 Pricing Table

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  FREE TIER (hook / acquisition)                                       │
│  ────────────────────────────                                         │
│  • Core (Auth, Org, Team)                                            │
│  • CRM (max 50 contacts, 10 deals)                                   │
│  • Dashboard basic                                                   │
│  • Cost/org: ~Rp2k → absorb sebagai CAC                              │
│                                                                       │
│  BASE PLAN          Rp99k/bln      margin ~93%                       │
│  ─────────          ──────────                                       │
│  • Core (Auth, Org, Team, Settings)                                  │
│  • CRM (unlimited contacts, deals, activities)                       │
│  • Dashboard                                                         │
│  • Basic products                                                    │
│                                                                       │
│  ADD-ON MODULES:                                                      │
│  ──────────────                                                       │
│  + Finance          Rp99k/bln      margin ~93%                       │
│    Invoices, payments, sale orders, taxes, recurring                  │
│                                                                       │
│  + HR               Rp149k/bln     margin ~95%                       │
│    Employees, shifts, attendance, corrections, holidays, reports      │
│                                                                       │
│  + Commerce         Rp149k/bln     margin ~94%                       │
│    Public storefront, cart, checkout, shop orders, payment GW         │
│                                                                       │
│  + Billing          Rp99k/bln      margin ~93%                       │
│    Subscription templates, recurring billing, auto-invoice            │
│                                                                       │
│  + AI Chat          Rp49k/bln      margin ~85%                       │
│    AI assistant, tool execution, natural language CRM                 │
│                                                                       │
│  ALL-IN BUNDLE      Rp445k/bln     margin ~94%                       │
│  ─────────────      ──────────                                       │
│  Semua modules sekaligus (diskon vs beli terpisah Rp545k)            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 6.3 Pricing Validation vs Competitor

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Kledo mulai Rp99k   → Kita BASE juga Rp99k (match market)│
│  HashMicro opaque    → Kita TRANSPARENT (differentiator)   │
│  Odoo per-user       → Kita flat per-org (lebih fair UMKM)│
│  Paper.id free tier  → Kita free trial 14 hari            │
│  Jurnal enterprise   → Kita TIDAK saingan (dulu)          │
│                                                             │
│  Midtrans transaction fee: 2-3% per transaksi              │
│  → Ini cost user, bukan cost kita                          │
│  → Tapi perlu di-display ke user                           │
│                                                             │
│  AI Chat LLM cost:                                          │
│  • Light usage: ~Rp5-8k/org/bln                           │
│  • Heavy usage: ~Rp15-30k/org/bln                          │
│  • At Rp49k price, margin tetap 85%+                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Module Dependency Pricing Rules

```
Commerce diaktifkan → otomatis require Finance (Rp99k)
Billing diaktifkan → otomatis require Finance (Rp99k)
Finance standalone → OK (tidak require Commerce)
HR standalone → OK (fully independent)
CRM → always included (base)

Bundle recommendation engine di onboarding:
"Pilih Commerce? Kami recommend tambah Finance juga → bundle hemat Rp50k"
```

### 6.5 Contoh Customer Segments & Pricing

```
┌─────────────────────┬──────────────────────────┬────────────────┐
│ Profil               │ Modules                  │ Total/bln      │
├─────────────────────┼──────────────────────────┼────────────────┤
│ UMKM jajan tradision│ Base (CRM)              │ Rp99k          │
│ Toko online kecil   │ Base + Commerce + Finance│ Rp347k         │
│ Kantor 20 orang     │ Base + HR               │ Rp248k         │
│ Agency digital      │ Base + Finance + Commerce│ Rp347k         │
│ Jasa/konsultan      │ Base + Finance + Billing │ Rp297k         │
│ Semua               │ All-in                  │ Rp445k         │
└─────────────────────┴──────────────────────────┴────────────────┘
```

---

## 7. Open Source Strategy

### 7.1 Open Source Competitors

```
┌────────────┬──────────┬───────────────┬─────────┬──────────────┐
│ Project     │ License  │ Stack         │ Stars   │ Monetize     │
├────────────┼──────────┼───────────────┼─────────┼──────────────┤
│ Odoo       │ LGPL3    │ Python/PG     │ 42k+    │ Enterprise   │
│ ERPNext    │ MIT      │ Python/PG     │ 23k+    │ Hosting      │
│ Twenty CRM │ AGPLv3   │ TypeScript/PG │ 27k+    │ Cloud host   │
│ Crater     │ AGPLv3   │ PHP/Laravel   │ 7k+     │ Cloud host   │
│ Midday.ai  │ AGPLv3   │ TS/Supabase   │ 8k+     │ Cloud host   │
└────────────┴──────────┴───────────────┴─────────┴──────────────┘

PATTERN: semua pakai Python atau PHP + PostgreSQL

❌ TIDAK ADA open source CRM/ERP yang pakai Convex + Next.js + TypeScript
   Ini UNCHARTED TERRITORY. Blue ocean.
```

### 7.2 Keunggulan vs Existing Open Source

```
1. STACK UNIK
   TypeScript full-stack = developer pool TERBESAR di dunia
   Convex = realtime, zero-config backend
   Developer yang mau contrib = JavaScript/TS = jutaan orang

2. MODULAR ARCHITECTURE
   Odoo punya module system, tapi legacy Python, monolitik besar
   Kita: TS-native, plugin system sudah ada, modern stack

3. INDONESIA-FIRST = NICHE GLOBAL
   Odoo/ERPNext = Western-centric, localization Indonesia = afterthought
   Kita: Midtrans native, IDR, compliance ID, bahasa Indonesia
   Tapi juga bisa di-extend — community bisa buat localization module lain

4. AI NATIVE
   Tidak ada competitor (open atau closed) yang punya AI chat di CRM Indonesia
```

### 7.3 Timing: Kapan Open Source

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Phase 1  │────▶│ Phase 2  │────▶│ Phase 3  │────▶│ Phase 4  │
│          │     │          │     │          │     │          │
│ CLOSED   │     │ LAUNCH   │     │ OPEN     │     │ MARKET-  │
│ BETA     │     │ SAAS     │     │ SOURCE   │     │ PLACE    │
│          │     │          │     │          │     │          │
│ Polish   │     │ Get      │     │ GitHub   │     │ Community│
│ modular  │     │ 100-300  │     │ public   │     │ modules  │
│ system   │     │ customer │     │ attract  │     │ 30% cut  │
│ pricing  │     │ validate │     │ dev      │     │ platform │
│ docs     │     │ pricing  │     │ contrib  │     │ flywheel │
│          │     │          │     │          │     │          │
│ SEKARANG │     │ 3-6 bln  │     │ 6-12 bln │     │ 12-18 bln│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

**Kenapa tidak langsung open source:**
- Produk belum mature — modular system belum selesai
- Code perlu polish (hard-coded values, i18n, docs)
- Belum ada user — tidak ada "social proof"
- Open source tanpa user = ghost town di GitHub

**Kenapa Phase 3 (setelah 100-300 paying customers):**
- Produk proven — orang lihat ini works
- Ada revenue — tidak tergantung community untuk survival
- Ada user base — potential contributor pool
- Modular system sudah jadi — community bisa extend

### 7.4 License Recommendation

**Sekarang**: MIT (sudah ada) — terlalu permissive untuk open source launch

**Target**: AGPLv3 atau BSL

```
AGPLv3 (recommended — sama dengan Twenty CRM, Midday.ai):
✅ Siapapun bisa self-host gratis
✅ Siapapun yang modify WAJIB open source juga
✅ Competitor tidak bisa fork lalu close-source
✅ Commercial use allowed tapi harus preserve license
✅ Compatibel dengan Convex FSL

BSL (alternative):
✅ Code visible, tapi production use > RpX jt = harus beli license
✅ Auto-convert ke MIT setelah 3 tahun
⚠️ Lebih complex messaging
```

### 7.5 Self-Host Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SELF-HOST USER:                                            │
│                                                             │
│  docker compose up                                          │
│                                                             │
│  services:                                                  │
│    convex:                                                  │
│      image: ghcr.io/get-convex/convex-backend:latest        │
│      volumes:                                               │
│        - convex_data:/data                                  │
│                                                             │
│    web:                                                     │
│      image: ghcr.io/udecode/crm-web:latest                  │
│      environment:                                           │
│        - NEXT_PUBLIC_CONVEX_URL=http://convex:8000          │
│                                                             │
│  User punya 100% kontrol.                                   │
│  Data di server mereka.                                     │
│  Tidak ada vendor lock-in.                                  │
│                                                             │
│  Monetisasi tetap jalan:                                    │
│  • Premium modules = license key                            │
│  • Cloud version = convenience play                         │
│  • Marketplace = community revenue                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.6 Monetisasi Model (Open Source)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. MANAGED CLOUD (primary revenue)                         │
│     Rp99-445k/bln, kita manage Convex + Vercel             │
│     User cuma signup → langsung pakai                       │
│                                                             │
│  2. PREMIUM MODULES                                         │
│     Community edition: Core + CRM + basic invoicing         │
│     Paid add-on: HR, Commerce, Billing, AI Chat             │
│     License key via plugin system yang sudah ada             │
│                                                             │
│  3. MARKETPLACE (Phase 4)                                   │
│     Community-built modules, kita take 30%                  │
│     Contoh:                                                 │
│     • Dev A buat "Kasir Resto" → jual Rp50k                │
│     • Dev B buat "Payroll Indonesia" → jual Rp100k         │
│     • Dev C buat "WhatsApp Integration" → jual Rp75k       │
│                                                             │
│  4. ENTERPRISE                                              │
│     Custom deployment, SLA, priority support                │
│     Annual contract Rp5-20jt/thn                            │
│                                                             │
│  5. SETUP / CONSULTING                                      │
│     Untuk self-host user yang butuh bantuan                 │
│     Rp1-5jt per setup                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Conversion funnel:

Self-deploy (free)          Cloud (Rp99k+)
┌───────────────┐           ┌───────────────┐
│ Dev/founder   │           │ UMKM owner    │
│ Tech-savvy    │─── 2-5% ─▶│ Non-tech      │
│ Setup sendiri │  convert  │ Signup langsung│
│ Community     │           │ Premium support│
│ evangelist    │           │ Paying customer│
└───────────────┘           └───────────────┘
       │
       ▼
Word of mouth, blog posts, tutorials,
GitHub stars = FREE MARKETING

Self-deploy user = marketing channel, bukan lost revenue.
```

---

## 8. Ansoff Matrix — Growth Strategy

### 8.1 Matrix Overview

```
              ┌──────────────────────┬──────────────────────┐
              │   CURRENT MARKET     │    NEW MARKET         │
              │   (UMKM Indonesia)   │                      │
  ────────────┼──────────────────────┼──────────────────────┤
  CURRENT     │  ① MARKET           │  ② MARKET            │
  PRODUCT     │  PENETRATION         │  DEVELOPMENT         │
  (CRM/ERP    │                      │                      │
  Modular)    │  Risk: LOW           │  Risk: MEDIUM        │
              │  Timeline: 6-12 bln  │  Timeline: 12-24 bln │
  ────────────┼──────────────────────┼──────────────────────┤
  NEW         │  ③ PRODUCT          │  ④ DIVERSIFICATION   │
  PRODUCT     │  DEVELOPMENT         │                      │
              │  Risk: MEDIUM        │  Risk: HIGH          │
              │  Timeline: 12-18 bln │  Timeline: 24+ bln   │
              └──────────────────────┴──────────────────────┘
```

### 8.2 Quadrant ① — Market Penetration (Current Product → Current Market)

**Goal**: Dominasi UMKM Indonesia dengan produk yang sudah ada  
**Risk**: ●●○○○ LOW  
**Timeline**: 6-12 bulan

**Strategi 1A: Free Tier sebagai Growth Engine**

| Aspect | Detail |
|--------|--------|
| Apa | Core + CRM gratis, max 50 contacts, 10 deals |
| Hook | "Tracking pelanggan gratis, lebih baik dari Excel" |
| Conversion | free → base (Rp99k) → add modules |
| Target | 1,000 free user dalam 6 bulan |
| Metric | free → paid conversion rate (target 5%) |

**Strategi 1B: Referral Program**

| Aspect | Detail |
|--------|--------|
| Apa | "Ajak teman, dapat 1 bulan gratis premium" |
| Channel | WhatsApp group / komunitas UMKM = channel alami |
| Metric | viral coefficient (target >0.3) |

**Strategi 1C: Content Marketing UMKM Indonesia**

| Aspect | Detail |
|--------|--------|
| Apa | YouTube tutorial, blog tips UMKM, partnership akuntan |
| SEO target | "software CRM UMKM", "software HR murah", "invoice otomatis" |
| Metric | organic signup rate (target 50/bln dalam 6 bulan) |

**Strategi 1D: Open Source Launch**

| Aspect | Detail |
|--------|--------|
| Apa | GitHub public + ProductHunt launch |
| Messaging | "Open source alternative to Odoo for Indonesia" |
| Metric | GitHub stars (target 1k dalam 6 bulan) |

**Market size**: 66 juta UMKM → SAM 3-5 juta → Target Y1: 500-1,000 org  
**Revenue target Y1**: Rp50-100jt/bln (100 paying × Rp500k avg)  
**Investment**: Low — mainly time + content + community

### 8.3 Quadrant ② — Market Development (Current Product → New Market)

**Goal**: Jual produk yang sama ke market baru  
**Risk**: ●●●○○ MEDIUM  
**Timeline**: 12-24 bulan (setelah penetrate Indonesia)

**Strategi 2A: Ekspansi Geografis — Asia Tenggara**

| Negara | UMKM | Payment GW | Effort |
|--------|------|-----------|--------|
| Filipina | ~1 juta | PayMongo | Medium |
| Thailand | ~3 juta | Omise/2C2P | Medium |
| Vietnam | ~800rb | VNPay/MoMo | High |
| Malaysia | ~1.2 juta | Billplz/FPX | Medium |

Yang diperlukan:
- Localization (bahasa + currency + payment gateway)
- Payment adapter pattern sudah ada (`interface.ts`) → tinggal tambah provider
- Community bisa bantu translate (open source advantage)

**Strategi 2B: Vertical Baru — Niche Industry**

| Vertical | Module perlu | Market size ID |
|----------|-------------|---------------|
| Klinik/farmasi | + POS module | ~50k klinik |
| Resto/F&B | + POS + menu | ~500k resto |
| Jasa/konsultan | + booking | ~100k firm |
| Konstruksi | + project mgmt | ~30k kontraktor |
| Sekolah | + student mgmt | ~100k sekolah |

Keunggulan: modular system = tinggal tambah vertical module  
Community bisa buat vertical module → marketplace

**Strategi 2C: Segment Enterprise (mid-market)**

| Aspect | Detail |
|--------|--------|
| Target | 50-200 karyawan (dari 5-50) |
| Offering | Custom module, SLA, dedicated support, on-premise |
| Pricing | Rp1-5jt/bln |
| Metric | 10 enterprise client dalam 18 bulan |

### 8.4 Quadrant ③ — Product Development (New Product → Current Market)

**Goal**: Module/fitur baru untuk user Indonesia yang sudah ada  
**Risk**: ●●●○○ MEDIUM  
**Timeline**: 12-18 bulan

**Module Pipeline (prioritas):**

| Priority | Module | Effort | Revenue | Why |
|----------|--------|--------|---------|-----|
| P0 | Mobile App (Expo) | 2-3 bln | Retention ↑ | UMKM mobile-first, `apps/mobile/` sudah ada placeholder |
| P1 | WhatsApp Integration | 2-3 bln | Rp99k/org/bln | WA = #1 tool bisnis Indonesia |
| P2 | POS / Kasir Module | 1-2 bln | Rp149k/org/bln | 2M toko fisik, Moka charge Rp300-500k |
| P3 | Payroll Module | 2-3 bln | Rp149k/org/bln | HR user upsell, BPJS + PPh 21 |
| P4 | Accounting / Buku Besar | 3-4 bln | Rp149k/org/bln | Compete Jurnal/Kledo |

**Detail per module:**

**P0 — Mobile App**
- `apps/mobile/` sudah ada (placeholder Expo)
- UMKM owner = mobile-first, bukan desktop
- Attendance clock-in dari HP
- Dashboard + deal pipeline di HP
- Notifikasi invoice / payment
- Pricing: Included in all plans (differentiator)

**P1 — WhatsApp Integration**
- WA Business API + Cloud Messaging
- Chat customer → otomatis masuk CRM
- Kirim invoice via WA
- Payment reminder via WA
- Pricing: Rp99k/bln add-on

**P2 — POS Module**
- Kasir digital untuk toko fisik
- Reuse products, taxes, payment data
- Receipt printer support
- Pricing: Rp149k/bln (Moka charge Rp300-500k)

**P3 — Payroll**
- BPJS, PPh 21, THR calculation
- Slip gaji otomatis
- Natural upsell dari HR module
- Pricing: Rp149k/bln

**P4 — Accounting**
- Neraca, laba rugi, arus kas
- Tax reporting (e-Faktur, PPh)
- Compete langsung dengan Jurnal/Kledo
- Pricing: Rp149k/bln

### 8.5 Quadrant ④ — Diversification (New Product → New Market)

**Goal**: Produk baru, pasar baru = bet besar  
**Risk**: ●●●●● HIGH  
**Timeline**: 24+ bulan

**Strategi 4A: Platform Marketplace**

```
Bukan jual CRM lagi. Jual PLATFORM.

Kita jadi "WordPress for business"

Core = free (CRM + basic features)
Marketplace = community jual module
Kita take 30% dari setiap module sale

Market: GLOBAL developer + business
Revenue model: 30% marketplace cut + cloud hosting + verified listing fee

Analog: WordPress.org ecosystem ($70B+ market)
Risk: Butuh critical mass — tidak ada value tanpa community
```

**Strategi 4B: Embedded Finance (Fintech)**

```
Dari software ke financial services:

• Lending: Pinjaman UMKM berdasarkan data invoice/revenue
• Payment gateway as service (white-label)
• Virtual account / e-wallet untuk setiap org
• Cashback / rewards untuk payment via platform

Kenapa:
• Data transaksi = underwriting data
• User sudah di platform = distribution ready
• Market: pinjaman UMKM = Rp500T+/thn
• Revenue: interest spread, transaction fees

Risk: Regulatory (OJK), capital intensive
Timing: Hanya kalau sudah 1000+ org dengan transaction data
```

**Strategi 4C: Convex-based BaaS (Backend as a Service)**

```
Ekstrak module system jadi standalone product:

"Build your own business app on our platform"
SDK / framework untuk buat module di atas Convex
Target: Developer yang mau buat vertical SaaS
Mereka fokus business logic, kita handle infra

Analog: Shopify untuk custom apps
Market: Global developer
```

---

## 9. Module Pipeline

### 9.1 Module yang Sudah Ada (codebase)

| Module | Status | Backend | Frontend | Ready? |
|--------|--------|---------|----------|--------|
| CORE | ✅ Complete | Auth, Org, Permissions | Settings, Team | ✅ |
| CRM | ✅ Complete | Contacts, Companies, Deals, Activities | Full CRUD pages | ✅ |
| FINANCE | ✅ Complete | Invoices, Payments, Sale Orders, Taxes | Full CRUD pages | ✅ |
| HR | ✅ Complete | Employees, Shifts, Attendance, Reports | Full CRUD pages | ✅ |
| COMMERCE | ✅ Complete | Storefront, Cart, Checkout, Midtrans | Public shop + dashboard | ✅ |
| BILLING | ✅ Complete | Subscription templates, recurring | Management pages | ✅ |
| AI CHAT | ✅ Complete | Conversations, Messages, Tools | Chat UI | ✅ |

### 9.2 Module yang Perlu Dibuat (new)

| Priority | Module | Effort | Description |
|----------|--------|--------|-------------|
| P0 | Mobile App | 2-3 bln | Expo app — clock-in, dashboard, notifications |
| P1 | WhatsApp | 2-3 bln | WA Business API — chat → CRM, invoice via WA |
| P2 | POS | 1-2 bln | Kasir digital — receipt printer, offline mode |
| P3 | Payroll | 2-3 bln | BPJS, PPh 21, slip gaji, THR |
| P4 | Accounting | 3-4 bln | Neraca, laba rugi, arus kas, e-Faktur |
| P5 | Booking | 1-2 bln | Appointment scheduling |
| P6 | Inventory | 2-3 bln | Multi-gudang, stock opname, adjustments |
| P7 | Project Mgmt | 2-3 bln | Task board, time tracking, billing |

### 9.3 Module Development Effort Estimate

```
Module complexity spectrum:

Simple (1-2 bln):
├── POS          (reuse products + payments, add receipt UI)
└── Booking      (new tables, scheduling UI)

Medium (2-3 bln):
├── Mobile App   (Expo, Convex client, responsive UI)
├── WhatsApp     (API integration, webhook, message templates)
├── Payroll      (Indonesia tax calc, BPJS integration)
└── Inventory    (multi-warehouse, stock tracking)

Complex (3-4 bln):
└── Accounting   (double-entry, compliance, tax reporting)
```

---

## 10. Revenue Projection

### 10.1 Revenue by Phase

```
Rp jt/bln
  500 │                                              ╱ ④
      │                                           ╱
  300 │                                    ╱ ②③
      │                                ╱
  100 │                          ╱ ①
      │                    ╱
   50 │              ╱
      │        ╱
    0 ├────┬────┬────┬────┬────┬────┬────
      Y0   Q1   Q2   Q3   Q4   Y1.5  Y2   Y3

① = penetration (Rp50-100jt/bln at 100-200 paying org)
② = market expansion (Rp100-300jt/bln at 500+ org)
③ = product development (upsell modules, Rp200-300jt)
④ = diversification (marketplace, embedded finance, Rp300jt+)
```

### 10.2 Scenario Analysis

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  CONSERVATIVE (1 tahun)                                          │
│  ────────────────────────                                        │
│  500 org total, 100 paying (20% conversion)                     │
│  Avg Rp200k/org/bln                                             │
│  Revenue: Rp20jt/bln = Rp240jt/thn                             │
│  Cost: Rp3jt/bln = Rp36jt/thn                                   │
│  Profit: Rp204jt/thn                                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MODERATE (1 tahun)                                              │
│  ──────────────────────                                          │
│  2000 org total, 400 paying (20% conversion)                    │
│  Avg Rp250k/org/bln                                             │
│  Revenue: Rp100jt/bln = Rp1.2M/thn                             │
│  Cost: Rp5jt/bln = Rp60jt/thn                                   │
│  Profit: Rp1.14M/thn                                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OPTIMISTIC (2 tahun, post open source)                          │
│  ─────────────────────────────────────────                       │
│  10,000 org total, 1500 paying (15% conversion)                 │
│  Avg Rp300k/org/bln (more modules)                              │
│  Revenue: Rp450jt/bln = Rp5.4M/thn                             │
│  Cost: Rp10jt/bln = Rp120jt/thn                                 │
│  Profit: Rp5.28M/thn                                            │
│  + Marketplace 30% cut: +Rp50-100jt/thn                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. Risks & Mitigasi

### 11.1 Risk Matrix

```
┌─────────────────────────────┬──────────┬──────────┬───────────────────────────────┐
│ Risk                         │ Severity │ Likely   │ Mitigasi                       │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Competitor fork codebase     │ Medium   │ Low      │ AGPLv3 license, brand moat,   │
│ (MIT terlalu permissive)     │          │          │ Convex expertise barrier       │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Convex cloud outage/downtime │ High     │ Very Low │ Self-host option sebagai       │
│                              │          │          │ fallback, Convex track record  │
│                              │          │          │ sangat bagus                  │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Convex change pricing        │ Medium   │ Medium   │ Self-host option,              │
│                              │          │          │ margin 90%+ buffer             │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Mekari integrate all products│ High     │ Low      │ Speed to market — launch       │
│ (Qontak+Jurnal+Talenta)      │          │          │ sebelum mereka integrate       │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Odoo improve Indonesia local │ High     │ Medium   │ Community-driven localization  │
│                              │          │          │ sebagai moat, modular advantage│
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Scope creep (too many modules│ High     │ High     │ P0-P4 priority system,         │
│ too fast)                    │          │          │ max 1 module per quarter       │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Open source support burden   │ Medium   │ Medium   │ Community support channel,     │
│                              │          │          │ paid support tier              │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ convex-ents community lib    │ Medium   │ Low      │ Surface area kecil (schema +   │
│ abandoned                    │          │          │ table factory), migration 1-2  │
│                              │          │          │ hari kalau perlu               │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Data compliance (Indonesia)  │ High     │ Low      │ Self-host option (data di      │
│                              │          │          │ server user), GDPR-like rules  │
├─────────────────────────────┼──────────┼──────────┼───────────────────────────────┤
│ Midtrans fee increase        │ Low      │ Low      │ Provider-agnostic architecture │
│                              │          │          │ (bisa swap ke Xendit, dll)     │
└─────────────────────────────┴──────────┴──────────┴───────────────────────────────┘
```

### 11.2 Convex-Specific Risks

```
1. VENDOR LOCK-IN (severity: medium, mitigated)
   • Convex FSL license → bisa self-host
   • Schema standard (v.string(), v.number() dll) → migratable
   • convex-ents surface area kecil → bisa replace
   • Mitigasi utama: self-host option sudah available

2. SCHEMA MONOLITH (severity: low, accepted)
   • Convex tidak support dynamic schema per tenant
   • Semua 57 tabel ada di 1 schema
   • Mitigasi: guard di application layer, bukan schema layer
   • Impact: tabel tidak terpakai tidak cost apa-apa (Convex tidak charge per table)

3. REALTIME COST (severity: low, monitored)
   • Banyak subscription bisa naikin bandwidth
   • Mitigasi: careful query design, pagination, lazy loading
```

---

## 12. Phased Roadmap

### Phase 0: Foundation (Sekarang → 3 bulan)

```
Goal: Siapkan arsitektur modular

Tasks:
├── Implement org.modules config di schema
├── Implement module guard pattern di backend (requireModule)
├── Update navigation.ts untuk conditional sidebar
├── Route guard di frontend (redirect ke /upgrade)
├── Onboarding flow redesign (pilih modul saat signup)
├── Docker Compose setup untuk self-host
├── Documentation (README, CONTRIBUTING, self-host guide)
├── License update: MIT → AGPLv3 (atau BSL)
└── Premium module licensing system (license key validation)

Milestone: Modular system works, self-host Docker bisa jalan
```

### Phase 1: Market Penetration (3-9 bulan)

```
Goal: Launch & acquire first 500-1000 org

Tasks:
├── Launch SaaS cloud (managed Convex + Vercel)
├── Free tier live (Core + CRM, limited)
├── Pricing page + payment integration (Rp99k-445k)
├── Content marketing launch (YouTube, blog, SEO)
├── ProductHunt launch
├── Indonesia UMKM community building
├── Referral program
└── First 100 paying customers

Revenue target: Rp10-20jt/bln
Milestone: Product-market fit validated
```

### Phase 2: Product Development (6-18 bulan)

```
Goal: Tambah module, naikin ARPU

Tasks (parallel dengan Phase 1):
├── P0: Mobile App (Expo) — 2-3 bulan
├── P1: WhatsApp Integration — 2-3 bulan
├── P2: POS Module — 1-2 bulan
├── P3: Payroll Module — 2-3 bulan
├── P4: Accounting Module — 3-4 bulan
└── Upsell existing user ke module baru

Revenue target: Rp50-100jt/bln
ARPU target: Rp200-300k/org/bln (dari Rp99k)
Milestone: 500+ paying customers
```

### Phase 3: Open Source Launch (12-18 bulan)

```
Goal: GitHub public, attract community

Tasks:
├── GitHub repo public (AGPLv3)
├── Documentation site (docs.crm.dev)
├── Contributing guide + module SDK
├── Community Discord / forum
├── First community-contributed module
├── Self-host Docker guide published
└── GitHub stars target: 1,000+

Revenue impact: Cloud conversion dari self-host user
Milestone: First community PR merged
```

### Phase 4: Market Development (18-24 bulan)

```
Goal: Expand ke market baru

Tasks:
├── Localization: Filipina (Tagalog + PayMongo)
├── Localization: Thailand (Thai + Omise)
├── Vertical module: Klinik/farmasi
├── Vertical module: Resto/F&B
├── Enterprise segment: custom deployment
└── Partnership dengan konsultan / akuntan

Revenue target: Rp200-300jt/bln
Milestone: 100+ org di negara selain Indonesia
```

### Phase 5: Diversification (24+ bulan)

```
Goal: Platform play

Tasks:
├── Module marketplace launch
├── Community module revenue (30% cut)
├── Embedded finance exploration (pinjaman UMKM)
├── BaaS platform exploration
└── Global developer community

Revenue target: Rp300jt+/bln
Milestone: First marketplace sale
```

### 12.1 Roadmap Visual

```
Bulan:  0    3    6    9    12   15   18   21   24   30   36
        ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
Phase 0:█████
         Found.

Phase 1:     █████████████████
             Market Penetration

Phase 2:          █████████████████████████████
                   Product Dev (modules)

Phase 3:                    ████████████████████
                             Open Source

Phase 4:                              ████████████████████
                                       Market Development

Phase 5:                                        ████████████████
                                                 Diversification
```

---

## Appendix A: Key Metrics to Track

```
ACQUISITION
├── Free signups / month
├── GitHub stars
├── Organic traffic (SEO)
├── Referral rate
└── Self-host downloads

ACTIVATION
├── Onboarding completion rate
├── Module selection rate per module
├── Time to first value (first deal? first invoice?)
└── Free → paid conversion rate (target 5%)

REVENUE
├── MRR (Monthly Recurring Revenue)
├── ARPU (Average Revenue Per User)
├── Module attach rate (which modules sell best)
├── Churn rate (target <5%/month)
└── LTV (Lifetime Value)

ENGAGEMENT
├── DAU/MAU ratio
├── Features used per org
├── Module usage heatmap
└── AI Chat queries per org

RETENTION
├── Monthly retention cohort
├── Module deactivation rate
├── Support ticket volume
└── NPS score
```

## Appendix B: Quick Reference — Convex Self-Host

```
# Self-host Convex backend
docker pull ghcr.io/get-convex/convex-backend:latest
docker run -p 8000:8000 -v convex_data:/data ghcr.io/get-convex/convex-backend

# Deploy CRM to self-hosted Convex
npx convex deploy --url http://localhost:8000

# Deploy Next.js frontend
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_CONVEX_URL=http://your-server:8000 \
  ghcr.io/udecode/crm-web:latest

# Full stack with docker-compose
docker compose up  # Convex + Next.js + all dependencies
```

## Appendix C: Comparison dengan Midday.ai

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│                 │  Midday.ai           │  Kita                │
├─────────────────┼──────────────────────┼──────────────────────┤
│ Stack           │ Next.js + Supabase   │ Next.js + Convex     │
│ Backend license │ Supabase (MIT)       │ Convex (FSL→Apache)  │
│ Self-host       │ Docker + PG          │ Docker + Convex      │
│ Modules         │ ❌ Fixed features    │ ✅ Modular plugin    │
│ Commerce        │ ❌ Tidak ada         │ ✅ Full storefront   │
│ HR              │ ❌ Tidak ada         │ ✅ Full HR           │
│ AI              │ Basic                │ ✅ AI Chat + Tools   │
│ CRM Pipeline    │ ❌ Tidak ada         │ ✅ Full CRM          │
│ Marketplace     │ ❌ Tidak ada         │ ✅ Planned           │
│ Target          │ Freelancer (global)  │ UMKM → Global       │
│ Billing         │ ❌ Tidak ada         │ ✅ Recurring billing │
│ Indonesia       │ ❌ No                │ ✅ Native            │
│ GitHub stars    │ ~8k                  │ N/A (belum launch)   │
│ License         │ AGPLv3               │ MIT → AGPLv3 (plan)  │
└─────────────────┴──────────────────────┴──────────────────────┘

Kesimpulan: Kita secara fitur LEBIH KAYA dari Midday.
Kalau Midday bisa 8k stars + funding dengan "hanya" invoicing + expense,
kita dengan CRM + HR + Commerce + AI + modular punya posisi jauh lebih kuat.
```

---

*Dokumen ini dihasilkan dalam explore mode — belum ada code yang diimplementasi.*  
*Untuk mulai implementasi, exit explore mode dan buat OpenSpec change proposal.*
