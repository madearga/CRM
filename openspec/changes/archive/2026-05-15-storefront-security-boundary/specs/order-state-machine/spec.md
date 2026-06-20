## ADDED Requirements

### Requirement: Central order transition helper
The system SHALL route all order status changes through a shared transition helper.

#### Scenario: Cancel order once
- **WHEN** an order transitions to cancelled
- **THEN** the system SHALL return stock exactly once.

#### Scenario: Repeated cancel
- **WHEN** a cancelled order receives another cancel request
- **THEN** the system SHALL reject or no-op without changing stock again.

### Requirement: Actor-aware transitions
The system SHALL distinguish guest, CRM user, and webhook actors for order transitions.

#### Scenario: Guest cancellation
- **WHEN** a guest cancels an order with a valid token
- **THEN** the system SHALL only allow cancellation from allowed pre-fulfillment states.
