# Sidebar Redesign — Implementation Plan

## Overview

Transform flat 16+ item sidebar into grouped, collapsible navigation with HR sub-menu. Uses existing shadcn/ui `SidebarMenuSub*` components (already available in the codebase).

## Architecture

```
SidebarProvider
└── Sidebar
    ├── SidebarHeader
    │   ├── Logo + Org name
    │   └── OrganizationSwitcher
    ├── SidebarContent
    │   └── SidebarNav (NEW COMPONENT)
    │       ├── NavGroup "CRM" (collapsible)
    │       │   ├── NavItem "Dashboard"
    │       │   ├── NavItem "Companies"
    │       │   └── ...
    │       ├── NavGroup "Finance" (collapsible, defaultClosed)
    │       │   └── ...
    │       ├── NavGroup "HR" (collapsible, auto-expand on /hr/*)
    │       │   ├── NavItem "Dashboard"
    │       │   ├── NavItem "Branches"
    │       │   ├── NavItem "Employees"
    │       │   └── ... (8 sub-items)
    │       ├── NavGroup "Commerce" (collapsible)
    │       │   └── ... (plugin items, no prefix)
    │       └── NavGroup "System" (collapsible)
    │           └── NavItem "Settings"
    └── SidebarFooter
        └── User profile + dark mode + sign out
```

## Task Breakdown

---

### Task 1: Create `NavGroup` component

**File:** `apps/web/src/components/sidebar/nav-group.tsx` (NEW)

**Purpose:** Collapsible sidebar group using shadcn `Collapsible`.

**Implementation:**
```tsx
'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import Link from 'next/link';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroupProps {
  label: string;
  icon?: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
  forceOpen?: boolean; // e.g. when pathname matches
}

export function NavGroup({ label, icon: GroupIcon, items, defaultOpen = false, forceOpen }: NavGroupProps) {
  const pathname = usePathname();
  const isActiveGroup = items.some(item =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );
  const [open, setOpen] = useState(defaultOpen || isActiveGroup);

  // Re-evaluate when pathname changes (for forceOpen behavior)
  useEffect(() => {
    if (forceOpen !== undefined) {
      setOpen(forceOpen);
    } else if (isActiveGroup && !open) {
      setOpen(true);
    }
  }, [pathname, forceOpen, isActiveGroup]);

  return (
    <SidebarGroup>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer flex items-center justify-between pr-2">
            <span className="flex items-center gap-2">
              {GroupIcon && <GroupIcon className="size-4" />}
              {label}
            </span>
            <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild isActive={isActive}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}
```

**Verification:**
- Component renders without errors
- Collapsible expand/collapse works
- Active state highlights correct item

---

### Task 2: Create `NavItem` (single, non-grouped) component

**File:** `apps/web/src/components/sidebar/nav-item.tsx` (NEW)

**Purpose:** For top-level items that don't need grouping (e.g. "Settings" as a single item).

Actually — we can skip this. Use `SidebarMenuButton` directly for single items in a group, or put single items in a group with 1 item.

**Decision:** ALL items go inside `NavGroup`, even groups with 1 item. This keeps consistency.

---

### Task 3: Define new navigation structure

**File:** `apps/web/src/lib/navigation.ts` (NEW)

**Purpose:** Extract navigation config from `layout.tsx` into a dedicated file. This makes the layout cleaner and enables reuse.

**Implementation:**
```tsx
import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileEdit,
  FileText,
  Handshake,
  Landmark,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  UsersRound,
} from 'lucide-react';
import type { NavGroupProps } from '@/components/sidebar/nav-group';

export const navGroups: Omit<NavGroupProps, 'forceOpen'>[] = [
  {
    id: 'crm',
    label: 'CRM',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { title: 'Dashboard', href: '/', icon: LayoutDashboard },
      { title: 'Companies', href: '/companies', icon: Building2 },
      { title: 'Contacts', href: '/contacts', icon: Users },
      { title: 'Deals', href: '/deals', icon: Handshake },
      { title: 'Activities', href: '/activities', icon: Activity },
      { title: 'Products', href: '/products', icon: Package },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Landmark,
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
    defaultOpen: false,
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
    icon: ShoppingBag,
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
    icon: Settings,
    defaultOpen: true,
    items: [
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

// Feature-to-permission mapping
export const featureMap: Record<string, string> = {
  '/': 'dashboard',
  '/companies': 'companies',
  '/contacts': 'contacts',
  '/deals': 'deals',
  '/products': 'products',
  '/products/manage': 'products',
  '/sales': 'sales',
  '/invoices': 'invoices',
  '/payments': 'payments',
  '/subscriptions': 'subscriptions',
  '/templates': 'templates',
  '/activities': 'activities',
  '/hr': 'hr_employees',
  '/hr/employees': 'hr_employees',
  '/hr/branches': 'hr_branches',
  '/hr/shifts': 'hr_shifts',
  '/hr/assignments': 'hr_shifts',
  '/hr/attendance': 'hr_attendance',
  '/hr/corrections': 'hr_attendance',
  '/hr/holidays': 'hr_holidays',
  '/hr/reports': 'hr_reports',
  '/shop-orders': 'products',
  '/payments/shop': 'payments',
  '/settings/shop': 'settings',
  '/settings': 'settings',
};
```

