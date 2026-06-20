# External Plugin Phase 2 — Code Review Fixes (15 Issues)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 15 code review issues (P0×3, P1×4, P2×5, P3×3) found in the External Plugin Phase 2 implementation.

**Architecture:** The external plugin system connects third-party stores to CRM via API key auth, HMAC-signed webhooks, and pull-based sync. Current code has critical issues: non-existent schema fields in sync, no webhook auth, SSRF risk, duplicate inserts, and API key exposure.

**Tech Stack:** Convex (convex-ents), Next.js App Router, TypeScript, Zod

---

## Overview Perubahan

```
P0 — MUST FIX (runtime crash / security):
  Task 1: Add external sync fields to products/saleOrders/contacts schema
  Task 2: Fix sync upsert logic — map to actual schema fields + dedup
  Task 3: Implement HMAC webhook verification + auth in processWebhook
  Task 4: Add SSRF protection for external URL validation

P1 — SHOULD FIX (security / data integrity):
  Task 5: Remove API key from get query — only expose on register/regenerate
  Task 6: Add sync rate limiting + prevent concurrent syncs
  Task 7: Clean up unused imports

P2 — NICE TO FIX (maintainability / UX):
  Task 8: Split externalPlugins.ts into focused modules
  Task 9: Hash API keys before storing
  Task 10: Fix connect dialog URL validation
  Task 11: Fix external-plugin-card copy API key UX
  Task 12: Add lastSyncAt rendering in ExternalPluginCard

P3 — OPTIONAL:
  Task 13: Use z.literal union for status fields in schema
  Task 14: Fix duplicate URL check across orgs
  Task 15: Extract IIFE to component in plugins settings page
```

---

### Task 1: Schema — Add External Sync Fields

**Files:**
- Modify: `convex/schema.ts` (products, saleOrders, contacts tables)

**Step 1: Add fields to products table**

In `convex/schema.ts`, after the `images` field inside `products` defineEnt, add:

```typescript
      // External plugin sync fields
      externalId: v.optional(v.string()),           // ID in external system
      externalPluginId: v.optional(v.id('externalPlugins')), // source plugin
```

Also add an index for dedup:
```typescript
      .index('organizationId_externalId', ['organizationId', 'externalId'])
```

**Step 2: Add fields to saleOrders table**

Inside `saleOrders` defineEnt, after `archivedAt`, add:

```typescript
      // External plugin sync fields
      externalId: v.optional(v.string()),
      externalPluginId: v.optional(v.id('externalPlugins')),
```

Also add index:
```typescript
      .index('organizationId_externalId', ['organizationId', 'externalId'])
```

**Step 3: Add fields to contacts table**

Inside `contacts` defineEnt, after `lastActivityAt`, add:

```typescript
      // External plugin sync fields
      externalId: v.optional(v.string()),
      externalPluginId: v.optional(v.id('externalPlugins')),
```

Also add index:
```typescript
      .index('organizationId_externalId', ['organizationId', 'externalId'])
```

**Step 4: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm/convex && npx tsc --noEmit`
Expected: No NEW errors (pre-existing convex-ents type issues OK)

**Step 5: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add externalId + externalPluginId to products, saleOrders, contacts"
```

---

### Task 2: Fix Sync Logic — Map to Actual Schema + Upsert Dedup

**Files:**
- Modify: `convex/externalPlugins.ts` (triggerSync handler)

**Step 1: Rewrite products sync mapping**

Replace the `args.table === 'products'` block in `triggerSync`:

