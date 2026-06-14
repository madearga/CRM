# nav-group.tsx Result

## File Created
`apps/web/src/components/sidebar/nav-group.tsx`

## What was implemented
- **NavItem interface**: `title`, `href`, `icon` (LucideIcon)
- **NavGroupProps interface**: `label`, optional `icon`, `items[]`, optional `defaultOpen`
- **Active state**: exact match for `/`, prefix match for other paths
- **ChevronRight rotation**: `rotate-90` when open via `cn` conditional
- **Group label**: icon + text + chevron
- **Sub-items**: `SidebarMenuSub > SidebarMenuSubItem > SidebarMenuSubButton asChild > Link`
- **useEffect auto-expand**: expands group when pathname matches any item
- **'use client'** directive
