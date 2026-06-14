## ADDED Requirements

### Requirement: Guest order access token
The system SHALL generate a high-entropy order access token for guest orders and store only a hash.

#### Scenario: Guest order created
- **WHEN** a guest checkout creates an order
- **THEN** the system SHALL return a one-time raw order access token and persist only a hash.

### Requirement: Guest order actions require token
The system SHALL require orderNumber, organizationSlug, and a valid access token for guest order detail, payment status, and cancellation.

#### Scenario: Guest accesses own order
- **WHEN** a guest provides a valid token for the order
- **THEN** the system SHALL allow viewing safe order fields.

#### Scenario: Attacker knows only order number
- **WHEN** a request omits or provides an invalid token
- **THEN** the system SHALL reject access.
