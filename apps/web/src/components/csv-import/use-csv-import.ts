'use client';

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import {
  type ColumnMap,
  type FieldDef,
  type ParsedRow,
  type ValidatedRow,
  type ImportResult,
} from './import-types';
import { autoMapColumns, validateRows, getMappedEntity } from './csv-utils';

const MAX_ROWS = 500;

interface UseCsvImportOptions<T extends string> {
  fields: FieldDef<T>[];
  validateOptions: Parameters<typeof validateRows>[2];
  bulkCreateMutation: {
    mutateAsync: (args: any) => Promise<any>;
  };
  mutationKey: string;
  getPayload: (mapped: Record<string, unknown>) => any;
}

export function useCsvImport<T extends string>({
  fields,
  validateOptions,
  bulkCreateMutation,
  mutationKey,
  getPayload,
}: UseCsvImportOptions<T>) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap<T>>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const parseFile = useCallback(
    async (file: File) => {
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

            const autoMap = autoMapColumns(h, fields);
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
    },
    [fields],
  );

  const setFieldMapping = useCallback((field: T, csvHeader: string | undefined) => {
    setColumnMap((prev) => {
      const next = { ...prev };
      if (csvHeader) next[field] = csvHeader;
      else delete next[field];
      return next;
    });
  }, []);

  const goToPreview = useCallback(() => {
    const validated = validateRows<T>(rawRows, columnMap, validateOptions as any);
    setValidatedRows(validated);
    setStep(3);
  }, [rawRows, columnMap, validateOptions]);

  const runImport = useCallback(async () => {
    const validRows = validatedRows.filter((r) => r.status === 'valid');
    if (validRows.length === 0) return;

    setIsImporting(true);
    try {
      const entities = validRows.map((r) => {
        const mapped = getMappedEntity(r.data, columnMap);
        return getPayload(mapped);
      });
      const result = await bulkCreateMutation.mutateAsync({
        [mutationKey]: entities,
      });
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
            identifier: '',
            reason: error instanceof Error ? error.message : String(error),
          },
        ],
      });
      setStep(4);
    } finally {
      setIsImporting(false);
    }
  }, [
    validatedRows,
    columnMap,
    bulkCreateMutation,
    mutationKey,
    getPayload,
  ]);

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
