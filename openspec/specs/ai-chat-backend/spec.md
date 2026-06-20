# ai-chat-backend Specification

## Purpose
TBD - created by archiving change ai-chat-assistant. Update Purpose after archive.
## Requirements
### Requirement: Chat HTTP endpoint
The system SHALL expose a Convex HTTP action at `/api/ai/chat` that accepts POST requests with `{ conversationId, message }` and returns a streaming SSE response.

#### Scenario: Successful chat request
- **WHEN** an authenticated owner sends a POST to `/api/ai/chat` with a valid conversationId and message
- **THEN** the system returns a `text/event-stream` response with incremental text chunks prefixed with `data: ` and terminated with `data: [DONE]`

#### Scenario: Streaming format
- **WHEN** the LLM generates a response
- **THEN** each text chunk SHALL be sent as `data: {"type":"text","content":"..."}\n\n` and tool results as `data: {"type":"tool_call","name":"...","args":{...}}\n\n`

### Requirement: Function calling loop
The system SHALL implement an agentic loop: send user message + history + tool definitions to the LLM, execute any tool calls, feed results back, and repeat until the LLM returns a final text response or the loop reaches 5 iterations.

#### Scenario: Single tool call
- **WHEN** user asks "Siapa karyawan yang belum absen hari ini?"
- **THEN** the system calls `getAttendance` tool, feeds the result back to the LLM, and streams the final natural language response

#### Scenario: Multiple sequential tool calls
- **WHEN** user asks "Catat alpha dan kirim reminder"
- **THEN** the system first calls `markAttendance`, then calls a notification function, feeds both results back, and returns a summary

#### Scenario: Loop iteration limit
- **WHEN** the function calling loop reaches 5 iterations without a final text response
- **THEN** the system SHALL return a summary of completed tool calls and a message indicating the task was partially completed

### Requirement: Context injection
The system SHALL inject a system prompt containing: organization context (name, plan), current date/time, user role, and a description of available tools with their parameters.

#### Scenario: System prompt assembly
- **WHEN** a new chat request is received
- **THEN** the system prompt SHALL include the org name, current date in Indonesian locale, "Anda adalah asisten AI untuk CRM" instruction, and all tool definitions

