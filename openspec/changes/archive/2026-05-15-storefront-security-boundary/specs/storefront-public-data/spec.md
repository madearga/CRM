## ADDED Requirements

### Requirement: Public product DTO
The system SHALL return explicit public DTOs for storefront product endpoints.

#### Scenario: Public product lookup
- **WHEN** an anonymous storefront user views a product
- **THEN** the system SHALL omit cost, internal notes, SKU, barcode, and other internal business fields.

### Requirement: Safe public URLs
The system SHALL sanitize user-configured URLs before rendering or returning them publicly.

#### Scenario: JavaScript URL configured
- **WHEN** a company website contains a javascript: URL
- **THEN** the system SHALL not render it as a clickable href.
