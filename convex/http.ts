import './helpers/polyfills';
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { authClient } from './auth';
import { createAuth } from './auth';
import { handlePaymentWebhook } from './commerce/checkout';
import { verifyWebhookSignature } from './helpers/validateWebhook';

const http = httpRouter();

authClient.registerRoutes(http, createAuth);

// Midtrans payment webhook
http.route({
  path: '/webhooks/midtrans',
  method: 'POST',
  handler: handlePaymentWebhook,
});

// External plugin webhook receiver
http.route({
  path: '/webhooks/plugin',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const rawBody = await request.text();
      const body = JSON.parse(rawBody);
      const { event, pluginId, data } = body as {
        event?: string;
        pluginId?: string;
        orgId?: string;
        data?: any;
      };

      if (!event || !pluginId || !data) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: event, pluginId, data' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Look up plugin to get API key for HMAC verification
      const plugin = await ctx.runQuery(internal.externalPlugins.getInternal, { id: pluginId });
      if (!plugin) {
        return new Response(
          JSON.stringify({ error: 'Plugin not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verify HMAC signature
      const signature = request.headers.get('X-CRM-Signature');
      const isValid = await verifyWebhookSignature(rawBody, signature, plugin.apiKey);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Process webhook via internal mutation
      await ctx.runMutation(internal.externalPlugins.processWebhook, {
        event,
        orgId: plugin.organizationId,
        data,
      });

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message ?? 'Internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }),
});

export default http;
