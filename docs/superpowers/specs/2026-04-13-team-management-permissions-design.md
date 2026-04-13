# Team Management & Permission System

**Date:** 2026-04-13
**Status:** Approved

## Overview

Add team management UI and a template-based permission system to the CRM. Owners create permission templates (roles), assign them to members, and control who can see/manage which features. Includes email invite + shareable link flows for adding members.

## Routing & Navigation

### Settings Tabs

```
/settings/general        → Profile + Workspace + About (existing)
/settings/team           → Team management (new, 4 sub-tabs)
/settings/pricelists/... → (existing)
/settings/reminder-rules/... → (existing)
```

Horizontal tabs at top of settings:

```
[General] [Team] [Pricelists] [Reminder Rules]
```

### Visibility Rules

- **Owner**: sees all tabs
- **Members with custom template**: only tabs where their template has `view` or higher permission
- Tabs hidden entirely (not disabled) when user lacks permission

### Settings Page Restructure

Current flat settings page (`/settings/page.tsx`) becomes:
- `/settings/general/page.tsx` — existing Profile + Workspace + About cards
- `/settings/team/page.tsx` — new team management
- `/settings/layout.tsx` — shared tab navigation

## Data Model

### New Tables

#### permissionTemplates

```ts
permissionTemplates: defineEnt({
  name: v.string(),              // "Sales Manager", "Finance", etc
  description: v.string().optional(),
  color: v.string().optional(),  // badge color hex
  isDefault: v.boolean(),        // Owner/Admin/Member are defaults
})
  .field('organizationId', v.id('organization'), { index: true })
  .field('ownerId', v.id('user'))
  .edge('owner', { to: 'user', field: 'ownerId' })
  .index('organizationId_name', ['organizationId', 'name'])
  .searchIndex('search_permission_templates', {
    searchField: 'name',
    filterFields: ['organizationId'],
  })
```

#### permissionEntries

```ts
permissionEntries: defineEnt({
  feature: v.string(),   // "team", "invoices", "products", "settings", etc
  action: v.string(),    // "view", "create", "edit", "delete", "manage"
  allowed: v.boolean(),  // true/false
})
  .field('organizationId', v.id('organization'), { index: true })
  .field('templateId', v.id('permissionTemplates'))
  .edge('template', { to: 'permissionTemplates', field: 'templateId' })
  .index('templateId_feature_action', ['templateId', 'feature', 'action'])
```

#### inviteLinks

```ts
inviteLinks: defineEnt({
  token: v.string(),             // unique random token
  expiresAt: v.number(),         // timestamp
  maxUses: v.optional(v.number()),
  usedCount: v.number(),         // default 0
  roleTemplateId: v.id('permissionTemplates'),
})
  .field('organizationId', v.id('organization'), { index: true })
  .field('creatorId', v.id('user'))
  .edge('creator', { to: 'user', field: 'creatorId' })
  .index('token', ['token'])
  .index('organizationId_status', ['organizationId', 'status'])
```

### Modified Tables

**member** — add field:

```ts
permissionTemplateId: v.optional(v.id('permissionTemplates'))
```

### Default Templates

Auto-created when organization is created. Seeded with these entries:

**Owner** (`isDefault: true`, not editable):
- All features: all actions allowed
- Cannot be edited or deleted

**Admin** (`isDefault: true`, not editable):
- All features: all actions allowed except:
  - `team.manage_roles`: denied
  - `team.invite`: denied (only owner can invite for now, configurable later)
  - `settings.manage`: denied

**Member** (`isDefault: true`, not editable):
- `dashboard.view`: allowed
- `contacts.view`: allowed
- `companies.view`: allowed
- `deals.view`: allowed
- Everything else: denied

### Permission Check Flow

```
1. Check member.role
   → if "owner": bypass all checks (full access)
2. Check member.permissionTemplateId
   → load template entries
3. Match feature + action against entries
   → if allowed: true: permit
4. If no entry or allowed: false: deny
```

### Permission Matrix

| Feature | Actions |
|---------|---------|
| `dashboard` | view |
| `contacts` | view, create, edit, delete |
| `companies` | view, create, edit, delete |
| `deals` | view, create, edit, delete |
| `products` | view, create, edit, delete |
| `sales` | view, create, edit, delete |
| `invoices` | view, create, edit, delete |
| `subscriptions` | view, create, edit, delete |
| `templates` | view, create, edit, delete |
| `team` | view, invite, remove, manage_roles |
| `settings` | view, manage |
| `activities` | view, create, edit, delete |

## UI Design

### Team Tab — 4 Sub-tabs

Horizontal sub-tabs within `/settings/team`:

```
[Members] [Invitations] [Invite Link] [Roles & Permissions]
```

Visibility: `team.view` permission required to see the tab at all. Sub-features gated by more specific permissions:
- `team.invite` — Invite button, Invite Link tab visible
- `team.manage_roles` — Roles & Permissions tab visible, ability to change member roles

### Sub-tab 1: Members

- Header: "Members (3/5)" with counter showing member limit
- Button: "+ Invite" (opens invite dialog, requires `team.invite`)
- Member list: Avatar, Name, Email, Role Template badge (colored), Status
- Owner row: No action menu, "Owner" badge locked
- Non-owner rows: [⋮ More] dropdown:
  - "Change Role" → select from permission templates dropdown (requires `team.manage_roles`)
  - "Remove from Organization" → confirm dialog (requires `team.remove`)
