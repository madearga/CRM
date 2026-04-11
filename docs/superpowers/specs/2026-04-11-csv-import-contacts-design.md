# CSV Import for Contacts

## Overview

Add CSV import feature to the Contacts page, allowing users to bulk-import contacts via CSV file upload with flexible column mapping.

## User Flow

4-step wizard dialog triggered by "Import" button on Contacts page toolbar:

1. **Upload** — Drag & drop or click to browse. Accept `.csv` only, max 500 rows. Validate format, row count, header detection upfront.
2. **Map Columns** — Preview 5 rows. Dropdown per contact field maps to CSV columns. Auto-detect matching headers. `email` required, rest optional.
3. **Preview** — Table of mapped data (max 10 rows shown). Highlight problematic rows (invalid email, missing email). Show counts: X valid, Y skipped, Z errors.
4. **Result** — Post-import summary: N created, M skipped (duplicate email), K errors. "Done" button closes dialog, contacts list auto-refreshes.

## Architecture

### New Components

```
src/app/(dashboard)/contacts/
  import-contacts-dialog.tsx       ← Main dialog, orchestrates steps

src/components/csv-import/
  step-upload.tsx                  ← Step 1: file upload + validation
  step-map-columns.tsx             ← Step 2: column mapping UI
  step-preview.tsx                 ← Step 3: preview mapped data
  step-result.tsx                  ← Step 4: import summary
  use-csv-import.ts                ← Hook: parse, validate, state management
  import-types.ts                  ← Shared types
```

### Convex Mutation

```
convex/contacts.ts
  + bulkCreate  ← Accept array of contacts, loop insert, skip duplicates by email
```

### State Management

`useCsvImport` hook holds all state:
- `step` (1-4)
- `rawRows` (parsed CSV rows)
- `headers` (CSV column names)
- `columnMap` (CSV column → contact field mapping)
- `validatedRows` (post-mapping + validation results)
- `importResult` ({ created, skipped, errors })

### Dependencies

- `papaparse` — Client-side CSV parsing

## Data Flow

```
CSV file → PapaParse → rawRows[] + headers[]
  → User maps columns → columnMap { field: csvHeader }
  → Validate rows → validatedRows[] with status (valid/invalid + reason)
  → bulkCreate mutation → { created: N, skipped: M, errors: K }
```

## Validation Rules

- **email**: required, must be valid email format
- **phone**: optional, no format enforcement
- **lifecycleStage**: optional, must match enum: `lead`, `prospect`, `customer`, `churned`
- **tags**: optional, comma-separated string → string array
- **Duplicate detection**: email checked against existing org contacts, skip on match

## Column Mapping

Contact fields available for mapping:

| Field | Required | Notes |
|-------|----------|-------|
| email | Yes | Valid email format |
| firstName | No | |
| lastName | No | |
| jobTitle | No | |
| phone | No | |
| lifecycleStage | No | Must match enum values |
| tags | No | Comma-separated |
| notes | No | |
| companyName | No | Match by name to existing company, leave null if no match |

Auto-detection: if CSV header matches field name (case-insensitive), auto-map it.

## Error Handling

- Invalid rows highlighted in preview, not sent to server
- Duplicate emails: skipped server-side, counted in result
- Partial success: valid rows still imported even if some fail
- No rollback — each row independent

## UI Placement

- "Import" button in contacts page toolbar (next to existing "Add Contact" button)
- Opens dialog modal
- Dialog closes on "Done" or X, contacts list refreshes via Convex reactivity

## Constraints

- Max 500 rows per import
- `.csv` files only
- Single batch mutation (not individual calls)
- No file storage — parsed entirely client-side
