import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';
import { createOrgQuery, createOrgMutation } from './functions';

// --- Queries ---

export const getOwnerContextForHttp = internalQuery({
  args: {
    email: v.string(),
    orgId: v.optional(v.id('organization')),
  },
  returns: v.union(
    v.object({
      userId: v.id('user'),
      userName: v.optional(v.string()),
      orgId: v.id('organization'),
      orgName: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query('user')
      .withIndex('email', (q) => q.eq('email', args.email))
      .take(1);
    const user = users[0];
    if (!user) return null;

    const resolvedOrgId =
      args.orgId ?? (user as any).personalOrganizationId ?? (user as any).lastActiveOrganizationId;
    if (!resolvedOrgId) return null;

    const members = await ctx.db
      .query('member')
      .withIndex('organizationId_userId', (q) =>
        q.eq('organizationId', resolvedOrgId).eq('userId', user._id)
      )
      .take(1);
    const member = members[0];
    if (!member || member.role !== 'owner') return null;

    const org = await ctx.db.get(resolvedOrgId);
    if (!org) return null;

    return {
      userId: user._id,
      userName: (user as any).name,
      orgId: resolvedOrgId,
      orgName: (org as any).name,
    };
  },
});

export const createConversationForHttp = internalMutation({
  args: {
    title: v.string(),
    organizationId: v.id('organization'),
    userId: v.id('user'),
  },
  returns: v.id('aiChatConversations'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('aiChatConversations', {
      title: args.title,
      organizationId: args.organizationId,
      userId: args.userId,
      updatedAt: Date.now(),
    });
  },
});

export const getMessagesForHttp = internalQuery({
  args: {
    conversationId: v.id('aiChatConversations'),
    organizationId: v.id('organization'),
  },
  returns: v.array(
    v.object({
      id: v.id('aiChatMessages'),
      role: v.union(v.literal('user'), v.literal('assistant'), v.literal('tool')),
      content: v.string(),
      toolCalls: v.optional(v.array(v.record(v.string(), v.any()))),
      toolResults: v.optional(v.array(v.record(v.string(), v.any()))),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.organizationId !== args.organizationId) {
      return [];
    }

    const messages = await ctx.db
      .query('aiChatMessages')
      .withIndex('conversationId', (q) => q.eq('conversationId', args.conversationId))
      .collect();

    return messages
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        toolResults: m.toolResults,
        createdAt: m._creationTime,
      }));
  },
});

export const addUserMessageForHttp = internalMutation({
  args: {
    conversationId: v.id('aiChatConversations'),
    organizationId: v.id('organization'),
    content: v.string(),
  },
  returns: v.id('aiChatMessages'),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.organizationId !== args.organizationId) {
      throw new Error('Conversation not found');
    }

    await ctx.db.patch(args.conversationId, { updatedAt: Date.now() });
    return await ctx.db.insert('aiChatMessages', {
      conversationId: args.conversationId,
      role: 'user',
      content: args.content,
    });
  },
});

export const addAssistantMessageForHttp = internalMutation({
  args: {
    conversationId: v.id('aiChatConversations'),
    organizationId: v.id('organization'),
    content: v.string(),
    toolCalls: v.optional(v.array(v.record(v.string(), v.any()))),
  },
  returns: v.id('aiChatMessages'),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.organizationId !== args.organizationId) {
      throw new Error('Conversation not found');
    }

    await ctx.db.patch(args.conversationId, { updatedAt: Date.now() });
    return await ctx.db.insert('aiChatMessages', {
      conversationId: args.conversationId,
      role: 'assistant',
      content: args.content,
      toolCalls: args.toolCalls,
    });
  },
});

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
