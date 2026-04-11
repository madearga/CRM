'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface StepUploadProps {
  onFileSelected: (file: File) => Promise<void>;
}

export function StepUpload({ onFileSelected }: StepUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please upload a .csv file');
        return;
      }
      try {
        await onFileSelected(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      }
    },
    [onFileSelected],
  );

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className={`flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragging
            ? 'border-[#171717] bg-gray-50'
            : 'border-gray-200 hover:border-gray-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Upload className="w-8 h-8 text-gray-400 mb-3" />
        <p className="text-sm text-[#171717] font-medium">
          Drag & drop CSV or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Maximum 500 rows. .csv files only.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