**Verification:**
- All hrefs are correct
- All icons imported
- featureMap covers all routes

---

### Task 4: Refactor `layout.tsx` to use grouped navigation

**File:** `apps/web/src/app/(dashboard)/layout.tsx`

**Current state:** Flat `navItems` array + `featureMap` inline.

**New state:** Import `navGroups` and `featureMap` from `@/lib/navigation`. Render via `NavGroup` components.

**Changes needed:**

1. **Remove** the old `navItems` array (lines ~44-58)
2. **Remove** the old `featureMap` (lines ~61-82)
3. **Remove** the old `getPageTitle` function (lines ~84-89)
4. **Remove** unused imports: `LayoutDashboard`, `Building2`, `Users`, `Handshake`, `Package`, `ShoppingCart`, `FileText`, `Landmark`, `RefreshCw`, `LayoutTemplate`, `Activity`, `UsersRound`, `Settings`
5. **Add** imports: `NavGroup` from `@/components/sidebar/nav-group`, `navGroups`, `featureMap` from `@/lib/navigation`
6. **Replace** the SidebarContent section (lines ~150-175) with mapped NavGroups

**New SidebarContent:**
```tsx
<SidebarContent>
  {navGroups.map((group) => {
    // Filter items by permission
    const visibleItems = group.items.filter((item) => {
      if (!permsLoaded) return true;
      const feature = featureMap[item.href];
      if (!feature) return true;
      return perms[`${feature}:view`] ?? false;
    });

    // Skip group if no visible items
    if (visibleItems.length === 0) return null;

    // Determine if group should be forced open (pathname matches)
    const isInGroup = visibleItems.some(item =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
    );

    return (
      <NavGroup
        key={group.id}
        label={group.label}
        icon={group.icon}
        items={visibleItems}
        defaultOpen={group.defaultOpen}
        forceOpen={isInGroup ? true : undefined}
      />
    );
  })}
</SidebarContent>
```

**Verification:**
- All 5 groups render
- Permission filtering works
- Empty groups hidden

---

### Task 5: Fix `getPageTitle` function

**File:** `apps/web/src/app/(dashboard)/layout.tsx`

The current `getPageTitle` uses `navItems.find()` which won't work with the new grouped structure. Replace with a flat search across all group items.

```tsx
function getPageTitle(pathname: string) {
  const allItems = navGroups.flatMap(g => g.items);
  // Sort by length descending so /hr/employees matches before /hr
  const sorted = [...allItems].sort((a, b) => b.href.length - a.href.length);
  const item = sorted.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );
  return item?.title ?? 'Dashboard';
}
```

Move this function to `lib/navigation.ts` for reusability.

**Verification:**
- `/hr/employees` → "Employees"
- `/hr` → "Dashboard" (HR dashboard)
- `/` → "Dashboard"

---

### Task 6: Plugin items integration

**File:** `apps/web/src/app/(dashboard)/layout.tsx`

Current plugin items add prefix like `TOKO ONLINE: PRODUK`. With the new structure, plugin items should be merged into the "Commerce" group instead of being separate top-level items.

**Decision:** For now, since Commerce group already has the 4 shop routes hardcoded, and the plugin system may add additional ones, let's keep plugin items as a separate group appended at the end. BUT remove the prefix.

**Change in layout.tsx:**
```tsx
// Plugin nav items — merge into Commerce or append as separate group
const { data: activePluginIds } = useAuthQuery(api.plugins.getActive, {});
const pluginNavItems = useMemo(() => {
  if (!activePluginIds || activePluginIds.length === 0) return [];
  return activePluginIds.flatMap((pluginId: string) => {
    const plugin = PLUGINS.find((p) => p.id === pluginId);
    if (!plugin) return [];
    return plugin.navItems.map((item) => ({
      title: item.label, // Remove prefix!
      href: item.href,
      icon: item.icon,
    }));
  });
}, [activePluginIds]);
```

Actually, looking at the screenshot, plugin items are separate entries. With grouped nav, they should either:
1. Be merged into existing Commerce group
2. Create a new group per plugin

**Decision:** Create a dynamic group per active plugin, placed after Commerce. No prefix.

