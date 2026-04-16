import { z } from 'zod';
import { ConvexError } from 'convex/values';
import { createOrgQuery, createOrgMutation } from './functions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    'cp_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all external plugins for current org. */
export const list = createOrgQuery()({
  args: {},
  returns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
      status: z.string(),
      lastSyncAt: z.number().optional(),
      lastError: z.string().optional(),
      pluginInstanceId: z.string(),
      manifest: z.any().optional(),
    })
  ),
  handler: async (ctx, _args) => {
    const plugins = await ctx
      .table('externalPlugins', 'organizationId', (q) =>
        q.eq('organizationId', ctx.orgId)
      );

    return plugins.map((p) => ({
      id: p._id,
      name: p.name,
      url: p.url,
      status: p.status,
      lastSyncAt: p.lastSyncAt ?? undefined,
      lastError: p.lastError ?? undefined,
      pluginInstanceId: p.pluginInstanceId,
      manifest: p.manifest ?? undefined,
    }));
  },
});

/** Get single external plugin by ID. */
export const get = createOrgQuery()({
  args: { id: z.string() },
  returns: z
    .object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
      apiKey: z.string(),
      status: z.string(),
      lastSyncAt: z.number().optional(),
      lastError: z.string().optional(),
      pluginInstanceId: z.string(),
      manifest: z.any().optional(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    const plugin = await ctx.table('externalPlugins').get(args.id as any);
    if (!plugin || plugin.organizationId !== ctx.orgId) return null;
    return {
      id: plugin._id,
      name: plugin.name,
      url: plugin.url,
      apiKey: plugin.apiKey,
      status: plugin.status,
      lastSyncAt: plugin.lastSyncAt ?? undefined,
      lastError: plugin.lastError ?? undefined,
      pluginInstanceId: plugin.pluginInstanceId,
      manifest: plugin.manifest ?? undefined,
    };
  },
});

/** Get sync logs for an external plugin. */
export const getSyncLogs = createOrgQuery()({
  args: {
    externalPluginId: z.string(),
    paginationOpts: z.any(),
  },
  returns: z.object({
    page: z.array(
      z.object({
        id: z.string(),
        direction: z.string(),
        table: z.string(),
        status: z.string(),
        recordCount: z.number(),
        errorMessage: z.string().optional(),
        durationMs: z.number().optional(),
        createdAt: z.number(),
      })
    ),
    continuationCursor: z.string().nullable(),
    isDone: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const logs = await ctx
      .table('pluginSyncLog', 'externalPluginId_organizationId', (q) =>
        q
          .eq('externalPluginId', args.externalPluginId as any)
          .eq('organizationId', ctx.orgId)
      )
      .paginate(args.paginationOpts);

    return {
      page: logs.page.map((log) => ({
        id: log._id,
        direction: log.direction,
        table: log.table,
        status: log.status,
        recordCount: log.recordCount,
        errorMessage: log.errorMessage ?? undefined,
        durationMs: log.durationMs ?? undefined,
        createdAt: log._creationTime,
      })),
      continuationCursor: logs.continueCursor,
      isDone: logs.isDone,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Register a new external plugin — generates API key. */
export const register = createOrgMutation({})({
  args: {
    name: z.string().min(1).max(100),
    url: z.string().url(),
    pluginInstanceId: z.string(),
  },
  returns: z.object({
    id: z.string(),
    apiKey: z.string(),
  }),
  handler: async (ctx, args) => {
    // Verify plugin instance belongs to this org
    const instance = await ctx
      .table('pluginInstances')
      .get(args.pluginInstanceId as any);
    if (!instance || instance.organizationId !== ctx.orgId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Plugin instance tidak ditemukan',
      });
    }

    // Check for duplicate URL
    const existing = await ctx
      .table('externalPlugins', 'url', (q) => q.eq('url', args.url))
      .first();
    if (existing && existing.organizationId === ctx.orgId) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'Plugin dengan URL ini sudah terdaftar',
      });
    }

    const apiKey = generateApiKey();

    const id = await ctx.table('externalPlugins').insert({
      organizationId: ctx.orgId,
      pluginInstanceId: args.pluginInstanceId as any,
      name: args.name,
      url: args.url.replace(/\/$/, ''), // strip trailing slash
      apiKey,
      status: 'disconnected', // will become 'connected' after verification
    } as any);

    return { id, apiKey };
  },
});

