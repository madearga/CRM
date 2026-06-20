# Cron Sync External Plugins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add hourly cron job that automatically syncs all connected external plugins so data stays up-to-date without manual clicks.

**Architecture:** New `syncAllConnected` internal action iterates all connected plugins, syncs each table (products, orders, customers) with error isolation (one plugin failure doesn't stop others). Registered in existing `convex/crons.ts` with hourly interval.

**Tech Stack:** Convex cron jobs, internal actions, existing `triggerSync` logic refactored for reuse.

---

### Task 1: Refactor Sync Logic into Reusable Internal Function

**Files:**
- Modify: `convex/externalPlugins.ts`

**Why:** Current `triggerSync` is a `createOrgMutation` (requires authenticated user context). Cron runs without user. Need internal version without auth dependency.

**Step 1: Add `syncPluginTable` internal mutation**

Add BEFORE the `triggerSync` mutation (around line 353). This is the core sync logic extracted to work without user context:

```ts
/** Internal: sync a single table for a single plugin. No auth required. */
export const syncPluginTable = internalMutation({
  args: {
    pluginId: v.string(),
    table: v.string(),
  },
  returns: v.object({ success: z.boolean(), message: z.string() }),
  handler: async (ctx, args) => {
    const plugin = await ctx.table('externalPlugins').get(args.pluginId as any);
    if (!plugin || plugin.status !== 'connected') {
      return { success: false, message: 'Plugin not found or not connected' };
    }

    // Rate limit: 5-minute cooldown
    if (plugin.lastSyncAt && Date.now() - plugin.lastSyncAt < 5 * 60 * 1000) {
      return { success: false, message: 'Rate limited — too soon' };
    }

    const startTime = Date.now();
    const orgId = plugin.organizationId;

    try {
      const response = await fetch(
        `${plugin.url}/api/plugin/data?table=${args.table}&limit=100`,
        {
          headers: { Authorization: `Bearer ${plugin.apiKey}` },
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const data = (result.data ?? []).slice(0, 200);
      const durationMs = Date.now() - startTime;

      let syncedCount = 0;

      if (args.table === 'products') {
        for (const item of data) {
          const existing = await ctx
            .table('products', 'organizationId_externalId', (q) =>
              q.eq('organizationId', orgId).eq('externalId', String(item.id))
            )
            .first();
          const fields = {
            name: item.name ?? 'Unnamed Product',
            type: 'storable' as const,
            description: item.description,
            price: item.price,
            imageUrl: item.imageUrl,
            stock: item.stock,
            slug: item.slug,
            visibleInShop: true,
            externalId: String(item.id),
            externalPluginId: plugin._id,
            organizationId: orgId,
            ownerId: plugin.ownerId ?? orgId as any,
          };
          if (existing) {
            await existing.patch(fields);
          } else {
            await ctx.table('products').insert(fields as any);
          }
          syncedCount++;
        }
      } else if (args.table === 'orders') {
        for (const item of data) {
          const existing = await ctx
            .table('saleOrders', 'organizationId_externalId', (q) =>
              q.eq('organizationId', orgId).eq('externalId', String(item.id))
            )
            .first();
          const stateMap: Record<string, string> = {
            completed: 'done',
            cancelled: 'cancel',
          };
          const state = (stateMap[item.status] ?? 'confirmed') as any;
          const fields = {
            number: item.orderNumber ?? item.id ?? String(item.id),
            state,
            orderDate: item.orderDate ?? item.createdAt ?? Date.now(),
            subtotal: item.subtotal ?? item.totalAmount ?? item.total ?? 0,
            totalAmount: item.totalAmount ?? item.total ?? 0,
            customerNotes: item.customerNotes ?? item.notes,
            source: 'manual' as const,
            externalId: String(item.id),
            externalPluginId: plugin._id,
            organizationId: orgId,
            ownerId: plugin.ownerId ?? orgId as any,
          };
          if (existing) {
            await existing.patch(fields);
          } else {
            await ctx.table('saleOrders').insert(fields as any);
          }
          syncedCount++;
        }
      } else if (args.table === 'customers') {
        for (const item of data) {
          const existing = await ctx
            .table('contacts', 'organizationId_externalId', (q) =>
              q.eq('organizationId', orgId).eq('externalId', String(item.id))
            )
            .first();
          const fields = {
            fullName: item.name ?? item.fullName ?? 'Unknown',
            email: item.email ?? '',
            phone: item.phone,
            lifecycleStage: 'customer' as const,
            externalId: String(item.id),
            externalPluginId: plugin._id,
            organizationId: orgId,
            ownerId: plugin.ownerId ?? orgId as any,
          };
          if (existing) {
            await existing.patch(fields);
          } else {
            await ctx.table('contacts').insert(fields as any);
          }
          syncedCount++;
        }
      }

      await ctx.table('pluginSyncLog').insert({
        externalPluginId: plugin._id,
        organizationId: orgId,
        direction: 'pull',
        table: args.table,
        status: 'success',
        recordCount: syncedCount,
        durationMs,
      } as any);

      await plugin.patch({ lastSyncAt: Date.now() });

      return { success: true, message: `Synced ${syncedCount} ${args.table}` };
    } catch (err: any) {
      await ctx.table('pluginSyncLog').insert({
        externalPluginId: plugin._id,
        organizationId: orgId,
        direction: 'pull',
        table: args.table,
        status: 'failed',
        recordCount: 0,
        errorMessage: err.message ?? 'Unknown error',
        durationMs: Date.now() - startTime,
      } as any);

      return { success: false, message: `Sync failed: ${err.message}` };
    }
  },
});
```

**Important:** The `ownerId` field uses `plugin.ownerId` — but the current schema might not have this field. Check if `externalPlugins` schema has `ownerId`. If not, you'll need to look it up from the organization or skip it. Verify with:

```bash
grep -A 30 "externalPlugins:" convex/schema.ts | grep ownerId
```

If no `ownerId`, use the first admin of the organization or store `ownerId` in the plugin at registration time.

**Step 2: Refactor `triggerSync` to call `syncPluginTable`**

Replace the body of `triggerSync` to delegate to the new internal mutation:

```ts
export const triggerSync = createOrgMutation({})({
  args: {
    id: z.string(),
    table: v.enum(['products', 'orders', 'customers']),
  },
  returns: v.object({ success: z.boolean(), message: z.string() }),
  handler: async (ctx, args) => {
    const plugin = await ctx
      .table('externalPlugins')
      .get(args.id as any);
    if (!plugin || plugin.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'External plugin tidak ditemukan',
      });
    }
    if (plugin.status !== 'connected') {
      throw new ConvexError({
        code: 'BAD_REQUEST',
        message: 'Plugin belum terhubung. Verifikasi koneksi terlebih dahulu.',
      });
    }

    return await ctx.runMutation(internal.externalPlugins.syncPluginTable, {
      pluginId: args.id,
      table: args.table,
    });
  },
});
```

This keeps the auth/permission check in `triggerSync` but delegates actual sync work to the internal mutation.

**Step 3: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -10`
Expected: 0 errors

**Step 4: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "refactor(plugins): extract syncPluginTable internal mutation for reuse in cron"
```

---

### Task 2: Add `listConnectedInternal` Query for Cron

**Files:**
- Modify: `convex/externalPlugins.ts`

**Why:** Cron needs to find all connected plugins across all orgs. Current `list` query is org-scoped (requires auth).

**Step 1: Add internal query**

After the existing `getInternal` query (around line 110):

```ts
/** Internal: list all connected external plugins (for cron). */
export const listConnectedInternal = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      organizationId: v.string(),
    })
  ),
  handler: async (ctx) => {
    const plugins = await ctx
      .table('externalPlugins', 'organizationId_status', (q) =>
        q.eq('status', 'connected')
      );

    // Note: organizationId_status index only matches on status prefix.
    // We need to iterate across all orgs. Use a different approach:
    // Query all plugins and filter.
    const all = await ctx.table('externalPlugins').list()();
    return all
      .filter((p: any) => p.status === 'connected')
      .map((p: any) => ({
        id: p._id as any as string,
        organizationId: p.organizationId,
      }));
  },
});
```

**Important:** Convex ent framework may not support cross-org queries with a compound index. If `listConnectedInternal` can't iterate all orgs, use the raw `ctx.db.query('externalPlugins').collect()` and filter in JS. Verify by checking:

```bash
grep -n "organizationId_status" convex/schema.ts
```

If the index is `['organizationId', 'status']`, it requires `organizationId` first. Use `ctx.db.query('externalPlugins').filter(...)` instead.

**Step 2: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -10`

**Step 3: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "feat(plugins): add listConnectedInternal query for cron job"
```

---

### Task 3: Add `syncAllConnected` Internal Action

**Files:**
- Modify: `convex/externalPlugins.ts`

**Why:** Cron calls this. It iterates all connected plugins, syncs each table, isolates errors per plugin.

**Step 1: Import `internalAction`**

Add to the existing imports at top:

```ts
import { internalQuery, internalMutation, internalAction } from './_generated/server';
```

**Step 2: Add the action**

Add after `syncPluginTable`:

```ts
/** Cron: sync all connected plugins (all tables). Error-isolated per plugin. */
export const syncAllConnected = internalAction({
  args: {},
  returns: v.object({
    synced: v.number(),
    failed: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    const plugins = await ctx.runQuery(
      internal.externalPlugins.listConnectedInternal,
      {}
    );

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    const tables = ['products', 'orders', 'customers'] as const;

    for (const plugin of plugins) {
      for (const table of tables) {
        try {
          const result = await ctx.runMutation(
            internal.externalPlugins.syncPluginTable,
            { pluginId: plugin.id, table }
          );
          if (result.success) {
            synced++;
          } else {
            skipped++; // e.g. rate limited
          }
        } catch (err: any) {
          console.error(
            `Cron sync failed: plugin=${plugin.id} table=${table}`,
            err.message
          );
          failed++;
        }
      }
    }

    console.log(
      `Cron sync complete: ${synced} synced, ${failed} failed, ${skipped} skipped`
    );

    return { synced, failed, skipped };
  },
});
```

**Step 3: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -10`

**Step 4: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "feat(plugins): add syncAllConnected internal action for cron"
```

---

### Task 4: Register Cron Job in `convex/crons.ts`

**Files:**
- Modify: `convex/crons.ts`

**Step 1: Add import and cron entry**

```ts
// Add to imports:
import { internal } from './_generated/api';

// Already exists — add the new cron after the existing ones:

// Hourly — sync all connected external plugins
crons.interval(
  'sync-external-plugins',
  { minutes: 60 },
  internal.externalPlugins.syncAllConnected,
  {}
);
```

**Step 2: Verify cron registration**

Run: `npx convex cron 2>&1 | head -20`

Or verify by deploying and checking Convex dashboard.

**Step 3: Commit**

```bash
git add convex/crons.ts
git commit -m "feat(plugins): register hourly cron for external plugin sync"
```

---

### Task 5: Verification — Typecheck + Tests

**Files:**
- No new files

**Step 1: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -10`
Expected: 0 errors

**Step 2: Run tests**

Run: `npx convex test 2>&1 | tail -20`
Expected: All tests pass (220+)

**Step 3: Verify cron shows up**

Check that `convex/crons.ts` has 3 entries:
1. `weekly-pipeline-digest` (existing)
2. `process-recurring-invoices` (existing)
3. `sync-external-plugins` (new)

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(plugins): cron sync verification fixes"
```

---

## File Summary

| Action | File | Purpose |
|--------|------|---------|
| Modify | `convex/externalPlugins.ts` | Add `syncPluginTable`, `listConnectedInternal`, `syncAllConnected`, refactor `triggerSync` |
| Modify | `convex/crons.ts` | Register hourly cron |

## Key Decisions
- **Error isolation:** One plugin failure doesn't stop others — try/catch per plugin per table
- **Rate limit respected:** `syncPluginTable` checks 5-minute cooldown, same as manual trigger
- **Sequential sync:** Not parallel — avoids overwhelming external plugin APIs
- **Cron interval:** 60 minutes — configurable in crons.ts
- **Auth separation:** Cron uses internal actions/mutations without user context

## Risks & Mitigations
- **Many plugins = slow cron:** Sequential processing. If >10 plugins, consider batching or staggering
- **External API downtime:** Caught per-plugin, logged to `pluginSyncLog`, doesn't affect others
- **ownerId field:** If `externalPlugins` schema lacks `ownerId`, need fallback (org admin or stored at registration)
