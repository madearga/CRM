## ADDED Requirements

### Requirement: Organization-scoped session cart lookup
The system SHALL lookup guest carts by organizationId and sessionId together, never by sessionId alone.

#### Scenario: Same sessionId across organizations
- **WHEN** two organizations have carts with the same sessionId
- **THEN** the system SHALL only return the cart for the requested organization.

### Requirement: Dual-mode cart ownership
The system SHALL support both authenticated and guest cart ownership through a shared helper.

#### Scenario: Authenticated cart access
- **WHEN** a logged-in user modifies cart
- **THEN** the system SHALL verify organization membership.

#### Scenario: Guest cart access
- **WHEN** a guest modifies cart
- **THEN** the system SHALL verify sessionId and organizationId.

### Requirement: Cart rate limiting
The system SHALL rate limit guest cart mutations by organizationId and sessionId.
