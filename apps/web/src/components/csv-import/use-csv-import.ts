'use client';

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import {
  CONTACT_FIELDS,
  type ColumnMap,
  type ContactField,
  type ParsedRow,
  type ValidatedRow,
  type ImportResult,
} from './import-types';

const MAX_ROWS = 500;

function autoMapColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const normalizedHeaders = headers.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, ''),
  );

  for (const field of CONTACT_FIELDS) {
    const normalizedField = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Exact match only — key or label normalized
    const idx = normalizedHeaders.findIndex(
      (h) => h === normalizedField || h === labelNorm,
    );
    if (idx !== -1) {
      map[field.key] = headers[idx];
    }
  }

  return map;
}

function validateRows(rows: ParsedRow[], columnMap: ColumnMap): ValidatedRow[] {
  const emailHeader = columnMap.email;
  return rows.map((row, i) => {
    if (!emailHeader || !row[emailHeader]?.trim()) {
      return { rowIndex: i, data: row, status: 'invalid', reason: 'Missing email' };
    }
    const email = row[emailHeader].trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { rowIndex: i, data: row, status: 'invalid', reason: 'Invalid email' };
    }
    return { rowIndex: i, data: row, status: 'valid' };
  });
}

function getMappedContact(row: ParsedRow, columnMap: ColumnMap) {
  const contact: Record<string, unknown> = {};
  for (const [field, csvHeader] of Object.entries(columnMap)) {
    if (!csvHeader) continue;
    const value = (row[csvHeader] || '').trim();

    if (field === 'tags' && value) {
      contact[field] = value.split(',').map((t: string) => t.trim()).filter(Boolean);
    } else if (field === 'lifecycleStage' && value) {
      const valid = ['lead', 'prospect', 'customer', 'churned'];
      contact[field] = valid.includes(value.toLowerCase())
        ? value.toLowerCase()
        : undefined;
    } else if (value) {
      contact[field] = value;
    }
  }
  return contact;
}

export function useCsvImport() {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const bulkCreate = useAuthMutation(api.contacts.bulkCreate);

  const parseFile = useCallback(async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const h = results.meta.fields ?? [];
          const rows = results.data as ParsedRow[];

          if (rows.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }
          if (rows.length > MAX_ROWS) {
            reject(new Error(`Too many rows (${rows.length}). Maximum is ${MAX_ROWS}.`));
            return;
          }

          const autoMap = autoMapColumns(h);
          setFileName(file.name);
          setHeaders(h);
          setRawRows(rows);
          setColumnMap(autoMap);
          setStep(2);
          resolve();
        },
        error: (error) => reject(new Error(error.message)),
      });
    });

  }, []);

  const setFieldMapping = useCallback(
    (field: ContactField, csvHeader: string | undefined) => {
      setColumnMap((prev) => {
        const next = { ...prev };
        if (csvHeader) next[field] = csvHeader;
        else delete next[field];
        return next;
      });
    },
    [],
  );

  const goToPreview = useCallback(() => {
    const validated = validateRows(rawRows, columnMap);
    setValidatedRows(validated);
    setStep(3);
  }, [rawRows, columnMap]);

  const runImport = useCallback(async () => {
    const validRows = validatedRows.filter((r) => r.status === 'valid');
    if (validRows.length === 0) return;

    setIsImporting(true);
    try {
      const contacts = validRows.map((r) => {
        const mapped = getMappedContact(r.data, columnMap);
        return {
          email: mapped.email as string,
          firstName: mapped.firstName as string | undefined,
          lastName: mapped.lastName as string | undefined,
          jobTitle: mapped.jobTitle as string | undefined,
          phone: mapped.phone as string | undefined,
          lifecycleStage: mapped.lifecycleStage as 'lead' | 'prospect' | 'customer' | 'churned' | undefined,
          tags: mapped.tags as string[] | undefined,
          notes: mapped.notes as string | undefined,
          companyName: mapped.companyName as string | undefined,
        };
      });
      const result = await bulkCreate.mutateAsync({ contacts });
      setImportResult(result as ImportResult);
      setStep(4);
    } catch (error) {
      setImportResult({
        created: 0,
        skipped: 0,
        errors: [
          {
            row: -1,
            email: '',
            reason: error instanceof Error ? error.message : String(error),
          },
        ],
      });
      setStep(4);
    } finally {
      setIsImporting(false);
    }
  }, [validatedRows, columnMap, bulkCreate]);

  const reset = useCallback(() => {
    setStep(1);
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setColumnMap({});
    setValidatedRows([]);
    setImportResult(null);
    setIsImporting(false);
  }, []);

  return {
    step,
    setStep,
    headers,
    rawRows,
    columnMap,
    validatedRows,
    importResult,
    isImporting,
    fileName,
    parseFile,
    setFieldMapping,
    goToPreview,
    runImport,
    reset,
  };
}
