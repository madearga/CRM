import { v } from 'convex/values';
import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import { createOrgQuery, createOrgMutation } from './functions';

// --- Queries ---

export const listConversations = createOrgQuery()({
  args: {
    limit: z.number().min(1).max(50).optional(),
  },
  returns: z.array(
    z.object({
      id: zid('aiChatConversations'),
      title: z.string(),
      updatedAt: z.number(),
    })
  ),
  handler: async (ctx, args) => {
    const conversations = await ctx
      .table('aiChatConversations', 'organizationId_updatedAt', (q) =>
        q.eq('organizationId', ctx.orgId)
      )
      .order('desc')
      .take(args.limit ?? 20);

    return conversations.map((c: any) => ({
      id: c._id,
      title: c.title,
      updatedAt: c.updatedAt,
    }));
  },
});

export const getMessages = createOrgQuery()({
  args: {
    conversationId: zid('aiChatConversations'),
  },
  returns: z.array(
    z.object({
      id: zid('aiChatMessages'),
      role: z.union([z.literal('user'), z.literal('assistant'), z.literal('tool')]),
      content: z.string(),
      toolCalls: z.array(z.any()).optional(),
      toolResults: z.array(z.any()).optional(),
      createdAt: z.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Verify conversation belongs to this org
    const conversation = await ctx.table('aiChatConversations').get(args.conversationId);
    if (!conversation || conversation.organizationId !== ctx.orgId) {
      throw new Error('Conversation not found');
    }

    const messages = await ctx
      .table('aiChatMessages', 'conversationId', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .take(1000);

    return messages.map((m: any) => ({
      id: m._id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolResults: m.toolResults,
      createdAt: m._creationTime,
    }));
  },
});

// --- Mutations ---

export const createConversation = createOrgMutation()({
  args: {
    title: z.string(),
  },
  returns: zid('aiChatConversations'),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const id = await ctx.table('aiChatConversations').insert({
      title: args.title,
      organizationId: ctx.orgId,
      userId: ctx.userId,
      updatedAt,
    });
    return id;
  },
});

export const addUserMessage = createOrgMutation()({
  args: {
    conversationId: zid('aiChatConversations'),
    content: z.string(),
  },
  returns: zid('aiChatMessages'),
  handler: async (ctx, args) => {
    // Verify conversation belongs to this org
    const conversation = await ctx.table('aiChatConversations').get(args.conversationId);
    if (!conversation || conversation.organizationId !== ctx.orgId) {
      throw new Error('Conversation not found');
    }

    const id = await ctx.table('aiChatMessages').insert({
      conversationId: args.conversationId,
      role: 'user',
      content: args.content,

    });

    // Update conversation timestamp
    await ctx.table('aiChatConversations').getX(args.conversationId).patch({
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const addAssistantMessage = createOrgMutation()({
  args: {
    conversationId: zid('aiChatConversations'),
    content: z.string(),
    toolCalls: z.array(z.any()).optional(),
    toolResults: z.array(z.any()).optional(),
  },
  returns: zid('aiChatMessages'),
  handler: async (ctx, args) => {
    // Verify conversation belongs to this org
    const conversation = await ctx.table('aiChatConversations').get(args.conversationId);
    if (!conversation || conversation.organizationId !== ctx.orgId) {
      throw new Error('Conversation not found');
    }

    const id = await ctx.table('aiChatMessages').insert({
      conversationId: args.conversationId,
      role: 'assistant',
      content: args.content,
      toolCalls: args.toolCalls,
      toolResults: args.toolResults,

    });

    // Update conversation timestamp
    await ctx.table('aiChatConversations').getX(args.conversationId).patch({
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const updateConversationTimestamp = createOrgMutation()({
  args: {
    conversationId: zid('aiChatConversations'),
  },
  returns: z.null(),
  handler: async (ctx, args) => {
    const conversation = await ctx.table('aiChatConversations').get(args.conversationId);
    if (!conversation || conversation.organizationId !== ctx.orgId) {
      throw new Error('Conversation not found');
    }
    await ctx.table('aiChatConversations').getX(args.conversationId).patch({
      updatedAt: Date.now(),
    });
    return null;
  },
});
