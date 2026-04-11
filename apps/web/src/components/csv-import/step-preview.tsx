'use client';

import { type ColumnMap, type ValidatedRow, CONTACT_FIELDS } from './import-types';

interface StepPreviewProps {
  validatedRows: ValidatedRow[];
  columnMap: ColumnMap;
  onImport: () => void;
  isImporting: boolean;
}

export function StepPreview({
  validatedRows,
  columnMap,
  onImport,
  isImporting,
}: StepPreviewProps) {
  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = validatedRows.filter(
    (r) => r.status === 'invalid',
  ).length;
  const displayRows = validatedRows.slice(0, 10);

  const mappedFields = CONTACT_FIELDS.filter((f) => columnMap[f.key]);

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
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-12">
                #
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">
                Status
              </th>
              {mappedFields.map((f) => (
                <th
                  key={f.key}
                  className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
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
                  className={`border-b border-gray-100 last:border-b-0 ${
                    !isValid ? 'bg-red-50/50' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-gray-500">
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
                        className="px-3 py-2 text-gray-800 whitespace-nowrap max-w-48 truncate"
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
          <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-200 bg-gray-50">
            Showing 10 of {validatedRows.length} rows
          </div>
        )}
      </div>

      {/* Import button */}
      <div className="flex justify-end">
        <button
          onClick={onImport}
          disabled={isImporting || validCount === 0}
          className="px-4 py-2 bg-[#171717] text-white text-sm font-medium rounded-md hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isImporting
            ? 'Importing...'
            : `Import ${validCount} contact${validCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
