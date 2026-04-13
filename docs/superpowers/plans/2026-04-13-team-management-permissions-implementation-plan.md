# Team Management & Permission System Implementation Plan

> For Hermes: execute task-by-task with subagent-driven-development once approved.

Goal: deliver settings-level team management (members, invitations, invite links, roles/permissions) plus backend permission enforcement and UI visibility guards based on permission templates.

Architecture: add permission templates + entries as first-class Convex entities, then route all org-level access checks through a shared permission helper. UI is split into settings tabs (`general`, `team`, existing tabs) with feature/action gating using a dedicated `usePermission` hook. Existing organization member/invitation flows are reused and extended with template IDs.

Tech stack: Next.js 15 app router, React 19, Convex + convex-ents, Better Auth integration, TypeScript, shadcn/ui, Vitest.

---

## Task 1: Add permission and invite-link schema primitives

Objective: introduce all new persistent entities and new fields required by the spec.

Files:
- Modify: `convex/schema.ts`
- Modify: `convex/organization.ts` (invitation/member payload fields)

Steps:
1) Add new entities in `convex/schema.ts`:
   - `permissionTemplates`
   - `permissionEntries`
   - `inviteLinks`
2) Add `permissionTemplateId` on `member`.
3) Add `roleTemplateId` on `invitation` (for email invite role assignment).
4) Ensure indexes exactly support required queries:
   - `permissionTemplates.organizationId_name`
   - `permissionEntries.templateId_feature_action`
   - `inviteLinks.token`
   - `inviteLinks.organizationId_status` (add `status` field for active/revoked logic)
5) Typecheck.

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add convex/schema.ts convex/organization.ts`
- `git commit -m "feat(authz): add permission template and invite-link schema"`

---

## Task 2: Implement permission helper layer and default role seeding

Objective: centralize permission evaluation and default template creation (Owner/Admin/Member).

Files:
- Create: `convex/permissionHelpers.ts`
- Modify: `convex/organization.ts`

Steps:
1) Create `convex/permissionHelpers.ts` with:
   - `checkPermission(userId, feature, action)`
   - `getPermissionsForUser(userId)`
   - `seedDefaultTemplates(orgId)`
   - constants for feature/action matrix.
2) Implement owner bypass in helper (`role === owner` => allow all).
3) Implement fallback deny when entry missing.
4) Implement default template seeding entries exactly as spec.
5) Call `seedDefaultTemplates` after org creation in `organization.createOrganization`.
6) Update `organization.inviteMember` to accept `roleTemplateId` and persist to invitation.
7) Update `organization.acceptInvitation` to write member `permissionTemplateId` from invitation.

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add convex/permissionHelpers.ts convex/organization.ts`
- `git commit -m "feat(authz): add permission helpers and default template seeding"`

---

## Task 3: Add Convex APIs for template CRUD and invite-link flow

Objective: expose backend APIs required by Team sub-tabs.

Files:
- Create: `convex/permissionTemplates.ts`
- Create: `convex/inviteLinks.ts`
- Modify: `convex/functions.ts`

Steps:
1) Add template APIs:
   - `list`
   - `getById`
   - `create`
   - `update`
   - `delete` (with reassignment to default Member template)
2) Add invite-link APIs:
   - `create`
   - `list`
   - `revoke`
   - `getByToken` (public)
   - `joinViaLink` (authenticated)
3) Add permission checks on each API (team.view, team.invite, team.manage_roles, etc.).
4) Extend `createOrgQuery` and `createOrgMutation` in `convex/functions.ts` to accept optional:
   - `permission?: { feature: string; action: string }`
   and enforce via helper before handler execution.

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add convex/permissionTemplates.ts convex/inviteLinks.ts convex/functions.ts`
- `git commit -m "feat(authz): add permission template and invite-link backend APIs"`

---

## Task 4: Restructure settings routing into tabbed layout

Objective: convert flat settings page into tabbed settings structure with permission-aware visibility.

Files:
- Create: `apps/web/src/app/(dashboard)/settings/layout.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/general/page.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/team/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (redirect to `/settings/general`)

Steps:
1) Move current settings content from `/settings/page.tsx` into `/settings/general/page.tsx`.
2) Build top-level settings tabs in `settings/layout.tsx`:
   - General
   - Team
   - Pricelists
   - Reminder Rules
3) Hide tabs entirely when no corresponding `view` permission.
4) Keep current behavior for owner (see all tabs).
5) Add redirect on `/settings` to `/settings/general`.

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add apps/web/src/app/(dashboard)/settings`
- `git commit -m "feat(settings): split settings into tabbed general/team routes"`

---

## Task 5: Build Team page with 4 sub-tabs and existing member/invitation integration

Objective: implement `/settings/team` shell + Members + Invitations UI with permission gating.

Files:
- Create: `apps/web/src/components/team/team-settings-tabs.tsx`
- Create: `apps/web/src/components/team/team-members-tab.tsx`
- Create: `apps/web/src/components/team/team-invitations-tab.tsx`
- Modify: `apps/web/src/components/organization/organization-members.tsx` (extract shared logic if needed)
- Modify: `apps/web/src/app/(dashboard)/settings/team/page.tsx`

Steps:
1) Add Team sub-tabs:
   - Members
   - Invitations
   - Invite Link
   - Roles & Permissions
2) Implement Members tab:
   - member list with template badges
   - invite button (`team.invite`)
   - role change (`team.manage_roles`)
   - remove member (`team.remove`)
3) Implement Invitations tab:
   - pending invitations list
   - cancel invitation action
4) Gate tab visibility and actions by permission.

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add apps/web/src/components/team apps/web/src/app/(dashboard)/settings/team/page.tsx`
- `git commit -m "feat(team-ui): add members and invitations sub-tabs with permission gates"`

