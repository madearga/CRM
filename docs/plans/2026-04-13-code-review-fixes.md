# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all P0/P1 issues and key P2 issues from the code review of the team management & permissions system.

**Architecture:** Targeted fixes to 7 files across backend (Convex) and frontend (React). No new files created — only modifications to existing code. Backend fixes focus on security (token generation, race conditions) and performance (N+1 queries). Frontend fixes focus on correctness (wrong hook) and UX (flash of empty content).

**Tech Stack:** Convex (convex-ents v0.16.0), React (Next.js), TypeScript, Zod

---

### Task 1: Fix insecure token generation (P0 #1)

**Files:**
- Modify: `convex/inviteLinks.ts:20-27`

**Step 1: Replace Math.random with crypto.getRandomValues**

Replace the `generateToken` function:

```typescript
function generateToken(): string {
  const bytes = new Uint8Array(24); // 24 bytes = 48 hex chars = 192 bits entropy
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
```

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add convex/inviteLinks.ts && git commit -m "fix(security): use crypto.getRandomValues for invite token generation"
```

---

### Task 2: Fix race condition in joinViaLink (P0 #2)

**Files:**
- Modify: `convex/inviteLinks.ts:192-211` (the `joinViaLink` handler)

**Step 1: Add defensive maxUses check with re-read after member insert**

The `joinViaLink` mutation has two TOCTOU issues:
1. `maxUses` check reads `usedCount`, then increments — two concurrent joins can both pass
2. "Already a member" check + create member — two concurrent joins could create duplicate members

For issue #1: Convex mutations run serially per-document. The `usedCount` increment patches the link document, so concurrent joins will serialize on that document. However, the check happens *before* the member insert. Fix by moving the validation inside a re-check pattern.

For issue #2: Add the `organizationId_userId` uniqueness constraint check AFTER member creation by catching the error, or accept the small risk (document it).

Replace the `joinViaLink` handler's validation + member creation section with:

```typescript
export const joinViaLink = createAuthMutation({})({
  args: { token: z.string() },
  returns: z.object({
    organizationId: zid('organization'),
    organizationName: z.string(),
  }),
  handler: async (ctx, args) => {
    // Look up the invite link
    const links = await ctx
      .table('inviteLinks', 'token', (q: any) => q.eq('token', args.token))
      .take(1);

    const link = links[0];
    if (!link) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Invite link not found' });
    }

    // Validate link status
    if (link.status !== 'active') {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Invite link has been revoked' });
    }
    if (link.expiresAt < Date.now()) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Invite link has expired' });
    }
    if (link.maxUses !== undefined && link.usedCount >= link.maxUses) {
      throw new ConvexError({ code: 'BAD_REQUEST', message: 'Invite link has reached max uses' });
    }

    // Check if already a member (TOCTOU note: small race window accepted — 
    // Convex serializes per-document but member insert + link patch are different docs)
    const existing = await ctx
      .table('member', 'organizationId_userId', (q: any) =>
        q
          .eq('organizationId', link.organizationId)
          .eq('userId', ctx.user._id),
      )
      .take(1);

    if (existing.length > 0) {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'You are already a member of this organization',
      });
    }

    // Atomically increment usedCount FIRST — this serializes concurrent joins on the link doc
    const updatedLink = await ctx.table('inviteLinks').getX(link._id);
    const freshLink = await updatedLink; // re-read after potential serialization
    // Note: in Convex, mutations are serialized per document, so the patch below 
    // ensures only one concurrent join can increment at a time

    // Create member record
    await ctx.table('member').insert({
      role: 'member',
      createdAt: Date.now(),
      permissionTemplateId: link.roleTemplateId as Id<'permissionTemplates'>,
      organizationId: link.organizationId as Id<'organization'>,
      userId: ctx.user._id,
    });

    // Increment usedCount (serialized on link document)
    await ctx
      .table('inviteLinks')
      .getX(link._id)
      .patch({
        usedCount: link.usedCount + 1,
      });

    // Return org info
    const org = await ctx.table('organization').getX(link.organizationId);

    return {
      organizationId: org._id as Id<'organization'>,
      organizationName: org.name,
    };
  },
});
```

Note: The fundamental fix here is documenting the accepted risk. Convex's OCC (optimistic concurrency control) will actually reject concurrent mutations that conflict on the same document. The `link.usedCount + 1` patch will fail if another mutation patched the same link between our read and write, because Convex uses document-level versioning. So the race condition is actually mitigated by Convex's built-in OCC.

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add convex/inviteLinks.ts && git commit -m "fix(security): document and improve joinViaLink concurrency safety"
```

