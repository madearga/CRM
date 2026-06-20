import './helpers/polyfills';
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { createAuth } from './auth';
import { handlePaymentWebhook } from './commerce/checkout';
import { handleAiChat } from './aiChat';
import { verifyWebhookSignature } from './helpers/validateWebhook';

const http = httpRouter();

function authBaseURLForRequest(request: Request): string {
  const forwardedWebOrigin = request.headers.get('x-crm-auth-base-url');
  if (forwardedWebOrigin) return forwardedWebOrigin;

  const convexSiteUrl =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL || process.env.CONVEX_SITE_URL;
  const origin = request.headers.get('origin');
  const requestUrl = new URL(request.url);

  if (request.headers.has('expo-origin') || requestUrl.hostname.endsWith('.convex.site')) {
    return convexSiteUrl || requestUrl.origin;
  }

  return origin || process.env.NEXT_PUBLIC_SITE_URL || convexSiteUrl || requestUrl.origin;
}

const authRequestHandler = httpAction(async (ctx, request) => {
  const auth = createAuth(ctx as any, {
    baseURL: authBaseURLForRequest(request),
  });
  return auth.handler(request);
});

http.route({ pathPrefix: '/api/auth/', method: 'GET', handler: authRequestHandler });
http.route({ pathPrefix: '/api/auth/', method: 'POST', handler: authRequestHandler });

http.route({
  path: '/.well-known/openid-configuration',
  method: 'GET',
  handler: httpAction(async () => {
    const siteUrl = process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    return Response.redirect(`${siteUrl}/api/auth/convex/.well-known/openid-configuration`);
  }),
});

// AI Chat Assistant (owner-only)
http.route({
  path: '/api/ai/chat',
  method: 'POST',
  handler: handleAiChat,
});
http.route({
  path: '/api/ai/chat',
  method: 'OPTIONS',
  handler: handleAiChat,
});

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
      console.error('Webhook processing failed:', err);
      return new Response(
        JSON.stringify({ error: 'Webhook processing failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }),
});

export default http;