```typescript
      if (args.table === 'products') {
        for (const item of data) {
          // Dedup: check if product already synced
          const existing = await ctx
            .table('products', 'organizationId_externalId', (q) =>
              q.eq('organizationId', ctx.orgId).eq('externalId', item.id as string)
            )
            .first();

          const productData = {
            name: item.name ?? 'Unnamed Product',
            description: item.description,
            type: 'storable' as const,
            price: item.price,
            imageUrl: item.imageUrl,
            stock: item.stock,
            slug: item.slug,
            visibleInShop: true,
            externalId: item.id as string,
            externalPluginId: plugin._id,
          };

          if (existing) {
            await existing.patch(productData);
          } else {
            await ctx.table('products').insert({
              organizationId: ctx.orgId,
              ownerId: ctx.user!._id,
              ...productData,
            } as any);
          }
          syncedCount++;
        }
```

**Step 2: Rewrite orders sync mapping**

Replace `args.table === 'orders'` block. Note: `saleOrders` requires `number`, `state`, `orderDate`, `subtotal`, `totalAmount`, `ownerId`:

```typescript
      } else if (args.table === 'orders') {
        for (const item of data) {
          const existing = await ctx
            .table('saleOrders', 'organizationId_externalId', (q) =>
              q.eq('organizationId', ctx.orgId).eq('externalId', item.id as string)
            )
            .first();

          const orderData = {
            number: item.orderNumber ?? item.id ?? `EXT-${Date.now()}`,
            state: (item.status === 'completed' ? 'done' :
                    item.status === 'cancelled' ? 'cancel' : 'confirmed') as any,
            orderDate: item.createdAt ?? Date.now(),
            subtotal: item.subtotal ?? item.totalAmount ?? 0,
            totalAmount: item.totalAmount ?? item.total ?? 0,
            customerNotes: item.notes,
            source: 'manual' as const,
            externalId: item.id as string,
            externalPluginId: plugin._id,
          };

          if (existing) {
            await existing.patch(orderData);
          } else {
            await ctx.table('saleOrders').insert({
              organizationId: ctx.orgId,
              ownerId: ctx.user!._id,
              ...orderData,
            } as any);
          }
          syncedCount++;
        }
```

**Step 3: Rewrite customers sync mapping**

Replace `args.table === 'customers'` block. Note: `contacts` requires `fullName`, `email`:

```typescript
      } else if (args.table === 'customers') {
        for (const item of data) {
          const existing = await ctx
            .table('contacts', 'organizationId_externalId', (q) =>
              q.eq('organizationId', ctx.orgId).eq('externalId', item.id as string)
            )
            .first();

          const contactData = {
            fullName: item.name ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || 'Unknown',
            email: item.email ?? '',
            phone: item.phone,
            lifecycleStage: 'customer' as const,
            externalId: item.id as string,
            externalPluginId: plugin._id,
          };

          if (existing) {
            await existing.patch(contactData);
          } else {
            await ctx.table('contacts').insert({
              organizationId: ctx.orgId,
              ownerId: ctx.user!._id,
              ...contactData,
            } as any);
          }
          syncedCount++;
        }
```

**Step 4: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm/convex && npx tsc --noEmit`
Expected: No NEW errors

**Step 5: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "fix(sync): map external data to actual schema fields + upsert dedup"
```

---

### Task 3: HMAC Webhook Verification + processWebhook Auth

**Files:**
- Modify: `convex/http.ts` (webhook handler)
- Modify: `convex/externalPlugins.ts` (processWebhook)
- Create: `convex/helpers/validateWebhook.ts`

**Step 1: Create webhook validation helper**

Create `convex/helpers/validateWebhook.ts`:

```typescript
/**
 * Verify HMAC-SHA256 webhook signature.
 * External plugins must sign payloads with their API key.
 *
 * Header: X-CRM-Signature: sha256=<hex>
 * Signing: HMAC-SHA256(apiKey, JSON.stringify(body))
 */
export async function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null,
  apiKey: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const match = signatureHeader.match(/^sha256=([a-f0-9]{64})$/);
  if (!match) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const sigBytes = Uint8Array.from(
    match[1].match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    encoder.encode(body),
  );
}
```

**Step 2: Update webhook HTTP handler to use HMAC + route to internal mutation**