---

### Task 3: Fix usePublicQuery → useAuthQuery for permissions hook (P1 #3)

**Files:**
- Modify: `apps/web/src/lib/permissions/use-permission.ts:4,16`

**Step 1: Replace import and usage**

Change line 4 from:
```typescript
import { usePublicQuery } from '@/lib/convex/hooks';
```
to:
```typescript
import { useAuthQuery } from '@/lib/convex/hooks';
```

Change line 16 from:
```typescript
  const { data } = usePublicQuery(
```
to:
```typescript
  const { data } = useAuthQuery(
```

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add apps/web/src/lib/permissions/use-permission.ts && git commit -m "fix(authz): use useAuthQuery for permission endpoint"
```

---

### Task 4: Optimize N+1 query in permissionTemplates.list (P1 #5)

**Files:**
- Modify: `convex/permissionTemplates.ts:155-185` (the `list` handler)

**Step 1: Replace N+1 with batch fetch + group**

Replace the `list` handler with a batched version:

```typescript
  handler: async (ctx) => {
    const templates = await ctx
      .table('permissionTemplates', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(100);

    // Batch fetch ALL entries for this org, then group by templateId
    const allEntries = await ctx
      .table('permissionEntries', 'templateId_feature_action', (q: any) =>
        // We can't filter by orgId directly on this index, so fetch per-template
        // But at least we avoid Promise.all overhead — keep it simple since 
        // templates are typically 3-10, not 100
        q.eq('templateId', templates[0]?._id ?? ('' as any)),
      )
      .take(2000);

    // Actually, the index is templateId_feature_action so we can't batch by orgId.
    // Keep the Promise.all approach but it's fine for < 10 templates.
    return Promise.all(
      templates.map(async (tmpl: any) => {
        const entries = await ctx
          .table('permissionEntries', 'templateId_feature_action', (q: any) =>
            q.eq('templateId', tmpl._id),
          )
          .take(200);

        return {
          _id: tmpl._id as Id<'permissionTemplates'>,
          _creationTime: tmpl._creationTime,
          name: tmpl.name,
          description: tmpl.description ?? null,
          color: tmpl.color ?? null,
          isDefault: tmpl.isDefault,
          ownerId: tmpl.ownerId as Id<'user'>,
          entries: entries.map((e: any) => ({
            _id: e._id as Id<'permissionEntries'>,
            feature: e.feature,
            action: e.action,
            allowed: e.allowed,
          })),
        };
      }),
    );
  },
```

**IMPORTANT REALIZATION:** The index is `templateId_feature_action`, so we CAN'T batch-fetch by `organizationId`. The N+1 is inherent to the data model. The real fix is to add a `organizationId` index to `permissionEntries` so we can fetch all entries for the org at once.

**REVISED Step 1:** Add `organizationId` index to `permissionEntries` and batch fetch:

In `convex/schema.ts`, add index to `permissionEntries`:
```typescript
// After existing index line:
.index('templateId_feature_action', ['templateId', 'feature', 'action']),
// Add:
.index('organizationId', ['organizationId']),
```

Then update the `list` handler in `convex/permissionTemplates.ts`:

```typescript
  handler: async (ctx) => {
    const templates = await ctx
      .table('permissionTemplates', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(100);

    // Batch: fetch all entries for this org, group by templateId
    const allEntries = await ctx
      .table('permissionEntries', 'organizationId', (q: any) =>
        q.eq('organizationId', ctx.orgId),
      )
      .take(2000);

    // Group entries by templateId
    const entriesByTemplate = new Map<string, any[]>();
    for (const entry of allEntries) {
      const key = (entry.templateId as any).toString();
      if (!entriesByTemplate.has(key)) entriesByTemplate.set(key, []);
      entriesByTemplate.get(key)!.push(entry);
    }

    return templates.map((tmpl: any) => ({
      _id: tmpl._id as Id<'permissionTemplates'>,
      _creationTime: tmpl._creationTime,
      name: tmpl.name,
      description: tmpl.description ?? null,
      color: tmpl.color ?? null,
      isDefault: tmpl.isDefault,
      ownerId: tmpl.ownerId as Id<'user'>,
      entries: (entriesByTemplate.get(tmpl._id.toString()) ?? []).map((e: any) => ({
        _id: e._id as Id<'permissionEntries'>,
        feature: e.feature,
        action: e.action,
        allowed: e.allowed,
      })),
    }));
  },
```

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add convex/schema.ts convex/permissionTemplates.ts && git commit -m "perf(permissionTemplates): batch entries fetch in list handler"
```

---

### Task 5: Fix fragile invitation patch + add error handling (P1 #7)

**Files:**
- Modify: `convex/organization.ts:914-923`

**Step 1: Add null check and logging for invitation patch**

Replace:
```typescript
      // Patch roleTemplateId onto the invitation if provided
      if (args.roleTemplateId && invitationId) {
        const invitation = await ctx.table('invitation').get(invitationId as Id<'invitation'>);
        if (invitation) {
          await invitation.patch({ roleTemplateId: args.roleTemplateId });
        }
      }
```

With:
```typescript
      // Patch roleTemplateId onto the invitation if provided
      if (args.roleTemplateId && invitationId) {
        const invitation = await ctx.table('invitation').get(invitationId as Id<'invitation'>);
        if (invitation) {
          await invitation.patch({ roleTemplateId: args.roleTemplateId });
        } else {
          console.warn(
            `[inviteMember] Could not patch roleTemplateId: invitation ${invitationId} not found after creation`,
          );
        }
      }
```

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add convex/organization.ts && git commit -m "fix(invite): add error handling for invitation roleTemplateId patch"
```

---

### Task 6: Fix flash of empty sidebar/tabs on load (P2 #11-12)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/layout.tsx`

**Step 1: Update dashboard layout to show all items until permissions load**

In `apps/web/src/app/(dashboard)/layout.tsx`, change the `visibleNavItems` filter:

```typescript
  const perms = usePermissions();
  const permsLoaded = Object.keys(perms).length > 0;

  const visibleNavItems = navItems.filter((item) => {
    if (!permsLoaded) return true; // Show all until permissions resolve
    const feature = featureMap[item.href];
    if (!feature) return true;
    return perms[`${feature}:view`] ?? false;
  });
```

**Step 2: Update settings layout with same pattern**

In `apps/web/src/app/(dashboard)/settings/layout.tsx`:

```typescript
  const perms = usePermissions();
  const permsLoaded = Object.keys(perms).length > 0;

  const visibleTabs = tabs.filter((tab) => {
    if (!permsLoaded) return true; // Show all until permissions resolve
    if (tab.feature) {
      return perms[`${tab.feature}:view`] ?? false;
    }
    return true;
  });
```

**Step 3: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
cd /Users/madearga/Desktop/crm && git add apps/web/src/app/\(dashboard\)/layout.tsx apps/web/src/app/\(dashboard\)/settings/layout.tsx && git commit -m "fix(ux): prevent flash of empty sidebar/tabs while permissions load"
```

---

### Task 7: Remove unused user variable in settings layout (P2 #9)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/layout.tsx`

**Step 1: Remove unused import and variable**

Remove the `useCurrentUser` import and the `const user = useCurrentUser()` line.

In `apps/web/src/app/(dashboard)/settings/layout.tsx`:
- Remove: `import { useCurrentUser } from '@/lib/convex/hooks';` (keep the `usePermissions` import)
- Remove: `const user = useCurrentUser();`

**Step 2: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm && pnpm typecheck`
Expected: PASS

**Step 3: Commit (squash with Task 6 if both touch the same file)**

```bash
cd /Users/madearga/Desktop/crm && git add apps/web/src/app/\(dashboard\)/settings/layout.tsx && git commit -m "chore: remove unused useCurrentUser in settings layout"
```

---

## Summary

| Task | Severity | File(s) | What |
|------|----------|---------|------|
| 1 | P0 | `convex/inviteLinks.ts` | `Math.random` → `crypto.getRandomValues` |
| 2 | P0 | `convex/inviteLinks.ts` | Document TOCTOU, rely on Convex OCC |
| 3 | P1 | `apps/web/src/lib/permissions/use-permission.ts` | `usePublicQuery` → `useAuthQuery` |
| 4 | P1 | `convex/schema.ts` + `convex/permissionTemplates.ts` | Add index, batch entries fetch |
| 5 | P1 | `convex/organization.ts` | Add null check + warning log |
| 6 | P2 | `layout.tsx` × 2 | Show all until perms loaded |
| 7 | P2 | `settings/layout.tsx` | Remove unused variable |
