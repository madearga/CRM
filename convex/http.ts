import './helpers/polyfills';
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { ConvexError } from 'convex/values';
import { z } from 'zod';

import type { Id } from './_generated/dataModel';
import { authClient } from './auth';
import { createAuth } from './auth';
import { handlePaymentWebhook } from './commerce/checkout';
import { handleAiChat } from './aiChat';
import { verifyWebhookSignature } from './helpers/validateWebhook';
import {
  AGENT_BRIDGE_SIGNATURE_HEADER,
  AGENT_BRIDGE_TIMESTAMP_HEADER,
  verifyAgentBridgeSignature,
} from './helpers/agentBridge';

const http = httpRouter();

authClient.registerRoutes(http, createAuth);

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
      return new Response(
        JSON.stringify({ error: err.message ?? 'Internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }),
});

// The agent service bridge.
//
// An outside service posts into a room through these two routes. The
// request must carry a signature that the shared secret proves. The raw
// body is read before the JSON is parsed, because the signature covers the
// exact text that was sent.
//
// The rules of the bridge:
// - A request without a valid signature is refused with 401, and nothing of
//   the body is read.
// - A body that does not match the expected shape is refused with 400.
// - A request that the room rules refuse is refused with 403.
// - A request for a room, an agent or an operation that does not exist is
//   refused with 404.
// - Every other failure is refused with 500.

const bridgeMessageArgs = z.object({
  organizationId: z.string().min(1),
  roomId: z.string().min(1),
  agentId: z.string().min(1).max(60),
  text: z.string().min(1).max(4000),
});

const bridgeProposalArgs = z.object({
  organizationId: z.string().min(1),
  roomId: z.string().min(1),
  agentId: z.string().min(1).max(60),
  // The person whose session the agent acted with. The operation is
  // attributed to that person, not to whoever created the room.
  requestingUserId: z.string().min(1),
  operationKind: z.enum(['create_activity', 'update_deal_stage']),
  payload: z.record(z.unknown()),
  summary: z.string().max(500).optional(),
});

/** A JSON answer with a status code. */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * The body of a request that carries a valid signature.
 *
 * The secret is read from the environment of the deployment. A deployment
 * without the secret refuses every request, because a request that cannot be
 * signed cannot be checked.
 */
async function readSignedBridgeRequest(
  request: Request
): Promise<{ body: unknown } | { response: Response }> {
  const secret = process.env.AGENT_SERVICE_SECRET;
  if (!secret) {
    return {
      response: jsonResponse(
        { error: 'The agent service secret is not set on this deployment' },
        500
      ),
    };
  }

  const rawBody = await request.text();
  const path = new URL(request.url).pathname;

  const verdict = await verifyAgentBridgeSignature({
    secret,
    method: request.method,
    path,
    timestampHeader: request.headers.get(AGENT_BRIDGE_TIMESTAMP_HEADER),
    signatureHeader: request.headers.get(AGENT_BRIDGE_SIGNATURE_HEADER),
    rawBody,
  });

  if (!verdict.ok) {
    return {
      response: jsonResponse({ error: 'The signature is not valid' }, 401),
    };
  }

  try {
    return { body: JSON.parse(rawBody) as unknown };
  } catch {
    return {
      response: jsonResponse({ error: 'The body is not valid JSON' }, 400),
    };
  }
}

/** The answer for a failure inside the bridge. */
function bridgeErrorResponse(error: unknown): Response {
  const code =
    error instanceof ConvexError &&
    typeof error.data === 'object' &&
    error.data !== null
      ? (error.data as { code?: string }).code
      : undefined;
  const message = error instanceof Error ? error.message : 'The request failed';

  if (code === 'NOT_FOUND') {
    return jsonResponse({ error: message }, 404);
  }
  if (code === 'FORBIDDEN') {
    return jsonResponse({ error: message }, 403);
  }
  if (code === 'BAD_REQUEST' || code === 'CONFLICT') {
    return jsonResponse({ error: message }, 400);
  }

  console.error('[agentBridge] The request failed', error);
  return jsonResponse({ error: 'The request failed' }, 500);
}

/** A message of an agent into a room. */
const agentBridgeMessage = httpAction(async (ctx, request) => {
  const read = await readSignedBridgeRequest(request);
  if ('response' in read) return read.response;

  const parsed = bridgeMessageArgs.safeParse(read.body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'The body does not match the expected shape' },
      400
    );
  }

  try {
    const message = await ctx.runMutation(internal.rooms.postFromAgent, {
      organizationId: parsed.data.organizationId as Id<'organization'>,
      roomId: parsed.data.roomId as Id<'rooms'>,
      agentId: parsed.data.agentId,
      kind: 'message',
      text: parsed.data.text,
    });

    return jsonResponse({ ok: true, messageId: message.id }, 200);
  } catch (error) {
    return bridgeErrorResponse(error);
  }
});

/** A proposal of an agent into a room. */
const agentBridgeProposal = httpAction(async (ctx, request) => {
  const read = await readSignedBridgeRequest(request);
  if ('response' in read) return read.response;

  const parsed = bridgeProposalArgs.safeParse(read.body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'The body does not match the expected shape' },
      400
    );
  }

  try {
    const result = await ctx.runMutation(
      internal.agentOperations.proposeFromService,
      {
        organizationId: parsed.data.organizationId as Id<'organization'>,
        roomId: parsed.data.roomId as Id<'rooms'>,
        agentId: parsed.data.agentId,
        requestingUserId: parsed.data.requestingUserId as Id<'user'>,
        operationKind: parsed.data.operationKind,
        payload: parsed.data.payload,
        summary: parsed.data.summary,
      }
    );

    return jsonResponse(
      {
        ok: true,
        operationId: result.id,
        status: result.status,
        duplicate: result.duplicate,
      },
      200
    );
  } catch (error) {
    return bridgeErrorResponse(error);
  }
});

// Agent service bridge
http.route({
  path: '/api/agent/bridge/message',
  method: 'POST',
  handler: agentBridgeMessage,
});
http.route({
  path: '/api/agent/bridge/proposal',
  method: 'POST',
  handler: agentBridgeProposal,
});

export default http;
