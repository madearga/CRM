import { z } from 'zod';
import { createOrgMutation, createOrgQuery } from '../functions';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getShopConfig = createOrgQuery()({
  args: {},
  returns: z.object({
    isActive: z.boolean(),
    provider: z.string().nullable(),
    sandboxMode: z.boolean(),
    clientKey: z.string(),
    serverKeyConfigured: z.boolean(),
  }),
  handler: async (ctx, _args) => {
    // Check for existing midtrans provider
    const provider = await ctx
      .table('paymentProviders', 'organizationId_provider', (q) =>
        q.eq('organizationId', ctx.orgId).eq('provider', 'midtrans'),
      )
      .first();

    if (!provider) {
      return {
        isActive: false,
        provider: null,
        sandboxMode: true,
        clientKey: '',
        serverKeyConfigured: false,
      };
    }

    return {
      isActive: provider.isActive,
      provider: provider.provider,
      sandboxMode: provider.sandboxMode ?? true,
      clientKey: provider.config?.clientKey ?? '',
      serverKeyConfigured: !!(provider.config?.serverKey),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const saveShopConfig = createOrgMutation({
  permission: { feature: 'settings', action: 'edit' },
})({
  args: {
    isActive: z.boolean(),
    sandboxMode: z.boolean(),
    clientKey: z.string(),
    serverKey: z.string().optional(),
  },
  returns: z.object({ success: z.boolean() }),
  handler: async (ctx, args) => {
    // Find existing provider record
    const existing = await ctx
      .table('paymentProviders', 'organizationId_provider', (q) =>
        q.eq('organizationId', ctx.orgId).eq('provider', 'midtrans'),
      )
      .first();

    const config: Record<string, string> = {
      clientKey: args.clientKey,
    };

    // Only update server key if provided (don't overwrite with empty)
    if (args.serverKey) {
      config.serverKey = args.serverKey;
    } else if (existing?.config?.serverKey) {
      config.serverKey = existing.config.serverKey;
    }

    if (existing) {
      await existing.patch({
        isActive: args.isActive,
        sandboxMode: args.sandboxMode,
        config,
      });
    } else {
      await ctx.table('paymentProviders').insert({
        organizationId: ctx.orgId,
        provider: 'midtrans',
        isActive: args.isActive,
        sandboxMode: args.sandboxMode,
        config,
      } as any);
    }

    return { success: true };
  },
});