In `convex/http.ts`, replace the webhook handler. Import the helper and `internalMutation`. The handler should:
1. Read raw body as text (for signature verification)
2. Parse JSON
3. Look up external plugin by ID from body
4. Verify HMAC signature
5. Call `processWebhook` via internal mutation

```typescript
import { httpAction, internalAction, internalMutation } from './_generated/server';
import { api, internal } from './_generated/api';
import { verifyWebhookSignature } from './helpers/validateWebhook';

// ... existing routes ...

// External plugin webhook receiver
http.route({
  path: '/webhooks/plugin',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const rawBody = await request.text();
      const signature = request.headers.get('X-CRM-Signature');

      let body: any;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { event, orgId, data, pluginId, idempotencyKey } = body as {
        event?: string;
        orgId?: string;
        data?: any;
        pluginId?: string;
        idempotencyKey?: string;
      };

      if (!event || !orgId || !data || !pluginId) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: event, orgId, data, pluginId' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verify HMAC signature
      const isValid = await verifyWebhookSignature(rawBody, signature, pluginId);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Process via internal mutation (bypasses user auth — already verified via HMAC)
      await ctx.runMutation(internal.externalPlugins.processWebhook, {
        event,
        orgId,
        data,
        idempotencyKey,
      });

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      console.error('Webhook error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }),
});
```

**Step 3: Convert processWebhook to internalMutation**

In `convex/externalPlugins.ts`, change `processWebhook` from `createOrgMutation` to `internalMutation`. This ensures it's only callable from the HTTP handler (not by users).

```typescript
import { internalMutation } from './_generated/server';

export const processWebhook = internalMutation({
  args: {
    event: z.string(),
    orgId: z.string(),
    data: z.any(),
    idempotencyKey: z.string().optional(),
  },
  handler: async (ctx, args) => {
    // ... existing switch logic, unchanged ...
  },
});
```

Remove `returns: z.object({ received: z.boolean() })` from internal mutation (not needed).

**Step 4: Run typecheck**

Run: `cd /Users/madearga/Desktop/crm/convex && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add convex/helpers/validateWebhook.ts convex/http.ts convex/externalPlugins.ts
git commit -m "fix(security): HMAC webhook verification + internal-only processWebhook"
```

---

### Task 4: SSRF Protection — Validate External URLs

**Files:**
- Create: `convex/helpers/validateExternalUrl.ts`
- Modify: `convex/externalPlugins.ts` (register, verify, triggerSync)

**Step 1: Create URL validation helper**

Create `convex/helpers/validateExternalUrl.ts`:

```typescript
/**
 * Validate external plugin URL to prevent SSRF.
 * - Must be HTTPS (or http://localhost for dev)
 * - Must not be a private/internal IP
 * - Must not be a link-local or loopback address (except localhost dev)
 */
const BLOCKED_HOSTS = [
  '169.254.169.254',  // AWS metadata
  'metadata.google.internal', // GCP metadata
  '100.100.100.200',  // Alibaba Cloud metadata
];

const PRIVATE_IP_RANGES = [
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16
  /^127\./,                   // 127.0.0.0/8 (loopback)
  /^0\./,                     // 0.0.0.0/8
  /^fc00:/i,                  // IPv6 ULA
  /^fe80:/i,                  // IPv6 link-local
  /^::1$/i,                   // IPv6 loopback
];

export function validateExternalUrl(urlStr: string): { valid: boolean; error?: string } {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { valid: false, error: 'URL tidak valid' };
  }

  // Must be HTTPS (allow HTTP for localhost development)
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !isLocalhost) {
    return { valid: false, error: 'URL harus menggunakan HTTPS' };
  }

  // Block known metadata endpoints
  if (BLOCKED_HOSTS.includes(url.hostname)) {
    return { valid: false, error: 'URL tidak diizinkan' };
  }

  // Block private IPs (skip localhost in dev)
  if (!isLocalhost) {
    for (const range of PRIVATE_IP_RANGES) {
      if (range.test(url.hostname)) {
        return { valid: false, error: 'Private/internal IP tidak diizinkan' };
      }
    }
  }

  return { valid: true };
}
```

