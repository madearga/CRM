## ADDED Requirements

### Requirement: Product tag removal shall update form state

The product form SHALL remove tags from local form state when a user clicks remove.

#### Scenario: user removes a tag
- **WHEN** a product form has tag `promo`
- **AND** the user clicks remove for `promo`
- **THEN** `promo` is removed from the submitted tag list

### Requirement: Activity auto-schedule delay shall be submitted

The schedule activity dialog SHALL include the configured delay value when creating auto-scheduled activities.

#### Scenario: user sets auto-schedule delay
- **WHEN** the user configures a delay value before scheduling
- **THEN** the backend mutation receives that delay value
