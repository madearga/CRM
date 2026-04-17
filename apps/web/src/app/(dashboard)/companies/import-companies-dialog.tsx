'use client';

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { COMPANY_FIELDS, type CompanyField } from '@/components/csv-import/import-types';
import { useCsvImport } from '@/components/csv-import/use-csv-import';
import { StepUpload } from '@/components/csv-import/step-upload';
import { StepMapColumns } from '@/components/csv-import/step-map-columns';
import { StepPreview } from '@/components/csv-import/step-preview';
import { StepResult } from '@/components/csv-import/step-result';

interface ImportCompaniesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEP_TITLES = {
  1: 'Upload CSV',
  2: 'Map Columns',
  3: 'Preview & Confirm',
  4: 'Import Result',
} as const;

export function ImportCompaniesDialog({
  open,
  onOpenChange,
}: ImportCompaniesDialogProps) {
  const bulkCreate = useAuthMutation(api.companies.bulkCreate);

  const {
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
  } = useCsvImport<CompanyField>({
    fields: COMPANY_FIELDS,
    mutationKey: 'companies',
    validateOptions: {
      requiredField: 'name',
      companyStatusField: 'status',
      companySizeField: 'size',
      companySourceField: 'source',
    },
    bulkCreateMutation: bulkCreate,
    getPayload: (mapped) => ({
      name: mapped.name as string,
      website: mapped.website as string | undefined,
      industry: mapped.industry as string | undefined,
      size: mapped.size as '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+' | undefined,
      address: mapped.address as string | undefined,
      country: mapped.country as string | undefined,
      source: mapped.source as 'referral' | 'website' | 'linkedin' | 'cold' | 'event' | 'other' | undefined,
      status: mapped.status as 'active' | 'inactive' | 'prospect' | undefined,
      tags: mapped.tags as string[] | undefined,
      notes: mapped.notes as string | undefined,
    }),
  });

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && isImporting) return; // prevent close during import
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleBack = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  const canProceed = step === 2 ? !!columnMap.name : true;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={step < 4}
        className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <div className="flex flex-col px-6 pt-6 pb-0">
          <h2 className="text-lg font-semibold text-[#171717]">
            {STEP_TITLES[step as keyof typeof STEP_TITLES]}
          </h2>
          {fileName && step > 1 && (
            <p className="text-xs text-gray-500 mt-0.5">{fileName}</p>
          )}
        </div>

        {/* Progress steps indicator */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-2">
            {(['Upload', 'Map', 'Preview', 'Result'] as const).map(
              (label, i) => (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={`w-8 h-px ${
                        step > i ? 'bg-[#171717]' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1.5 ${
                      step > i + 1
                        ? 'text-green-600'
                        : step === i + 1
                          ? 'text-[#171717]'
                          : 'text-gray-400'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${
                        step > i + 1
                          ? 'bg-green-600 text-white'
                          : step === i + 1
                            ? 'bg-[#171717] text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {step > i + 1 ? '✓' : i + 1}
                    </span>
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && <StepUpload onFileSelected={parseFile} />}
          {step === 2 && (
            <StepMapColumns
              headers={headers}
              rawRows={rawRows}
              columnMap={columnMap}
              onMapField={setFieldMapping}
              fields={COMPANY_FIELDS}
            />
          )}
          {step === 3 && (
            <StepPreview
              validatedRows={validatedRows}
              columnMap={columnMap}
              onImport={runImport}
              isImporting={isImporting}
              fields={COMPANY_FIELDS}
            />
          )}
          {step === 4 && importResult && (
            <StepResult result={importResult} onClose={() => handleClose(false)} />
          )}
        </div>

        {/* Footer navigation */}
        {step > 1 && step < 4 && (
          <div className="flex justify-between px-6 py-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleBack}
              className="text-sm"
            >
              Back
            </Button>
            {step === 2 && (
              <Button
                onClick={() => goToPreview()}
                disabled={!canProceed}
                size="sm"
              >
                Next
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
