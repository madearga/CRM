'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toCSV, downloadCSV } from '@/lib/export-csv';
import { toast } from 'sonner';

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  columns: { key: string; label: string }[];
  filename: string;
  disabled?: boolean;
}

export function DataTableExportButton<T extends Record<string, any>>({
  data,
  columns,
  filename,
  disabled,
}: ExportButtonProps<T>) {
  const handleExport = () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    try {
      const csv = toCSV(data, columns);
      downloadCSV(csv, filename);
      toast.success(`Exported ${data.length} rows`);
    } catch {
      toast.error('Failed to export data');
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={disabled || data.length === 0}>
      <Download className="mr-1 h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
