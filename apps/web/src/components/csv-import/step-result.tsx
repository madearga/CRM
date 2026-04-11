'use client';

import { CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImportResult } from './import-types';

interface StepResultProps {
  result: ImportResult;
  onClose: () => void;
}

export function StepResult({ result, onClose }: StepResultProps) {
  const hasErrors = result.errors.length > 0;

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="flex flex-col items-center gap-2">
        {hasErrors ? (
          <AlertCircle className="w-12 h-12 text-yellow-500" />
        ) : (
          <CheckCircle className="w-12 h-12 text-green-600" />
        )}
        <h3 className="text-lg font-semibold text-[#171717]">
          Import Complete
        </h3>
      </div>

      <div className="flex gap-8">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-semibold text-green-600">
            {result.created}
          </span>
          <span className="text-sm text-gray-500">Created</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-semibold text-yellow-600">
            {result.skipped}
          </span>
          <span className="text-sm text-gray-500">Skipped</span>
        </div>
        {hasErrors && (
          <div className="flex flex-col items-center">
            <span className="text-2xl font-semibold text-red-600">
              {result.errors.length}
            </span>
            <span className="text-sm text-gray-500">Errors</span>
          </div>
        )}
      </div>

      {hasErrors && (
        <div className="w-full mt-2">
          <p className="text-sm text-gray-600 mb-2 font-medium">Error details:</p>
          <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
            {result.errors.map((err, i) => (
              <li key={i}>
                {err.row >= 0 ? `Row ${err.row}: ` : ''}{err.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={onClose}>
        Done
      </Button>
    </div>
  );
}
