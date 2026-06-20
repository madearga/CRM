## ADDED Requirements

### Requirement: CSV exports shall neutralize formula injection

CSV export utilities SHALL sanitize user-controlled cell values that begin with formula metacharacters before writing them to exported CSV.

#### Scenario: product name begins with equals sign
- **WHEN** a product name starts with `=`
- **THEN** the CSV export prefixes the cell so spreadsheet software treats it as text

### Requirement: User-controlled links shall be protocol allowlisted

Frontend components that render user-controlled URLs as links SHALL only render `http:` and `https:` URLs as clickable hrefs.

#### Scenario: company website is javascript URL
- **WHEN** company website is `javascript:alert(1)`
- **THEN** the page does not render it as a clickable href
