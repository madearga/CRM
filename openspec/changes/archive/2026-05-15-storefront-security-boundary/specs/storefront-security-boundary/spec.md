## ADDED Requirements

### Requirement: Three explicit access boundaries
The system SHALL classify commerce requests into CRM/Admin, Storefront Guest, or Webhook access boundaries.

#### Scenario: CRM admin request
- **WHEN** a CRM user manages orders, stock, products, or reviews
- **THEN** the system SHALL require authenticated user, active organization, and sufficient permission.

#### Scenario: Storefront guest request
- **WHEN** a guest buyer uses cart, checkout, or order tracking
- **THEN** the system SHALL validate organization slug and either sessionId or order access token.

#### Scenario: Webhook request
- **WHEN** a payment provider calls a webhook
- **THEN** the system SHALL validate provider signature before mutating order/payment state.
