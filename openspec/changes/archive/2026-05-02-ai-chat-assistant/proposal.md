## Why

CRM owners currently navigate multiple pages, filters, and forms to get answers or perform actions on their data. An AI chat assistant lets them query and operate all CRM data (companies, contacts, deals, HR, invoices, etc.) through natural language — reducing time-to-insight from minutes to seconds. This is the first step toward an agent-native CRM experience.

## What Changes

- Add a collapsible right sidebar AI chat panel accessible from any page in the CRM
- Chat connects to an LLM via OpenRouter (OpenAI-compatible API) using function calling
- Agent can query and mutate data across all CRM modules (companies, contacts, deals, activities, HR, invoices, products, etc.)
- Agent can generate reports (attendance summaries, deal pipeline, revenue, etc.)
- Chat is restricted to users with **owner** role only
- Conversation history persisted so owners can resume past chats
- Streaming responses for real-time UX

## Capabilities

### New Capabilities
- `ai-chat-ui`: Collapsible sidebar chat panel with message bubbles, streaming text rendering, markdown support, and expand/collapse toggle
- `ai-chat-backend`: Convex HTTP action that runs an LLM function-calling loop (OpenRouter/OpenAI-compatible), executes tools as Convex queries/mutations, and streams responses back to the client
- `ai-chat-tools`: Tool definitions and executor mapping — each tool wraps a Convex query or mutation with parameter validation and org-scoped access
- `ai-chat-history`: Persistent chat message storage in Convex, enabling conversation resumption and per-org chat isolation
- `ai-chat-access`: Owner-only access control for both frontend (UI guard) and backend (role verification in HTTP action)

### Modified Capabilities
<!-- No existing specs are modified -->

## Impact

- **Convex**: New HTTP action (`aiChat`), new tables (`aiChatConversations`, `aiChatMessages`), new internal functions for tool execution
- **Frontend**: New component tree under `apps/web/src/components/ai-chat/`, layout modification to accommodate sidebar panel, new hook for SSE streaming
- **Dependencies**: `openai` npm package (or `@ai-sdk/openai` compatible) for OpenRouter API calls from Convex actions
- **Environment**: `OPENROUTER_API_KEY` env var needed in Convex deployment
- **Schema**: 2 new tables for chat persistence
- **Security**: Owner role check on every request; all tool queries/mutations scoped to the authenticated user's organization
