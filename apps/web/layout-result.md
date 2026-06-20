# Layout Refactor Result

## File Changed
- `apps/web/src/app/(dashboard)/layout.tsx`

## Summary of Changes

### Imports
- **Removed** 13 icon imports: `Activity`, `Building2` (kept), `Handshake`, `LayoutDashboard`, `Package`, `FileText`, `Settings`, `ShoppingCart`, `Users`, `LayoutTemplate`, `RefreshCw`, `Landmark`, `UsersRound` — kept only `Building2`, `LogOut`, `Moon`, `Sun`
- **Removed** unused sidebar imports: `SidebarGroupLabel`, `SidebarGroupContent`
- **Added** `NavGroup` from `@/components/sidebar/nav-group`
- **Added** `navGroups`, `featureMap`, `getPageTitle` from `@/lib/navigation`

### Removed Code
- `navItems` array (13 items) — moved to `@/lib/navigation`
- `featureMap` Record (22 entries) — moved to `@/lib/navigation`
- `getPageTitle` function — moved to `@/lib/navigation`
- `visibleNavItems` / `allNavItems` flat mapping logic

### New Sidebar Structure
- Replaced flat `<SidebarGroup>` with single "Navigation" label → **grouped rendering** via `navGroups.map()`
- Each group filters items by permissions, skips empty groups
- Plugin nav items render as separate `<SidebarGroup>` entries below

### Plugin Nav Items
- Removed `${plugin.name}: ` prefix from titles — now uses `item.label` directly

### getPageTitle
- Changed from `getPageTitle(pathname, allNavItems)` → `getPageTitle(pathname)` (single arg, imported from lib)

### Styling Cleanup
- Removed all `uppercase` classNames from spans and labels
- Removed all `tracking-[1.17px]` and `tracking-[0.96px]`
- Logo org name: `font-bold uppercase tracking-[0.96px]` → `font-semibold`
- Header title: `font-bold uppercase tracking-[0.96px]` → `font-semibold`
- User name, theme toggle, sign out, sign in spans: removed uppercase tracking

### Preserved (Untouched)
- Auth flow (signOut, sign in link)
- Onboarding overlay logic
- Organization switcher
- Keyboard shortcuts + command palette
- Theme toggle
- Avatar display
- Plugin system integration
- Suspense fallback
