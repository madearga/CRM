'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { env } from '@/env';
import { useAuthStore } from '@/lib/convex/components/convex-provider';
import { type ChatMessage } from '@/components/ai-chat/message-bubble';

const STORAGE_KEY = 'crm-ai-chat-open';

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string>();
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const abortRef = useRef<AbortController | null>(null);
  const { state: authState } = useAuthStore();

  // Load chat history only after Better Auth session token is available.
  // useConvexAuth() can become authenticated before AuthEffect has synced the token.
  const hasAuthToken = Boolean(authState.token);

  const conversations = useQuery(
    api.aiChatHistory.listConversations,
    isOpen && hasAuthToken ? { limit: 20 } : 'skip'
  );

  const savedMessages = useQuery(
    api.aiChatHistory.getMessages,
    isOpen && hasAuthToken && currentConversationId ? { conversationId: currentConversationId as any } : 'skip'
  );

  // Sync saved messages into local state when they load or change
  useEffect(() => {
    if (savedMessages && currentConversationId) {
      setMessages(
        savedMessages.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolCalls: m.toolCalls,
          isStreaming: false,
        }))
      );
    }
  }, [savedMessages, currentConversationId]);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMsg]);

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', isStreaming: true },
      ]);

      setIsLoading(true);

      try {
        abortRef.current = new AbortController();

        const convexSiteUrl = env.NEXT_PUBLIC_CONVEX_SITE_URL;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authState.token) {
          headers.Authorization = `Bearer ${authState.token}`;
        }

        const response = await fetch(`${convexSiteUrl}/api/ai/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            conversationId: currentConversationId,
            message: content,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error ?? 'Request failed');
        }

        // Parse SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let toolCalls: { name: string; args: Record<string, unknown> }[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'meta') {
                setCurrentConversationId(parsed.conversationId);
              } else if (parsed.type === 'tool_call') {
                toolCalls = [...toolCalls, { name: parsed.name, args: parsed.args }];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, toolCalls: [...toolCalls] }
                      : m
                  )
                );
              } else if (parsed.type === 'text') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: parsed.content, isStreaming: false, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
                      : m
                  )
                );
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${err.message}`, isStreaming: false }
                : m
            )
          );
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, currentConversationId, authState.token]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setMessages([]); // Will be populated by savedMessages effect
  }, []);

  const newConversation = useCallback(() => {
    setCurrentConversationId(undefined);
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    isOpen,
    conversations: (conversations ?? []) as { id: string; title: string; updatedAt: number }[],
    currentConversationId,
    togglePanel,
    sendMessage,
    stopGeneration,
    selectConversation,
    newConversation,
  };
}
