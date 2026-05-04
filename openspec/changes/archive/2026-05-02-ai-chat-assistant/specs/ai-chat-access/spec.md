## ADDED Requirements

### Requirement: Owner-only frontend guard
The chat panel toggle button and chat UI SHALL only be rendered for users with the owner role. Non-owners SHALL NOT see any chat UI elements.

#### Scenario: Owner sees chat button
- **WHEN** a user with owner role is logged in
- **THEN** the chat toggle button SHALL be visible on all pages

#### Scenario: Non-owner sees nothing
- **WHEN** a user with member or admin role is logged in
- **THEN** no chat UI elements SHALL be rendered

### Requirement: Owner-only backend verification
The chat HTTP action SHALL verify the user's session and role before processing any request. Unauthenticated or non-owner requests SHALL be rejected.

#### Scenario: Valid owner request
- **WHEN** a request includes a valid session token for an owner user
- **THEN** the request is processed normally

#### Scenario: Non-owner request
- **WHEN** a request includes a valid session token for a non-owner user
- **THEN** the system SHALL return HTTP 403 with `{ error: "Access denied. Owner role required." }`

#### Scenario: Unauthenticated request
- **WHEN** a request does not include a valid session token
- **THEN** the system SHALL return HTTP 401 with `{ error: "Authentication required." }`

### Requirement: Organization scoping
All tool executions SHALL be scoped to the authenticated user's active organization. The executor SHALL inject `organizationId` from the session, not from user-supplied parameters.

#### Scenario: Tool call with org scope
- **WHEN** any tool is executed
- **THEN** the `organizationId` SHALL be set from the authenticated session's active organization, ignoring any `organizationId` in the tool arguments