**Step 2: Use in `register` mutation**

In `externalPlugins.ts`, import and use at the start of `register` handler:

```typescript
import { validateExternalUrl } from './helpers/validateExternalUrl';

// Inside register handler, before the duplicate URL check:
const urlValidation = validateExternalUrl(args.url);
if (!urlValidation.valid) {
  throw new ConvexError({ code: 'BAD_REQUEST', message: urlValidation.error });
}
```

**Step 3: Commit**

```bash
git add convex/helpers/validateExternalUrl.ts convex/externalPlugins.ts
git commit -m "fix(security): SSRF protection — validate external plugin URLs"
```

---

### Task 5: Remove API Key from `get` Query

**Files:**
- Modify: `convex/externalPlugins.ts` (get query)

**Step 1: Remove apiKey from get query return type and handler**

In the `get` query, remove `apiKey: z.string()` from returns schema, and remove `apiKey: plugin.apiKey` from the return object.

The `list` query already doesn't return apiKey — good. Keep it that way.

**Step 2: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "fix(security): remove apiKey from get query — only expose on register/regenerate"
```

---

### Task 6: Sync Rate Limiting + Prevent Concurrent Syncs

**Files:**
- Modify: `convex/externalPlugins.ts` (triggerSync)

**Step 1: Add sync cooldown check at start of triggerSync**

After the status check, add:

```typescript
    // Prevent concurrent/recent sync (5 min cooldown)
    if (plugin.lastSyncAt && Date.now() - plugin.lastSyncAt < 5 * 60 * 1000) {
      throw new ConvexError({
        code: 'RATE_LIMITED',
        message: 'Sync terlalu sering. Tunggu beberapa menit.',
      });
    }
```

**Step 2: Add max records limit**

After `const data = result.data ?? [];`, add:

```typescript
      const MAX_RECORDS = 200;
      const data = (result.data ?? []).slice(0, MAX_RECORDS);
```

**Step 3: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "fix(sync): add rate limiting + max records cap"
```

---

### Task 7: Clean Unused Imports

**Files:**
- Modify: `convex/externalPlugins.ts`

**Step 1: Remove unused imports**

Remove these two lines from the top:
```typescript
import { internalAction } from './_generated/server';
import { api } from './_generated/api';
```

Add the needed import:
```typescript
import { internalMutation } from './_generated/server';
```

