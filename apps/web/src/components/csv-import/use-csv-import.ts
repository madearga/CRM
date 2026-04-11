'use client';

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import {
  CONTACT_FIELDS,
  type ColumnMap,
  type ContactField,
  type ParsedRow,
  type ValidatedRow,
  type ImportResult,
} from './import-types';
import { autoMapColumns, validateRows, getMappedContact } from './csv-utils';

const MAX_ROWS = 500;

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

          const autoMap = autoMapColumns(h, CONTACT_FIELDS);
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
          lifecycleStage: mapped.lifecycleStage as
            | 'lead'
            | 'prospect'
            | 'customer'
            | 'churned'
            | undefined,
          tags: mapped.tags as string[] | undefined,
          notes: mapped.notes as string | undefined,
          companyName: mapped.companyName as string | undefined,
        };
      });
      const result = await bulkCreate.mutateAsync({ contacts });
      setImportResult(result as ImportResult);
      setStep(4);
    } catch (error) {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : String(error),
      });
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
