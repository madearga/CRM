'use client';

import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { useParams } from 'next/navigation';
import { TemplateForm } from '@/components/templates/template-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditTemplatePage() {
  const params = useParams();
  const id = params.id as string;

  const { data: template, isLoading } = useAuthQuery(api.quotationTemplates.getById, { id: id as any });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!template) {
    return <div className="text-muted-foreground">Template not found.</div>;
  }

  return (
    <div className="space-y-6">
      <TemplateForm
        templateId={id}
        initialData={{
          name: template.name,
          description: template.description,
          discountAmount: template.discountAmount,
          discountType: template.discountType,
          internalNotes: template.internalNotes,
          customerNotes: template.customerNotes,
          terms: template.terms,
          currency: template.currency,
          validForDays: template.validForDays,
          isDefault: template.isDefault,
          lines: template.lines.map((l) => ({
            id: l.id,
            productName: l.productName,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            discountType: l.discountType,
            taxAmount: l.taxAmount,
            productId: l.productId,
          })),
        }}
      />
    </div>
  );
}
