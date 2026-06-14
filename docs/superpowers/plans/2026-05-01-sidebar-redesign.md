# Sidebar Redesign Plan — ERP Navigation

## Problem Statement

Dari screenshot aktual, sidebar saat ini memiliki masalah skanabilitas serius:

1. **Flat list 16+ items** — semua di satu level tanpa grouping
2. **ALL CAPS noise** — `DASHBOARD`, `COMPANIES`, `SUBSCRIPTIONS` — visual hierarchy nol
3. **HR cuma 1 link** — padahal ada 10 sub-pages (dashboard, branches, employees, shifts, attendance, corrections, holidays, reports)
4. **Plugin prefix panjang** — `TOKO ONLINE: PRODUK`, `TOKO ONLINE: PESANAN` — wasted space
5. **No collapsible groups** — semua item selalu visible, sidebar panjang
6. **Mix bahasa** — navigasi English, tapi plugin prefix + labels Indonesian

## Design Principles

1. **Group by domain** — CRM, Finance, HR, Commerce, System
2. **Progressive disclosure** — collapse groups yang jarang dipakai
3. **Sub-navigation** — module dengan >3 pages expandable
4. **Mixed case** — `Dashboard` bukan `DASHBOARD`
5. **Favorites** — pin frequently used items
6. **Consistent language** — English untuk nav labels (UI convention)

## New Sidebar Structure

```
┌─ [Logo] ARGA WORK'S ORGANIZATION ─┐
├─ [Search... ⌘K]                   │
├─ Favorites (pin/unpin)            │
│   📊 Dashboard ★                  │
│   👥 Employees ★                  │
├─ CRM                              │
│   ▾ Companies                     │
│   ▾ Contacts                      │
│   ▾ Deals                         │
│   ▾ Activities                    │
│   ▾ Products                      │
├─ Finance                          │
│   ▾ Sales                         │
│   ▾ Invoices                      │
│   ▾ Payments                      │
│   ▾ Subscriptions                 │
│   ▾ Templates                     │
├─ HR ▾                             │
│   📊 Dashboard                    │
│   🏢 Branches                     │
│   👥 Employees                    │
│   ⏰ Shifts                       │
│   📝 Assignments                  │
│   ✅ Attendance                   │
│   🔧 Corrections                  │
│   🗓️ Holidays                     │
│   📈 Reports                      │
├─ Commerce ▾                       │
│   🛍️ Products                     │
│   📦 Orders                       │
│   💳 Payments                     │
│   ⚙️ Settings                     │
├─ System                           │
│   ⚙️ Settings                     │
├───────────────────────────────────┤
│ [Avatar] Arga Work    🌙    🚪   │
└───────────────────────────────────┘
```

## Detailed Changes

### 1. Navigation Groups (Collapsible)

