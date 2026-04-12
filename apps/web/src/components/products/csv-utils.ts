/**
 * Export product data to CSV format.
 */

export interface ProductExportRow {
  name: string;
  type: string;
  category?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  cost?: number;
  unit?: string;
  weight?: number;
  description?: string;
  tags?: string[];
  active?: boolean;
}

const CSV_HEADERS = [
  'name',
  'type',
  'category',
  'sku',
  'barcode',
  'price',
  'cost',
  'unit',
  'weight',
  'description',
  'tags',
  'active',
];

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function productsToCSV(products: ProductExportRow[]): string {
  const headerLine = CSV_HEADERS.join(',');
  const rows = products.map((p) =>
    CSV_HEADERS.map((h) => {
      const val = (p as any)[h];
      if (val === undefined || val === null) return '';
      if (Array.isArray(val)) return escapeCSV(val.join(';'));
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      return escapeCSV(String(val));
    }).join(',')
  );

  return [headerLine, ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV text into an array of objects.
 */
export function parseCSV(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present (common in Excel-exported CSVs)
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] ?? '').trim();
    });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}