---

## Task 6: Build Roles & Permissions sub-tab (template CRUD + matrix)

Objective: allow owners/authorized members to manage custom templates.

Files:
- Create: `apps/web/src/components/team/team-roles-tab.tsx`
- Create: `apps/web/src/components/team/permission-matrix.tsx`

Steps:
1) Render template badge rail with selected template details.
2) Show default templates as non-editable/non-deletable.
3) Add create template dialog (name, description, color, clone-from template).
4) Add update flow for custom template metadata + matrix toggles.
5) Add delete flow with confirm + member reassignment to default Member template.

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add apps/web/src/components/team/team-roles-tab.tsx apps/web/src/components/team/permission-matrix.tsx`
- `git commit -m "feat(team-ui): add roles and permissions management tab"`

---

## Task 7: Build Invite Link sub-tab and join-by-token page

Objective: complete shareable link invitation flow end-to-end.

Files:
- Create: `apps/web/src/components/team/team-invite-link-tab.tsx`
- Create: `apps/web/src/app/invite/[token]/page.tsx`
- Modify: `apps/web/src/app/login/page.tsx` (preserve callback to invite token if needed)

Steps:
1) Add invite link generator form:
   - role template dropdown
   - expiry selector (1/7/30 days)
2) Implement generated-link output + copy button.
3) Implement active-links list with revoke.
4) Add `/invite/[token]` page:
   - validate token via `getByToken`
   - if unauthenticated, route to login/signup then return
   - if authenticated, show org+role summary and Join button
   - join via `joinViaLink`
5) Handle invalid/expired/revoked/already-member states.

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add apps/web/src/components/team/team-invite-link-tab.tsx apps/web/src/app/invite/[token]/page.tsx apps/web/src/app/login/page.tsx`
- `git commit -m "feat(team-ui): add invite-link generation and token join page"`

---

## Task 8: Add frontend permission hook and global navigation filtering

Objective: ensure users only see UI/routes they are authorized to view/manage.

Files:
- Create: `apps/web/src/lib/permissions/usePermission.ts`
- Create: `apps/web/src/lib/permissions/permissions.ts`
- Modify: `apps/web/src/lib/convex/hooks/index.ts`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/layout.tsx`

Steps:
1) Add `usePermission(feature, action)` hook based on `getPermissionsForUser`.
2) Add sidebar-to-feature mapping and filter nav items using `feature.view`.
3) Filter settings tabs and team sub-tabs with same permission source.
4) Add defensive UI fallback for forbidden pages (empty state + CTA).

Run:
- `pnpm typecheck`
Expected:
- PASS

Commit:
- `git add apps/web/src/lib/permissions apps/web/src/app/(dashboard)/layout.tsx apps/web/src/app/(dashboard)/settings/layout.tsx apps/web/src/lib/convex/hooks/index.ts`
- `git commit -m "feat(authz-ui): add usePermission hook and permission-based navigation"`

---

## Task 9: Backfill migration for existing orgs and existing members

Objective: make feature safe for existing production data.

Files:
- Create: `convex/migrations/teamPermissions.ts`
- Modify: `convex/seed.ts` (if seed entry point exists; otherwise add migration runner docs)

Steps:
1) Create migration to seed default templates for orgs missing them.
2) Assign default Member template to members without `permissionTemplateId`.
3) Preserve owner behavior (owner bypass remains effective even if template unset).
4) Add idempotency checks so migration can run multiple times safely.

Run:
- `pnpm typecheck`
- `pnpm test`
Expected:
- PASS

Commit:
- `git add convex/migrations/teamPermissions.ts convex/seed.ts`
- `git commit -m "chore(migration): backfill permission templates for existing organizations"`

---

## Task 10: Verification pass and documentation updates

Objective: validate full feature behavior and record operational guidance.

Files:
- Create: `docs/superpowers/runbooks/team-permissions-verification.md`
- Modify: `docs/superpowers/specs/2026-04-13-team-management-permissions-design.md` (implementation notes section)

Steps:
1) Manual E2E checks:
   - owner path
   - admin restricted actions
   - member limited visibility
   - invite by email
   - invite by link
   - role template create/update/delete
2) Run project checks:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
3) Document troubleshooting (missing default templates, expired token edge cases, reassignment behavior).

Commit:
- `git add docs/superpowers/runbooks/team-permissions-verification.md docs/superpowers/specs/2026-04-13-team-management-permissions-design.md`
- `git commit -m "docs(team): add verification runbook and implementation notes"`

---

## Definition of done

- Spec requirements implemented across backend + frontend.
- Team tab has 4 sub-tabs with correct permission gates.
- Sidebar/settings visibility driven by template permissions.
- Email invite and invite-link flows both assign `permissionTemplateId` correctly.
- Default template seeding works for new and existing orgs.
- Lint/typecheck/tests pass.
- Documentation/runbook updated.
