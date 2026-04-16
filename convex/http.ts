import './helpers/polyfills';
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { authClient } from './auth';
import { createAuth } from './auth';
import { handlePaymentWebhook } from './commerce/checkout';

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
  handler: httpAction(async (_ctx, request) => {
    try {
      const body = await request.json();
      const { event, orgId, data } = body as {
        event?: string;
        orgId?: string;
        data?: any;
      };

      if (!event || !orgId || !data) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: event, orgId, data' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // TODO: Verify HMAC signature for security
      // TODO: Process webhook via internal action/mutation

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