/** Verify external plugin connection — calls /api/plugin/manifest. */
export const verify = createOrgMutation({})({
  args: { id: z.string() },
  returns: z.object({
    success: z.boolean(),
    manifest: z.any().optional(),
    error: z.string().optional(),
  }),
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

    try {
      const response = await fetch(`${plugin.url}/api/plugin/manifest`, {
        headers: { Authorization: `Bearer ${plugin.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        await plugin.patch({
          status: 'error',
          lastError: `Manifest endpoint returned ${response.status}`,
        });
        return {
          success: false,
          error: `Endpoint returned status ${response.status}`,
        };
      }

      const manifest = await response.json();

      // Cache manifest and mark connected
      await plugin.patch({
        status: 'connected',
        lastError: undefined,
        manifest,
      });

      return { success: true, manifest };
    } catch (err: any) {
      await plugin.patch({
        status: 'error',
        lastError: err.message ?? 'Connection failed',
      });
      return { success: false, error: err.message ?? 'Connection failed' };
    }
  },
});

/** Update external plugin settings. */
export const update = createOrgMutation({})({
  args: {
    id: z.string(),
    name: z.string().optional(),
    url: z.string().optional(),
  },
  returns: z.object({ success: z.boolean() }),
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

    await plugin.patch({
      ...(args.name && { name: args.name }),
      ...(args.url && { url: args.url.replace(/\/$/, '') }),
    });

    return { success: true };
  },
});

/** Unregister external plugin. */
export const unregister = createOrgMutation({})({
  args: { id: z.string() },
  returns: z.object({ success: z.boolean() }),
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

    await plugin.delete();
    return { success: true };
  },
});

/** Regenerate API key. */
export const regenerateApiKey = createOrgMutation({})({
  args: { id: z.string() },
  returns: z.object({ apiKey: z.string() }),
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

    const apiKey = generateApiKey();
    await plugin.patch({ apiKey });
    return { apiKey };
  },
});

/** Trigger manual sync (pull data from external plugin). */
export const triggerSync = createOrgMutation({})({
  args: {
    id: z.string(),
    table: z.enum(['products', 'orders', 'customers']),
  },
  returns: z.object({ success: z.boolean(), message: z.string() }),
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

    // Schedule the sync action
    const startTime = Date.now();

    try {
      const response = await fetch(
        `${plugin.url}/api/plugin/data?table=${args.table}&limit=100`,
        {
          headers: { Authorization: `Bearer ${plugin.apiKey}` },
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data ?? [];
      const durationMs = Date.now() - startTime;

      // Upsert data based on table type
      let syncedCount = 0;
      if (args.table === 'products') {
        for (const item of data) {
          const existing = await ctx
            .table('products', 'organizationId_externalId', (q) =>
              q.eq('organizationId', ctx.orgId).eq('externalId', String(item.id))
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
            organizationId: ctx.orgId,
            ownerId: ctx.userId as any,
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
              q.eq('organizationId', ctx.orgId).eq('externalId', String(item.id))
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
            organizationId: ctx.orgId,
            ownerId: ctx.userId as any,
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
              q.eq('organizationId', ctx.orgId).eq('externalId', String(item.id))
            )
            .first();
          const fields = {
            fullName: item.name ?? item.fullName ?? 'Unknown',
            email: item.email ?? '',
            phone: item.phone,
            lifecycleStage: 'customer' as const,
            externalId: String(item.id),
            externalPluginId: plugin._id,
            organizationId: ctx.orgId,
            ownerId: ctx.userId as any,
          };
          if (existing) {
            await existing.patch(fields);
          } else {
            await ctx.table('contacts').insert(fields as any);
          }
          syncedCount++;
        }
      }

      // Log sync
      await ctx.table('pluginSyncLog').insert({
        externalPluginId: plugin._id,
        organizationId: ctx.orgId,
        direction: 'pull',
        table: args.table,
        status: 'success',
        recordCount: syncedCount,
        durationMs,
      } as any);

      // Update last sync time
      await plugin.patch({ lastSyncAt: Date.now() });

      return {
        success: true,
        message: `Synced ${syncedCount} ${args.table}`,
      };
    } catch (err: any) {
      // Log failed sync
      await ctx.table('pluginSyncLog').insert({
        externalPluginId: plugin._id,
        organizationId: ctx.orgId,
        direction: 'pull',
        table: args.table,
        status: 'failed',
        recordCount: 0,
        errorMessage: err.message ?? 'Unknown error',
        durationMs: Date.now() - startTime,
      } as any);

      return {
        success: false,
        message: `Sync failed: ${err.message}`,
      };
    }
  },
});

// ---------------------------------------------------------------------------
// Webhook handler — receives events from external plugins
// ---------------------------------------------------------------------------

/** Process incoming webhook event from external plugin. */
export const processWebhook = createOrgMutation({})({
  args: {
    event: z.string(),
    orgId: z.string(),
    data: z.any(),
    idempotencyKey: z.string().optional(),
  },
  returns: z.object({ received: z.boolean() }),
  handler: async (ctx, args) => {
    // Route event to handler
    switch (args.event) {
      case 'order.created': {
        // Create sale order from external data
        const orderData = args.data;
        await ctx.table('saleOrders').insert({
          organizationId: args.orgId as any,
          orderNumber: orderData.orderNumber ?? orderData.id,
          status: 'pending',
          totalAmount: orderData.totalAmount ?? 0,
          notes: `Synced from external plugin. Order ID: ${orderData.id}`,
          externalId: orderData.id,
        } as any);
        break;
      }
      case 'order.updated': {
        // TODO: Find and update existing sale order
        break;
      }
      case 'payment.received': {
        // TODO: Update payment status
        break;
      }
      case 'customer.created': {
        const customerData = args.data;
        await ctx.table('contacts').insert({
          organizationId: args.orgId as any,
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          notes: 'Synced from external plugin',
          externalId: customerData.id,
        } as any);
        break;
      }
      default:
        console.warn(`Unknown webhook event: ${args.event}`);
    }

    return { received: true };
  },
});
