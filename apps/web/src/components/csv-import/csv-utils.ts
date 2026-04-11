import type { ColumnMap, ParsedRow } from './import-types';

const VALID_STAGES = ['lead', 'prospect', 'customer', 'churned'];

/**
 * Auto-detect column mapping by matching CSV headers to contact fields.
 * Uses exact match on normalized (lowercase, alphanumeric only) strings.
 */
export function autoMapColumns(
  headers: string[],
  fieldDefs: Array<{ key: string; label: string }>,
): ColumnMap {
  const map: ColumnMap = {};
  const normalizedHeaders = headers.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, ''),
  );

  for (const field of fieldDefs) {
    const normalizedField = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');

    const idx = normalizedHeaders.findIndex(
      (h) => h === normalizedField || h === labelNorm,
    );
    if (idx !== -1) {
      map[field.key as keyof ColumnMap] = headers[idx];
    }
  }

  return map;
}

/**
 * Validate parsed CSV rows against the column mapping.
 * Checks: email required + format, lifecycleStage enum.
 */
export function validateRows(
  rows: ParsedRow[],
  columnMap: ColumnMap,
): Array<{
  rowIndex: number;
  data: ParsedRow;
  status: 'valid' | 'invalid';
  reason?: string;
}> {
  const emailHeader = columnMap.email;
  const lifecycleHeader = columnMap.lifecycleStage;

  return rows.map((row, i) => {
    if (!emailHeader || !row[emailHeader]?.trim()) {
      return { rowIndex: i, data: row, status: 'invalid', reason: 'Missing email' };
    }
    const email = row[emailHeader].trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { rowIndex: i, data: row, status: 'invalid', reason: 'Invalid email' };
    }
    // Validate lifecycleStage if mapped
    if (lifecycleHeader && row[lifecycleHeader]?.trim()) {
      const stage = row[lifecycleHeader].trim().toLowerCase();
      if (!VALID_STAGES.includes(stage)) {
        return {
          rowIndex: i,
          data: row,
          status: 'invalid',
          reason: `Invalid lifecycle stage: "${row[lifecycleHeader].trim()}"`,
        };
      }
    }
    return { rowIndex: i, data: row, status: 'valid' };
  });
}

/**
 * Map a CSV row to a contact object using the column mapping.
 * Handles: tags (comma-split), lifecycleStage (enum), notes (length limit).
 */
export function getMappedContact(
  row: ParsedRow,
  columnMap: ColumnMap,
): Record<string, unknown> {
  const contact: Record<string, unknown> = {};
  for (const [field, csvHeader] of Object.entries(columnMap)) {
    if (!csvHeader) continue;
    const value = (row[csvHeader] || '').trim();

    if (field === 'tags' && value) {
      contact[field] = value
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
    } else if (field === 'lifecycleStage' && value) {
      contact[field] = VALID_STAGES.includes(value.toLowerCase())
        ? value.toLowerCase()
        : undefined;
    } else if (field === 'notes' && value) {
      contact[field] = value.length > 5000 ? value.slice(0, 5000) : value;
    } else if (value) {
      contact[field] = value;
    }
  }
  return contact;
}
