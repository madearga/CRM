'use client';

import { Button } from '@/components/ui/button';
import { type ColumnMap, type ValidatedRow, type FieldDef } from './import-types';

interface StepPreviewProps<T extends string> {
  validatedRows: ValidatedRow[];
  columnMap: ColumnMap<T>;
  onImport: () => void;
  isImporting: boolean;
  fields: FieldDef<T>[];
}

export function StepPreview<T extends string>({
  validatedRows,
  columnMap,
  onImport,
  isImporting,
  fields,
}: StepPreviewProps<T>) {
  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = validatedRows.filter(
    (r) => r.status === 'invalid',
  ).length;
  const displayRows = validatedRows.slice(0, 10);

  const mappedFields = fields.filter((f) => columnMap[f.key]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="text-green-700 font-medium">{validCount} valid</span>
        {invalidCount > 0 && (
          <span className="text-red-600 font-medium">
            {invalidCount} with errors (will be skipped)
          </span>
        )}
      </div>

      {/* Preview table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">
                #
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">
                Status
              </th>
              {mappedFields.map((f) => (
                <th
                  key={f.key}
                  className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const isValid = row.status === 'valid';
              return (
                <tr
                  key={row.rowIndex}
                  className={`border-b border-border last:border-b-0 ${
                    !isValid ? 'bg-red-50/50' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.rowIndex + 1}
                  </td>
                  <td className="px-3 py-2">
                    {isValid ? (
                      <span className="text-green-600 text-xs font-medium">
                        ✓ Valid
                      </span>
                    ) : (
                      <span className="text-red-600 text-xs">
                        ✗ {row.reason}
                      </span>
                    )}
                  </td>
                  {mappedFields.map((f) => {
                    const csvHeader = columnMap[f.key];
                    return (
                      <td
                        key={f.key}
                        className="px-3 py-2 text-foreground whitespace-nowrap max-w-48 truncate"
                      >
                        {csvHeader ? row.data[csvHeader] : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {validatedRows.length > 10 && (
          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/50">
            Showing 10 of {validatedRows.length} rows
          </div>
        )}
      </div>

      {/* Import button */}
      <div className="flex justify-end">
        <Button
          onClick={onImport}
          disabled={isImporting || validCount === 0}
          size="sm"
        >
          {isImporting
            ? 'Importing...'
            : `Import ${validCount} record${validCount !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
