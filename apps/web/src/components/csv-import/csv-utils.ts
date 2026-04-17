import type { ColumnMap, ParsedRow, FieldDef } from './import-types';

const CONTACT_STAGES = ['lead', 'prospect', 'customer', 'churned'];
const COMPANY_STATUSES = ['active', 'inactive', 'prospect'];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const COMPANY_SOURCES = ['referral', 'website', 'linkedin', 'cold', 'event', 'other'];

/**
 * Auto-detect column mapping by matching CSV headers to entity fields.
 * Uses exact match on normalized (lowercase, alphanumeric only) strings.
 */
export function autoMapColumns<T extends string>(
  headers: string[],
  fieldDefs: FieldDef<T>[],
): ColumnMap<T> {
  const map: ColumnMap<T> = {};
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
      map[field.key] = headers[idx];
    }
  }

  return map;
}

/**
 * Validate parsed CSV rows against the column mapping.
 */
export function validateRows<T extends string>(
  rows: ParsedRow[],
  columnMap: ColumnMap<T>,
  options: {
    requiredField: T;
    emailField?: T;
    lifecycleField?: T;
    companyStatusField?: T;
    companySizeField?: T;
    companySourceField?: T;
  },
): Array<{
  rowIndex: number;
  data: ParsedRow;
  status: 'valid' | 'invalid';
  reason?: string;
}> {
  const mainHeader = columnMap[options.requiredField];

  return rows.map((row, i) => {
    if (!mainHeader || !row[mainHeader]?.trim()) {
      return {
        rowIndex: i,
        data: row,
        status: 'invalid',
        reason: `Missing required field: ${String(options.requiredField)}`,
      };
    }

    // Email validation if applicable
    if (options.emailField) {
      const emailHeader = columnMap[options.emailField];
      if (emailHeader && row[emailHeader]?.trim()) {
        const email = row[emailHeader].trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return { rowIndex: i, data: row, status: 'invalid', reason: 'Invalid email' };
        }
      }
    }

    // Lifecycle validation for contacts
    if (options.lifecycleField) {
      const lifecycleHeader = columnMap[options.lifecycleField];
      if (lifecycleHeader && row[lifecycleHeader]?.trim()) {
        const stage = row[lifecycleHeader].trim().toLowerCase();
        if (!CONTACT_STAGES.includes(stage)) {
          return {
            rowIndex: i,
            data: row,
            status: 'invalid',
            reason: `Invalid lifecycle stage: "${row[lifecycleHeader].trim()}"`,
          };
        }
      }
    }

    // Company status validation
    if (options.companyStatusField) {
      const statusHeader = columnMap[options.companyStatusField];
      if (statusHeader && row[statusHeader]?.trim()) {
        const status = row[statusHeader].trim().toLowerCase();
        if (!COMPANY_STATUSES.includes(status)) {
          return {
            rowIndex: i,
            data: row,
            status: 'invalid',
            reason: `Invalid status: "${row[statusHeader].trim()}"`,
          };
        }
      }
    }

    // Company size validation
    if (options.companySizeField) {
      const sizeHeader = columnMap[options.companySizeField];
      if (sizeHeader && row[sizeHeader]?.trim()) {
        const size = row[sizeHeader].trim();
        if (!COMPANY_SIZES.includes(size)) {
          return {
            rowIndex: i,
            data: row,
            status: 'invalid',
            reason: `Invalid size: "${row[sizeHeader].trim()}"`,
          };
        }
      }
    }

    // Company source validation
    if (options.companySourceField) {
      const sourceHeader = columnMap[options.companySourceField];
      if (sourceHeader && row[sourceHeader]?.trim()) {
        const source = row[sourceHeader].trim().toLowerCase();
        if (!COMPANY_SOURCES.includes(source)) {
          return {
            rowIndex: i,
            data: row,
            status: 'invalid',
            reason: `Invalid source: "${row[sourceHeader].trim()}"`,
          };
        }
      }
    }

    return { rowIndex: i, data: row, status: 'valid' };
  });
}

/**
 * Map a CSV row to an object using the column mapping.
 */
export function getMappedEntity<T extends string>(
  row: ParsedRow,
  columnMap: ColumnMap<T>,
): Record<string, unknown> {
  const entity: Record<string, unknown> = {};
  for (const [field, csvHeader] of Object.entries(columnMap)) {
    if (!csvHeader) continue;
    const value = (row[csvHeader as string] || '').trim();

    if (field === 'tags' && value) {
      entity[field] = value
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
    } else if (field === 'lifecycleStage' && value) {
      entity[field] = CONTACT_STAGES.includes(value.toLowerCase())
        ? value.toLowerCase()
        : undefined;
    } else if (field === 'status' && value) {
      entity[field] = COMPANY_STATUSES.includes(value.toLowerCase())
        ? value.toLowerCase()
        : undefined;
    } else if (field === 'source' && value) {
      entity[field] = COMPANY_SOURCES.includes(value.toLowerCase())
        ? value.toLowerCase()
        : undefined;
    } else if (field === 'size' && value) {
      entity[field] = COMPANY_SIZES.includes(value) ? value : undefined;
    } else if (field === 'notes' && value) {
      entity[field] = value.length > 5000 ? value.slice(0, 5000) : value;
    } else if (value) {
      entity[field] = value;
    }
  }
  return entity;
}
