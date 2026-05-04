## ADDED Requirements

### Requirement: Chat sidebar panel
The system SHALL render a collapsible chat panel docked to the right side of the viewport on all authenticated pages. The panel SHALL expand to 380px width and collapse to a floating toggle button (44x44px, bottom-right corner). The main content area SHALL resize when the panel expands/collapses.

#### Scenario: Owner opens chat panel
- **WHEN** a user with owner role clicks the AI chat toggle button
- **THEN** the chat panel slides in from the right, the main content area shrinks by 380px, and the chat input is focused

#### Scenario: Owner closes chat panel
- **WHEN** a user clicks the close/collapse button in the chat panel header
- **THEN** the panel slides out, the main content area expands to full width, and the toggle button appears in the bottom-right corner

#### Scenario: Panel state persistence
- **WHEN** the user expands or collapses the panel
- **THEN** the state SHALL be saved to localStorage and restored on next page load

### Requirement: Message rendering
The system SHALL display messages in a vertical scrollable list. User messages SHALL appear right-aligned with a distinct color. Assistant messages SHALL appear left-aligned with an AI avatar icon. Messages SHALL support markdown rendering (bold, italic, lists, tables, code blocks).

#### Scenario: Streaming message display
- **WHEN** the assistant is generating a response
- **THEN** the message text SHALL appear incrementally with a typing indicator, and auto-scroll to the bottom

#### Scenario: Markdown table rendering
- **WHEN** the assistant returns a markdown table
- **THEN** the table SHALL be rendered with proper formatting (borders, header styling, alternating row colors)

### Requirement: Chat input
The system SHALL provide a text input at the bottom of the chat panel with a placeholder "Tanya tentang data CRM..." and a send button. Pressing Enter (without Shift) SHALL submit the message. Shift+Enter SHALL insert a newline.

#### Scenario: Send message
- **WHEN** user types a message and presses Enter or clicks the send button
- **THEN** the message appears in the chat, the input clears, and the assistant begins generating a response

#### Scenario: Empty message prevention
- **WHEN** user presses Enter with empty input
- **THEN** no message is sent

### Requirement: Conversation management
The system SHALL display a list of previous conversations in a dropdown accessible from the panel header. Users SHALL be able to start a new conversation or switch to a previous one.

#### Scenario: Start new conversation
- **WHEN** user clicks "New Chat" in the conversation dropdown
- **THEN** a new empty conversation is created and displayed

#### Scenario: Switch conversation
- **WHEN** user selects a previous conversation from the dropdown
- **THEN** the chat displays all messages from that conversation and the user can continue it
