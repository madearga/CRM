## MODIFIED Requirements

### Requirement: Checkout product organization validation
The system SHALL verify every checkout line item belongs to the storefront organization.

#### Scenario: Cross-tenant product in cart
- **WHEN** cart contains product IDs from a different organization
- **THEN** checkout SHALL reject before stock or payment mutation.

### Requirement: Webhook order lookup scoping
The system SHALL process payment webhooks using provider signature and an organization-scoped order reference.

#### Scenario: Duplicate order number across organizations
- **WHEN** a webhook references an order number that exists in multiple organizations
- **THEN** the system SHALL resolve the intended order using provider metadata or transaction binding, not orderNumber alone.
