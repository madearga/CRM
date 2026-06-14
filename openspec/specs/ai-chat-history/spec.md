# ai-chat-history Specification

## Purpose
TBD - created by archiving change ai-chat-assistant. Update Purpose after archive.
## Requirements
### Requirement: Conversation storage
The system SHALL store conversations in an `aiChatConversations` table with fields: `organizationId`, `userId`, `title` (auto-generated from first message), `createdAt`, `updatedAt`. Each organization can have multiple conversations per owner.

#### Scenario: Auto-generate conversation title
- **WHEN** the first message is sent in a new conversation
- **THEN** the system SHALL use the first 50 characters of the message as the title

#### Scenario: List conversations
- **WHEN** the owner opens the conversation dropdown
- **THEN** the system SHALL return conversations ordered by `updatedAt` descending, limited to 20 most recent

### Requirement: Message storage
The system SHALL store messages in an `aiChatMessages` table with fields: `conversationId`, `role` (user/assistant/tool), `content` (string), `toolCalls` (optional JSON array), `toolResults` (optional JSON array), `createdAt`.

#### Scenario: Store user message
- **WHEN** the user sends a message
- **THEN** the system SHALL store it with `role: "user"` before sending to the LLM

#### Scenario: Store assistant message with tool calls
- **WHEN** the assistant responds with tool calls followed by a final text response
- **THEN** the system SHALL store the complete assistant turn including tool calls, tool results, and final content as a single message with `role: "assistant"`

### Requirement: Conversation isolation
Conversations SHALL be scoped to an organization. A user SHALL NOT be able to access conversations from other organizations.

#### Scenario: Cross-org access prevention
- **WHEN** a user attempts to load a conversationId belonging to a different organization
- **THEN** the system SHALL return a 403 error

