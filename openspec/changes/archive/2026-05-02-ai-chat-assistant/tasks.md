## 1. Schema & Dependencies

- [x] 1.1 Add `aiChatConversations` and `aiChatMessages` tables to `convex/schema.ts`
- [x] 1.2 Add `openai` npm package (for OpenRouter-compatible API calls)
- [x] 1.3 Add `OPENROUTER_API_KEY` env var to Convex deployment config

## 2. Chat History (Convex)

- [x] 2.1 Create `convex/aiChatHistory.ts` — queries: `listConversations`, `getConversation`, `getMessages`; mutations: `createConversation`, `addUserMessage`, `addAssistantMessage`, `updateConversationTimestamp`
- [x] 2.2 Add conversation isolation check (orgId scoping) to all queries/mutations

## 3. Tool Definitions

- [x] 3.1 Create `convex/aiTools/definitions.ts` — export all tool definitions (name, description, JSON Schema params) grouped by category
- [x] 3.2 Create CRM Core tools: `listCompanies`, `getCompany`, `listContacts`, `getContact`, `listDeals`, `getDeal`, `createActivity`, `updateDealStage`, `searchEntities`
- [x] 3.3 Create HR tools: `listEmployees`, `getAttendance`, `markAttendance`, `listShifts`, `getAttendanceCorrections`, `approveCorrection`, `getHolidays`
- [x] 3.4 Create Commerce tools: `listInvoices`, `getInvoice`, `listProducts`, `getSaleOrders`, `getRevenueSummary`
- [x] 3.5 Create Report tools: `getDashboardStats`, `getAttendanceReport`, `getDealPipelineReport`, `getRevenueReport`

## 4. Tool Executor

- [x] 4.1 Create `convex/aiTools/executor.ts` — map tool name → internal Convex function, validate params, inject orgId/userId
- [x] 4.2 Create `convex/aiTools/index.ts` — barrel export combining definitions and executor

## 5. Chat Backend (LLM Loop)

- [x] 5.1 Create `convex/aiSystemPrompt.ts` — system prompt builder with org context, date, role, tool descriptions
- [x] 5.2 Create `convex/aiChat.ts` — HTTP action with SSE streaming, function calling loop (max 5 iterations), auth + owner role check
- [x] 5.3 Register HTTP route in `convex/http.ts` at `/api/ai/chat`
- [x] 5.4 Test the full loop: message → LLM → tool call → executor → result → final response

## 6. Chat UI Components

- [x] 6.1 Create `apps/web/src/components/ai-chat/chat-panel.tsx` — collapsible sidebar panel with expand/collapse animation
- [x] 6.2 Create `apps/web/src/components/ai-chat/message-list.tsx` — scrollable message list with auto-scroll
- [x] 6.3 Create `apps/web/src/components/ai-chat/message-bubble.tsx` — user/assistant bubbles with markdown rendering
- [x] 6.4 Create `apps/web/src/components/ai-chat/chat-input.tsx` — text input with Enter to send, Shift+Enter for newline
- [x] 6.5 Create `apps/web/src/components/ai-chat/conversation-selector.tsx` — dropdown to switch/create conversations
- [x] 6.6 Create `apps/web/src/components/ai-chat/chat-toggle.tsx` — floating button to open panel

## 7. Frontend Integration

- [x] 7.1 Create `apps/web/src/hooks/use-ai-chat.ts` — hook for SSE streaming, message state management
- [x] 7.2 Integrate chat panel into root layout — render conditionally based on owner role
- [x] 7.3 Add localStorage persistence for panel open/close state
- [x] 7.4 Wire up conversation list, new conversation, and conversation switching

## 8. Access Control

- [x] 8.1 Add owner role check in frontend layout (hide toggle for non-owners)
- [x] 8.2 Add owner role + auth verification in HTTP action backend (401/403 responses)

## 9. Testing & Polish

- [x] 9.1 Test tool execution across all categories (CRM, HR, Commerce, Reports)
- [x] 9.2 Test streaming UX — verify progressive rendering and auto-scroll
- [x] 9.3 Test access control — verify non-owners see nothing, unauthenticated gets 401
- [x] 9.4 Test conversation persistence — verify history loads correctly after page refresh
- [x] 9.5 Responsive behavior — verify panel works on smaller screens