**Step 2: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "chore: remove unused imports in externalPlugins.ts"
```

---

### Task 8: Split externalPlugins.ts into Modules (SRP)

**Files:**
- Create: `convex/externalPlugins/queries.ts`
- Create: `convex/externalPlugins/mutations.ts`
- Create: `convex/externalPlugins/sync.ts`
- Create: `convex/externalPlugins/webhooks.ts`
- Delete: `convex/externalPlugins.ts`

**Step 1: Create queries.ts**

Move `list`, `get`, `getSyncLogs` to `convex/externalPlugins/queries.ts`. Add shared imports.

**Step 2: Create mutations.ts**

Move `register`, `verify`, `update`, `unregister`, `regenerateApiKey` to `convex/externalPlugins/mutations.ts`.

**Step 3: Create sync.ts**

Move `triggerSync` to `convex/externalPlugins/sync.ts`.

**Step 4: Create webhooks.ts**

Move `processWebhook` to `convex/externalPlugins/webhooks.ts`.

**Step 5: Update http.ts import**

Change any references from `api.externalPlugins.*` — Convex auto-discovers files in the module directory, so `api.externalPlugins.queries.list`, `api.externalPlugins.mutations.register`, etc.

Wait — Convex uses the file path as the API path. Moving to a directory changes the API reference. **This is a breaking change for the frontend.** Instead, keep the same file name and split functions internally, or use the `convex/externalPlugins/` directory with a barrel file.

**IMPORTANT:** Convex discovers functions by file path. `convex/externalPlugins.ts` → `api.externalPlugins.list`. `convex/externalPlugins/queries.ts` → `api.externalPlugins.queries.list`. This would break ALL frontend references.

**Better approach:** Keep `convex/externalPlugins.ts` as the main file but extract helpers:
- Move `generateApiKey` to `convex/externalPlugins/helpers.ts`
- Move sync data mapping logic to `convex/externalPlugins/sync-mappers.ts`
- Keep all exported query/mutation functions in `externalPlugins.ts` (Convex requires this)

This reduces the file without breaking API paths.

**Step 6: Commit**

```bash
git add convex/externalPlugins.ts convex/externalPlugins/
git commit -m "refactor: extract sync mappers from externalPlugins.ts"
```

---

### Task 9: Hash API Keys Before Storing

**Files:**
- Modify: `convex/externalPlugins.ts` (register, verify, regenerateApiKey)
- Create: `convex/helpers/hashApiKey.ts`

**Step 1: Create hash helper**

`convex/helpers/hashApiKey.ts`:

```typescript
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Step 2: Update register to store hash, return plaintext**

In `register`: store `await hashApiKey(apiKey)` in DB, return original `apiKey`.

**Step 3: Update verify/triggerSync to compare hashed key**

When calling external APIs, we need the plaintext key — but we only have the hash. **Problem:** If we hash, we can't use the key for outbound calls (verify, sync).

**Decision:** Keep plaintext for now (API keys are only visible to org admins via regenerate). Mark as future improvement with env encryption. **Skip this task** — it conflicts with the outbound fetch requirement.

---

### Task 10: URL Validation in Connect Dialog

**Files:**
- Modify: `apps/web/src/components/external-plugin/connect-plugin-dialog.tsx`

**Step 1: Add URL validation in handleRegister**

Before the `if (!url.trim())` check, add:

```typescript
    // Validate URL format
    try {
      const parsed = new URL(url.trim());
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        toast.error('URL harus dimulai dengan http:// atau https://');
        return;
      }
    } catch {
      toast.error('Format URL tidak valid');
      return;
    }
```

**Step 2: Commit**

```bash
git add apps/web/src/components/external-plugin/connect-plugin-dialog.tsx
git commit -m "fix: add URL validation in connect plugin dialog"
```

---

### Task 11: Fix Copy API Key UX in ExternalPluginCard

**Files:**
- Modify: `apps/web/src/components/external-plugin/external-plugin-card.tsx`

**Step 1: Remove misleading copy button, keep only regenerate**

Replace the API key section:

```tsx
        {/* API Key */}
        <div>
          <p className="mb-2 text-sm font-medium">API Key</p>
          <div className="flex gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs">
              ••••••••••••••••••••
            </code>
            <Button size="sm" variant="outline" onClick={handleRegenerateKey}>
              Regenerate Key
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Key hanya terlihat saat pertama dibuat atau di-regenerate.
          </p>
        </div>
```

Remove the `handleCopyApiKey` function and `copied` state.

**Step 2: Commit**

```bash
git add apps/web/src/components/external-plugin/external-plugin-card.tsx
git commit -m "fix: remove misleading copy button for masked API key"
```

---

### Task 12: Render lastSyncAt Timestamp

**Files:**
- Modify: `apps/web/src/components/external-plugin/external-plugin-card.tsx`

**Step 1: Already rendered but improve formatting**

The existing code has:
```tsx
{plugin.lastSyncAt && (
  <p className="text-xs text-muted-foreground">
    Terakhir sync: {new Date(plugin.lastSyncAt).toLocaleString('id-ID')}
  </p>
)}
```

This is already present. No change needed. ✅

