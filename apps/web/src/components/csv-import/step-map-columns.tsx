'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CONTACT_FIELDS,
  type ColumnMap,
  type ContactField,
  type ParsedRow,
} from './import-types';

interface StepMapColumnsProps {
  headers: string[];
  rawRows: ParsedRow[];
  columnMap: ColumnMap;
  onMapField: (field: ContactField, csvHeader: string | undefined) => void;
}

export function StepMapColumns({
  headers,
  rawRows,
  columnMap,
  onMapField,
}: StepMapColumnsProps) {
  const previewRows = rawRows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Mapping section */}
      <div>
        <h3 className="text-sm font-medium text-[#171717] mb-3">
          Map CSV columns to contact fields
        </h3>
        <div className="space-y-2">
          {CONTACT_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <label className="w-40 text-sm text-gray-600 flex items-center gap-1 shrink-0">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              <Select
                value={columnMap[field.key] || '__none__'}
                onValueChange={(v) =>
                  onMapField(field.key, v === '__none__' ? undefined : v)
                }
              >
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="-- None --" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Preview table */}
      <div>
        <h3 className="text-sm font-medium text-[#171717] mb-3">
          Preview (first 5 rows)
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-b-0">
                  {headers.map((h) => (
                    <td
                      key={h}
                      className="px-3 py-2 text-gray-800 whitespace-nowrap max-w-48 truncate"
                    >
                      {row[h] || <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