| Group | Items | Default State |
|-------|-------|---------------|
| **Favorites** | User-pinned items | Expanded if any |
| **CRM** | Dashboard, Companies, Contacts, Deals, Activities, Products | Expanded |
| **Finance** | Sales, Invoices, Payments, Subscriptions, Templates | Collapsed |
| **HR** | Dashboard + 8 sub-pages | Collapsed (kecuali di /hr/*) |
| **Commerce** | Products, Orders, Payments, Settings | Collapsed |
| **System** | Settings | Expanded |

### 2. HR Sub-Navigation

HR menjadi **expandable group** dengan active state logic:

```tsx
const hrSubItems = [
  { title: 'Dashboard', href: '/hr', icon: LayoutDashboard },
  { title: 'Branches', href: '/hr/branches', icon: Building2 },
  { title: 'Employees', href: '/hr/employees', icon: Users },
  { title: 'Shifts', href: '/hr/shifts', icon: Clock },
  { title: 'Assignments', href: '/hr/assignments', icon: CalendarCheck },
  { title: 'Attendance', href: '/hr/attendance', icon: ClipboardCheck },
  { title: 'Corrections', href: '/hr/corrections', icon: FileEdit },
  { title: 'Holidays', href: '/hr/holidays', icon: CalendarDays },
  { title: 'Reports', href: '/hr/reports', icon: BarChart3 },
];
```

Behavior:
- Auto-expand when `pathname.startsWith('/hr')`
- Collapse via chevron click
- Active state: exact match untuk `/hr`, prefix match untuk sub-pages

### 3. Plugin Items — Remove Prefix

Dari:
```
TOKO ONLINE: PRODUK
TOKO ONLINE: PESANAN
TOKO ONLINE: PEMBAYARAN
TOKO ONLINE: PENGATURAN TOKO
```

Menjadi group "Commerce" atau "Shop":
```
Commerce ▾
  Products
  Orders
  Payments
  Settings
```

### 4. Typography & Casing

| Element | Current | New |
|---------|---------|-----|
| Group label | `NAVIGATION` (uppercase, tracking) | `Navigation` (sentence case) |
| Item label | `DASHBOARD` (uppercase) | `Dashboard` (title case) |
| Active item | bg-accent | bg-accent + left border indicator |
| Icon size | 16px | 18px (slightly larger for scan) |

### 5. Favorites System

New feature: user can pin/unpin any nav item:
- Star icon appears on hover
- Pinned items show in "Favorites" group at top
- Persisted to localStorage (or user preference in DB)
- Default favorites: Dashboard

### 6. Search Integration

Enhance existing Command Palette:
- Add search input in sidebar header (or just shortcut hint)
- `⌘K` to open Command Palette
- Command Palette includes all nav routes

### 7. Compact Mode (Future)

Collapsible sidebar to icon-only:
- Hover to expand tooltip
- Saves ~200px horizontal space
- Good for data-heavy pages

## Component Changes

### File: `apps/web/src/app/(dashboard)/layout.tsx`

Current structure:
```tsx
const navItems = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  // ... 12 more flat items
];
```

New structure:
```tsx
interface NavGroup {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { title: 'Dashboard', href: '/', icon: LayoutDashboard },
      { title: 'Companies', href: '/companies', icon: Building2 },
      { title: 'Contacts', href: '/contacts', icon: Users },
      { title: 'Deals', href: '/deals', icon: Handshake },
      { title: 'Activities', href: '/activities', icon: Activity },
      { title: 'Products', href: '/products', icon: Package },
    ],
    defaultOpen: true,
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { title: 'Sales', href: '/sales', icon: ShoppingCart },
      { title: 'Invoices', href: '/invoices', icon: FileText },
      { title: 'Payments', href: '/payments', icon: Landmark },
      { title: 'Subscriptions', href: '/subscriptions', icon: RefreshCw },
      { title: 'Templates', href: '/templates', icon: LayoutTemplate },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    icon: UsersRound,
    href: '/hr',
    items: [
      { title: 'Dashboard', href: '/hr', icon: LayoutDashboard },
      { title: 'Branches', href: '/hr/branches', icon: Building2 },
      { title: 'Employees', href: '/hr/employees', icon: Users },
      { title: 'Shifts', href: '/hr/shifts', icon: Clock },
      { title: 'Assignments', href: '/hr/assignments', icon: CalendarCheck },
      { title: 'Attendance', href: '/hr/attendance', icon: ClipboardCheck },
      { title: 'Corrections', href: '/hr/corrections', icon: FileEdit },
      { title: 'Holidays', href: '/hr/holidays', icon: CalendarDays },
      { title: 'Reports', href: '/hr/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    items: [
      { title: 'Products', href: '/products/manage', icon: Package },
      { title: 'Orders', href: '/shop-orders', icon: ShoppingBag },
      { title: 'Payments', href: '/payments/shop', icon: CreditCard },
      { title: 'Settings', href: '/settings/shop', icon: Store },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
    defaultOpen: true,
  },
];
```

### New Components Needed

1. **`SidebarNavGroup`** — collapsible accordion untuk tiap group
2. **`SidebarNavItem`** — individual link dengan active state + hover star
3. **`FavoritesGroup`** — pinned items (localStorage persisted)
4. **`SidebarSearch`** — ⌘K hint atau mini search

### shadcn/ui Components to Use

- `Collapsible` — untuk expand/collapse groups
- `Tooltip` — untuk icon-only hover state (future)
- `Badge` — untuk unread counts (future enhancement)
- `ScrollArea` — untuk sidebar scroll

## Permission Integration

Each group/item tetap filter by permission:
- If group has 0 visible items → hide entire group
- HR group: check `hr_employees:view` untuk show group itself
- Sub-items: each checks individual permission

```tsx
// Helper: determine if group should be visible
function isGroupVisible(group: NavGroup, perms: Permissions): boolean {
  return group.items.some(item => {
    const feature = featureMap[item.href];
    return !feature || perms[`${feature}:view`];
  });
}
```

## Responsive Behavior

| Breakpoint | Behavior |
|-----------|----------|
| Desktop (>1024px) | Full sidebar, groups collapsible |
| Tablet (768-1024px) | Icon-only sidebar, hover expand |
| Mobile (<768px) | Sheet/drawer overlay |

## Implementation Tasks

| # | Task | Files | Est |
|---|------|-------|-----|
| 1 | Create `SidebarNavGroup` component | `components/sidebar/nav-group.tsx` | 2h |
| 2 | Create `SidebarNavItem` component | `components/sidebar/nav-item.tsx` | 1h |
| 3 | Redefine nav structure with groups | `app/(dashboard)/layout.tsx` | 1h |
| 4 | Add HR sub-navigation | `app/(dashboard)/layout.tsx` | 1h |
| 5 | Remove UPPERCASE styling | `app/(dashboard)/layout.tsx`, CSS | 30m |
| 6 | Plugin items: remove prefix, group under Commerce | `app/(dashboard)/layout.tsx` | 30m |
| 7 | Add Favorites (localStorage) | `components/sidebar/favorites.tsx` | 2h |
| 8 | Active state: left border indicator | `components/sidebar/nav-item.tsx` | 30m |
| 9 | Test all routes & permissions | Browser testing | 1h |
| 10 | Polish: transitions, hover states | CSS | 1h |

**Total: ~10 hours**

## Visual Reference

### Current (Problems)
```
NAVIGATION
DASHBOARD
COMPANIES
CONTACTS
DEALS
PRODUCTS
SALES
INVOICES
PAYMENTS
SUBSCRIPTIONS
TEMPLATES
ACTIVITIES
HR
SETTINGS
TOKO ONLINE: PRODUK
TOKO ONLINE: PESANAN
TOKO ONLINE: PEMBAYARAN
TOKO ONLINE: PENGATURAN TOKO
```

### New (Clean)
```
Navigation
CRM ▾
  Dashboard
  Companies
  Contacts
  Deals
  Activities
  Products
Finance ▾
  Sales
  Invoices
  Payments
  Subscriptions
  Templates
HR ▾
  Dashboard
  Branches
  Employees
  Shifts
  Assignments
  Attendance
  Corrections
  Holidays
  Reports
Commerce ▾
  Products
  Orders
  Payments
  Settings
System
  Settings
```

## Success Criteria

- [ ] User can scan full sidebar in <2 seconds
- [ ] HR sub-pages accessible without scrolling
- [ ] No ALL CAPS labels
- [ ] Collapsed groups persist across sessions
- [ ] Active page clearly indicated
- [ ] Mobile: sidebar doesn't break layout
- [ ] Permission-filtered items still work correctly