---

### Task 13: Use Literal Unions for Status in Schema

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Change status fields to unions**

In `externalPlugins` table:
```typescript
// Before:
status: v.string(),                       // 'connected' | 'disconnected' | 'error'

// After:
status: v.union(
  v.literal('connected'),
  v.literal('disconnected'),
  v.literal('error'),
),
```

In `pluginSyncLog` table:
```typescript
// Before:
direction: v.string(),                   // 'pull' | 'push'
status: v.string(),                      // 'success' | 'partial' | 'failed'

// After:
direction: v.union(v.literal('pull'), v.literal('push')),
status: v.union(v.literal('success'), v.literal('partial'), v.literal('failed')),
```

**Step 2: Update TypeScript types in externalPlugins.ts**

Update the `statusConfig` in `external-plugin-card.tsx` to match the literal types.

**Step 3: Commit**

```bash
git add convex/schema.ts convex/externalPlugins.ts
git commit -m "feat(schema): use literal unions for external plugin status fields"
```

---

### Task 14: Fix Duplicate URL Check Across Orgs

**Files:**
- Modify: `convex/externalPlugins.ts` (register handler)

**Step 1: Block ALL duplicate URLs, not just same-org**

Change:
```typescript
    // Before:
    if (existing && existing.organizationId === ctx.orgId) {

    // After:
    if (existing) {
```

Remove the orgId check — same URL shouldn't be registered twice even by different orgs.

**Step 2: Commit**

```bash
git add convex/externalPlugins.ts
git commit -m "fix: block duplicate external plugin URLs across all orgs"
```

---

### Task 15: Extract IIFE to Component

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/plugins/page.tsx`

**Step 1: Extract ConnectExternalPluginButton component**

Before `PluginsSettingsPage`, add:

```tsx
function ConnectExternalPluginButton({
  instanceMap,
  onConnected,
}: {
  instanceMap: Map<string, PluginInstance>;
  onConnected: () => void;
}) {
  const ecommerceInstance = instanceMap.get('ecommerce');
  if (!ecommerceInstance?.isActive) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Plus className="mr-2 size-4" />
        Aktifkan Ecommerce dulu
      </Button>
    );
  }
  return (
    <ConnectPluginDialog
      pluginInstanceId={ecommerceInstance.id}
      pluginName="Toko Online"
      onConnected={onConnected}
    >
      <Button size="sm">
        <Plus className="mr-2 size-4" />
        Hubungkan Toko
      </Button>
    </ConnectPluginDialog>
  );
}
```

Replace the IIFE in JSX with:
```tsx
<ConnectExternalPluginButton instanceMap={instanceMap} onConnected={handleConnected} />
```

**Step 2: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/settings/plugins/page.tsx
git commit -m "refactor: extract ConnectExternalPluginButton from IIFE"
```

---

## Execution Order

Tasks should be executed in this order to minimize conflicts:

1. **Task 1** (schema) — foundation for Task 2
2. **Task 7** (clean imports) — clean slate before big changes
3. **Task 13** (schema unions) — schema changes together
4. **Task 2** (sync mapping) — depends on Task 1 schema
5. **Task 3** (HMAC webhook) — security critical
6. **Task 4** (SSRF protection) — security critical
7. **Task 5** (hide API key) — security
8. **Task 6** (rate limiting) — depends on Task 2
9. **Task 10** (URL validation frontend)
10. **Task 11** (copy button UX)
11. **Task 14** (URL dedup)
12. **Task 15** (extract component)
13. **Task 8** (split module) — optional, skip if risky
14. **Task 9** (hash API keys) — **SKIP** (conflicts with outbound fetch)

**Skipped tasks:**
- Task 9 (hash API keys) — would break outbound API calls
- Task 12 (render lastSyncAt) — already works
- Task 8 (split module) — risky Convex API path change, defer

**Total: 12 executable tasks, ~2 skipped**
