## Context

The CRM currently has a Next.js frontend + Convex backend with modules for companies, contacts, deals, HR (employees, attendance, shifts, corrections), commerce (products, invoices, payments), and organization management. Auth uses Better Auth with role-based access (owner, admin, member). There is no AI-assisted interface — all data operations require manual navigation through the UI.

The owner wants a chat-based AI assistant embedded directly in the CRM web app that can understand natural language and perform data operations across all modules via function calling.

## Goals / Non-Goals

**Goals:**
- Owner can open a chat sidebar from any page and interact in natural language
- Agent can query and mutate data across all CRM modules
- Agent can generate summary reports and analytics
- Streaming responses for real-time UX
- Conversation history persisted per organization
- Owner-only access enforced at both frontend and backend
- OpenRouter-compatible API (OpenAI function calling format)

**Non-Goals:**
- Multi-user chat or collaboration features
- Agent memory across conversations (each conversation is stateless beyond message history)
- Agent browsing external websites or third-party integrations in v1
- File/document generation (PDF/Excel) — agent returns data in markdown tables
- Mobile-specific chat UI (responsive is fine, but not a dedicated mobile experience)

## Decisions

### 1. LLM Communication: Convex HTTP Action → OpenRouter

**Decision**: Use a Convex HTTP action as the chat endpoint. The action receives user messages, sends them to OpenRouter (OpenAI-compatible API) with function definitions, executes tool calls by running internal Convex queries/mutations, and streams the final response back to the client.

**Rationale**: Keeps everything within Convex — auth, data access, and the LLM loop all share the same context. No additional server needed.

**Alternative considered**: Next.js API route as proxy. Rejected because it requires separate auth forwarding and loses direct `ctx.runQuery`/`ctx.runMutation` access.

### 2. Streaming: Server-Sent Events (SSE)

**Decision**: The Convex HTTP action streams text chunks via SSE (`text/event-stream`). Frontend uses `EventSource` or `fetch` with readable stream to render progressively.

**Rationale**: SSE is simpler than WebSocket for unidirectional server→client streaming. Convex HTTP actions support streaming responses natively.

### 3. Tool Architecture: Internal Functions as Tools

**Decision**: Each LLM tool maps to an internal Convex query or mutation. Tool definitions are statically defined with JSON Schema parameters. The executor validates args, injects `organizationId` and `userId` from auth context, then calls the corresponding internal function.

**Rationale**: Reuses existing Convex functions. No new API layer needed. Org-scoping is automatic since all existing queries already filter by `organizationId`.

**Tool categories (v1)**:
| Category | Tools |
|----------|-------|
| CRM Core | `listCompanies`, `getCompany`, `listContacts`, `getContact`, `listDeals`, `getDeal`, `createActivity`, `updateDealStage` |
| HR | `listEmployees`, `getAttendance`, `markAttendance`, `listShifts`, `getAttendanceCorrections`, `approveCorrection` |
| Commerce | `listInvoices`, `getInvoice`, `listProducts`, `getSaleOrders`, `getRevenueSummary` |
| Reports | `getDashboardStats`, `getAttendanceReport`, `getDealPipelineReport`, `getRevenueReport` |

### 4. Chat UI: Collapsible Right Sidebar

**Decision**: A panel docked to the right side of the viewport, togglable via a button. When expanded (~380px width), the main content area shrinks. When collapsed, a small floating button remains.

**Rationale**: The sidebar pattern keeps the chat always accessible without leaving the current page context. This matches the user's preference.

### 5. Chat History: Convex Tables

**Decision**: Two new Convex tables: `aiChatConversations` (one per org, tracks title and timestamps) and `aiChatMessages` (individual messages with role, content, tool calls, and tool results).

**Rationale**: Simple, queryable, and co-located with all other CRM data. Enables "continue previous conversation" UX.

### 6. Access Control: Owner Role Check

**Decision**: Frontend checks user role before rendering chat panel. Backend HTTP action verifies the session token and checks owner role before processing any request. Non-owner requests return 403.

**Rationale**: Simple and consistent with existing `authPermissions.ts` role system.

## Risks / Trade-offs

- **[LLM cost]** → OpenRouter charges per token. Mitigation: limit max tokens per response, track usage per org, consider rate limiting in future.
- **[Tool scope creep]** → Too many tools = higher token cost and potential confusion. Mitigation: start with ~20 core tools, add more based on usage patterns.
- **[Convex action timeout]** → Complex function calling loops may hit Convex's execution time limit. Mitigation: cap the tool call loop at 5 iterations; if exceeded, return a summary of what was accomplished.
- **[Streaming from Convex HTTP]** → Convex HTTP actions support streaming but it's less battle-tested than query/mutation. Mitigation: fallback to non-streaming if issues arise.
- **[Mutation safety]** → Agent can modify data (approve leave, update deal stage). Mitigation: destructive mutations require explicit confirmation in the prompt flow; agent always describes what it's about to do before executing.
