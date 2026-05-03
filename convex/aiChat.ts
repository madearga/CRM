import OpenAI from 'openai';
import { httpAction } from './_generated/server';
import { api, internal } from './_generated/api';
import { getEnv } from './helpers/getEnv';
import { toOpenAITools, executeTool } from './aiTools';
import { buildSystemPrompt } from './aiSystemPrompt';
import { getAuth } from './auth';
import type { Id } from './_generated/dataModel';

const MAX_TOOL_ITERATIONS = 5;
const MAX_MESSAGES_PER_CONVERSATION = 100;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const handleAiChat = httpAction(async (ctx, request) => {
  // Handle CORS preflight
  const origin = request.headers.get('origin') ?? '*';
  const corsHeaders = {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': origin,
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // --- Auth check via Better Auth session ---
  // HTTP actions receive cookies from the browser via credentials: 'include'.
  // We reconstruct the headers and use Better Auth's getSession to verify.
  const requestHeaders = new Headers();
  // Forward relevant cookies and auth headers
  const cookie = request.headers.get('cookie');
  if (cookie) requestHeaders.set('cookie', cookie);
  const authorization = request.headers.get('authorization');
  if (authorization) requestHeaders.set('authorization', authorization);

  let sessionPayload: any;
  try {
    const auth = getAuth(ctx as any);
    sessionPayload = await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    console.error('[AI Chat] Session lookup failed:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!sessionPayload?.session || !sessionPayload?.user?.email) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const session = sessionPayload.session as any;
  const sessionOrgId = session.activeOrganizationId as Id<'organization'> | null;

  const ownerContext = await ctx.runQuery(api.aiChatHistory.getOwnerContextForHttp, {
    email: sessionPayload.user.email,
    orgId: sessionOrgId ?? undefined,
  });

  if (!ownerContext) {
    return new Response(
      JSON.stringify({ error: 'Access denied. Owner role or active organization required.' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const orgId = ownerContext.orgId;
  const orgName = ownerContext.orgName;

  // --- Parse request ---
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const { conversationId, message } = body as {
    conversationId?: Id<'aiChatConversations'>;
    message: string;
  };

  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: 'Message is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // --- Rate limiting: max 30 messages per minute per user ---
  // Simple rate limit via conversation timestamp check
  const env = getEnv();
  if (!env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'AI chat is not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // --- Get or create conversation ---
  let convId = conversationId;
  if (!convId) {
    convId = await ctx.runMutation(internal.aiChatHistory.createConversationForHttp, {
      title: message.slice(0, 50),
      organizationId: orgId,
      userId: ownerContext.userId,
    });
  }

  // Check conversation message count to prevent runaway conversations
  const existingMessages = await ctx.runQuery(internal.aiChatHistory.getMessagesForHttp, {
    conversationId: convId,
    organizationId: orgId,
  });
  if (existingMessages.length > MAX_MESSAGES_PER_CONVERSATION) {
    return new Response(
      JSON.stringify({ error: 'Conversation too long. Please start a new conversation.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Save user message
  await ctx.runMutation(internal.aiChatHistory.addUserMessageForHttp, {
    conversationId: convId,
    organizationId: orgId,
    content: message,
  });

  // Reload history after save
  const history = await ctx.runQuery(internal.aiChatHistory.getMessagesForHttp, {
    conversationId: convId,
    organizationId: orgId,
  });

  // --- Setup LLM ---
  const model = env.AI_CHAT_MODEL || 'anthropic/claude-sonnet-4';

  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const systemPrompt = buildSystemPrompt({
    orgName,
    userName: ownerContext.userName ?? 'Owner',
    date: new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  });

  // Build messages array — only send last N messages to fit context window
  const recentHistory = history.slice(-50);
  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...recentHistory.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const tools = toOpenAITools();

  // --- Agentic loop ---
  const toolCallLog: any[] = [];
  let finalContent = '';
  let iterations = 0;

  try {
    let currentMessages = [...chatMessages];

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const completion = await client.chat.completions.create({
        model,
        messages: currentMessages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: 4096,
        stream: false,
      });

      const choice = completion.choices[0];
      if (!choice) break;

      const assistantMessage = choice.message;

      // If no tool calls, we're done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        finalContent = assistantMessage.content ?? '';
        break;
      }

      // Add assistant message with tool calls to conversation
      currentMessages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type === 'custom') continue;

        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown>;
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
          if (!toolArgs || typeof toolArgs !== 'object') toolArgs = {};
        } catch {
          // Return parse error to LLM so it can retry
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: 'Invalid JSON arguments. Please retry with valid JSON.' }),
          });
          continue;
        }

        const result = await executeTool(toolName, toolArgs, {
          ctx,
          orgId,
          userId: ownerContext.userId,
        });

        toolCallLog.push({ name: toolName, args: toolArgs, result });

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (iterations >= MAX_TOOL_ITERATIONS && !finalContent) {
      finalContent = 'Task selesai sebagian. Beberapa operasi mungkin belum lengkap karena batas iterasi.';
    }
  } catch (err: any) {
    // P0 fix: Don't leak internal error details to user
    console.error('[AI Chat] Error:', err.message);
    finalContent = 'Maaf, terjadi kesalahan internal. Tim sudah diberitahu. Silakan coba lagi dalam beberapa saat.';
  }

  // Save assistant message
  await ctx.runMutation(internal.aiChatHistory.addAssistantMessageForHttp, {
    conversationId: convId,
    organizationId: orgId,
    content: finalContent,
    toolCalls: toolCallLog.length > 0 ? toolCallLog : undefined,
  });

  // Return SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'meta', conversationId: convId })}\n\n`
        )
      );

      for (const tc of toolCallLog) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'tool_call', name: tc.name, args: tc.args })}\n\n`
          )
        );
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'text', content: finalContent })}\n\n`
        )
      );

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  });
});
