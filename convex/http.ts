import './helpers/polyfills';
import { httpRouter } from 'convex/server';
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

export default http;