- Empty state: "No members yet"

### Sub-tab 2: Invitations

- Header: "Pending Invitations (2)"
- List: Email, Role Template badge, Expires in Xd, Invited by Name
- [Cancel] button per row → confirm → cancel invitation
- Empty state: "No pending invitations"

### Sub-tab 3: Invite Link

- Form section:
  - "Role for new members" dropdown → populated from permission templates
  - "Expires in" dropdown → 1 day, 7 days, 30 days
  - [Generate Link] button
- Generated link display with copy button
- Active links list:
  - Token (truncated), Role, Expires in Xd, [Revoke] button
- Empty state for links: "No active invite links"

### Sub-tab 4: Roles & Permissions

- Header: "Roles & Permissions" with [+ New Role] button
- Horizontal list of template badges (clickable to select):
  - Default templates (Owner, Admin, Member) — shown with "Default" badge, edit/delete disabled
  - Custom templates — with ✎ Edit and 🗑 Delete icons
- Selected template detail panel:
  - Name, Description (editable for custom templates)
  - Permission matrix grid:
    - Rows: Features (Dashboard, Contacts, Companies, Deals, Products, Sales, Invoices, Subscriptions, Templates, Team, Settings, Activities)
    - Columns: View, Create, Edit, Delete (per feature)
    - Checkboxes toggleable for custom templates
- New Role dialog:
  - Name input
  - Description input
  - Color picker (optional)
  - Start from template dropdown (copy permissions from existing)
  - Permission matrix toggles
  - [Create] button
- Delete custom template:
  - Confirm dialog: "Members using this role will be reassigned to 'Member'. Continue?"
  - On delete: reassign all members with this templateId to default Member template

## Invite Flow

### Email Invite (existing backend)

1. Owner/Admin clicks "+ Invite" in Members tab
2. Dialog: Email input, Role template dropdown
3. Submit → calls `organization.inviteMember` with email + role
4. Invitee receives email with link
5. Invitee clicks link → if no account, redirected to signup → after signup, auto-redirected to accept page
6. Accept page shows org name, inviter name, role → [Accept] / [Reject]
7. On accept: added as member with the assigned permissionTemplateId

### Shareable Link (new)

1. Owner/Admin goes to Invite Link tab
2. Selects role template, expiry duration
3. Clicks [Generate Link]
4. System creates inviteLink record with unique token
5. Link displayed: `{SITE_URL}/invite/{token}`
6. Anyone with link opens it:
   - If not logged in: redirected to signup/login first
   - If logged in: see org name, role, expiry → [Join] button
   - If already member: "You are already a member" message
7. On join: member created with the link's roleTemplateId
8. Link auto-expires after expiresAt
9. Owner can revoke anytime

## Backend Functions Needed

### Convex Functions (new)

```
permissionTemplates/
  list          — list all templates for org
  getById       — get template with entries
  create        — create template + entries
  update        — update name, description, color, entries
  delete        — delete custom template, reassign members

inviteLinks/
  create        — generate invite link
  list          — list active links for org
  revoke        — revoke a link
  getByToken    — public, get link details by token
  joinViaLink   — authenticated, join org via link token

permissionHelpers/
  checkPermission(userId, feature, action) — reusable guard
  getPermissionsForUser(userId) — return all permissions for current user
  seedDefaultTemplates(orgId) — called on org creation
```

### Modified Existing Functions

- `organization.createOrganization` — call `seedDefaultTemplates` after org creation
- `organization.inviteMember` — accept `roleTemplateId` param, store on invitation
- `organization.acceptInvitation` — assign `permissionTemplateId` to new member
- `functions.ts` — add `createOrgQuery`/`createOrgMutation` variant that checks feature permission before executing

## Frontend Permission Guard

### Hook: usePermission(feature, action)

```ts
// Returns { allowed: boolean, loading: boolean }
// Used in components to conditionally render UI
const { allowed } = usePermission('invoices', 'create');
if (!allowed) return null;
```

### Sidebar Navigation Filter

Sidebar items filtered by permissions:
- Check `feature.view` permission for each nav item
- Hide items user doesn't have access to
- Settings sub-tabs also filtered

### Convex Function Wrapper

Extend existing `createOrgQuery`/`createOrgMutation` to optionally accept `requiredPermission`:

```ts
export const createOrgQuery = ({ permission }: { permission?: { feature: string; action: string } }) =>
  // ... existing logic + permission check before handler
```

## Implementation Priority

1. **Phase 1: Schema & Backend** — permission tables, default seed, permission check helpers
2. **Phase 2: Settings Restructure** — layout with tabs, move general to sub-page
3. **Phase 3: Members & Invitations UI** — sub-tabs 1 & 2 (using existing backend)
4. **Phase 4: Roles & Permissions UI** — sub-tab 4, CRUD templates, assign to members
5. **Phase 5: Invite Link** — sub-tab 3, new inviteLinks backend
6. **Phase 6: Permission Guards** — sidebar filter, route guards, hook, Convex wrapper
7. **Phase 7: Seed & Migration** — seed defaults for existing orgs, assign Member template to existing members
