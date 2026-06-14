## ADDED Requirements

### Requirement: Guest cart mutations shall be rate limited

Unauthenticated cart mutations SHALL enforce rate limits keyed by storefront organization and guest session ID.

#### Scenario: guest repeatedly adds items
- **WHEN** the same guest session exceeds the configured cart mutation limit
- **THEN** the mutation is rejected with an actionable rate-limit error

### Requirement: Guest checkout shall be rate limited

Unauthenticated checkout initiation SHALL enforce rate limits keyed by storefront organization and guest session ID.

#### Scenario: guest repeatedly initiates checkout
- **WHEN** the same guest session exceeds the configured checkout limit
- **THEN** checkout is rejected before stock is decremented or payment is initiated