```tsx
{activePluginIds?.map((pluginId) => {
  const plugin = PLUGINS.find((p) => p.id === pluginId);
  if (!plugin) return null;
  const items = plugin.navItems.map((item) => ({
    title: item.label,
    href: item.href,
    icon: item.icon,
  }));
  return (
    <NavGroup
      key={plugin.id}
      label={plugin.name}
      icon={plugin.icon}
      items={items}
    />
  );
})}
```

**Verification:**
- Plugin items appear in their own group
- No `TOKO ONLINE:` prefix

---

### Task 7: Styling — Remove ALL CAPS

**File:** `apps/web/src/app/(dashboard)/layout.tsx` + CSS

Current:
```tsx
<span className="truncate text-sm font-bold uppercase tracking-[0.96px]">
```
```tsx
<SidebarGroupLabel className="uppercase tracking-[1.17px]">
```
```tsx
<span className="uppercase tracking-[1.17px]">{item.title}</span>
```

**Change to:**
```tsx
<span className="truncate text-sm font-semibold">
```
```tsx
<SidebarGroupLabel>
```
```tsx
<span>{item.title}</span>
```

**Verification:**
- No uppercase text in sidebar
- Title case labels: "Dashboard", "Companies"

---

### Task 8: Styling — Active state indicator

**File:** `apps/web/src/components/sidebar/nav-group.tsx`

The shadcn `SidebarMenuSubButton` with `isActive` already applies `data-[active=true]:bg-sidebar-accent`. But let's add a left border indicator for stronger visual cue.

**In NavGroup, wrap the sub-button:**
```tsx
<div className={cn(
  "relative",
  isActive && "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-4 before:w-[3px] before:rounded-full before:bg-primary"
)}>
  <SidebarMenuSubButton ... />
</div>
```

Actually, shadcn's SidebarMenuSubButton already handles active styling well. Let's keep it simple and rely on the built-in `data-[active=true]` styling.

**Verification:**
- Active item has accent background
- Visual distinction clear

---

### Task 9: Ensure Collapsible component available

**File:** Check `apps/web/src/components/ui/collapsible.tsx`

If not present, install:
```bash
npx shadcn add collapsible
```

**Verification:**
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` available

---

### Task 10: Test all routes

**Manual test checklist:**

| Route | Expected Sidebar State |
|-------|----------------------|
| `/` | CRM group expanded, Dashboard active |
| `/companies` | CRM group expanded, Companies active |
| `/hr` | HR group expanded, HR Dashboard active |
| `/hr/employees` | HR group expanded, Employees active |
| `/hr/branches` | HR group expanded, Branches active |
| `/settings` | System group expanded, Settings active |
| `/products/manage` | Commerce group expanded, Products active |

**Console checks:**
- No React key warnings
- No prop type errors
- No 404s for icons

---

### Task 11: Permission edge cases

**Test scenarios:**
1. User without `hr_employees:view` → HR group hidden entirely
2. User with only `hr_branches:view` → HR group shows only Branches
3. User with `hr_employees:view` but NOT `hr_attendance:view` → Attendance hidden
4. Owner → all groups visible

**Verification:**
- Groups with 0 visible items don't render
- Sub-items correctly filtered

---

### Task 12: Responsive / Mobile

**File:** `apps/web/src/components/ui/sidebar.tsx` (already handles this)

The existing shadcn sidebar uses Sheet for mobile. Verify:
- Mobile (<768px): sidebar as overlay sheet
- Tablet/Desktop: sidebar inline

No changes needed — shadcn sidebar handles this.

---

## File Changes Summary

| Action | File |
|--------|------|
| CREATE | `apps/web/src/components/sidebar/nav-group.tsx` |
| CREATE | `apps/web/src/lib/navigation.ts` |
| MODIFY | `apps/web/src/app/(dashboard)/layout.tsx` |
| INSTALL (if needed) | `npx shadcn add collapsible` |

## Verification Script

```bash
#!/bin/bash
cd /Users/madearga/Desktop/CRM/apps/web

# 1. TypeScript check
echo "=== TypeScript Check ==="
npx tsc --noEmit 2>&1 | grep -c "error" || echo "0 errors"

# 2. Build check
echo "=== Build Check ==="
npm run build 2>&1 | tail -5

# 3. Check all required icons imported
echo "=== Icon Imports ==="
grep -c "lucide-react" src/lib/navigation.ts

# 4. Check no UPPERCASE in sidebar labels
echo "=== Uppercase Check ==="
grep -n "uppercase" src/app/\(dashboard\)/layout.tsx || echo "No uppercase found"
```

## Rollback Plan

If issues arise:
1. Restore old `layout.tsx` from git
2. Delete new files: `components/sidebar/nav-group.tsx`, `lib/navigation.ts`
3. Revert to flat nav structure

## Post-Launch

- [ ] Monitor user feedback on sidebar usability
- [ ] Consider "Favorites" pinning feature
- [ ] Consider search/filter in sidebar
- [ ] Consider keyboard shortcuts (1-9 for groups)
