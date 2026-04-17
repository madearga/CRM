'use client';

import { useParams } from 'next/navigation';
import { useAuthQuery } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import dynamic from 'next/dynamic';

const InvoiceForm = dynamic(
  () => import('@/components/invoices/invoice-form').then(m => ({ default: m.InvoiceForm })),
  { loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div> }
);
import { Skeleton } from '@/components/ui/skeleton';

export default function EditInvoicePage() {
  const params = useParams();
  const id = params.id as string;

  const { data: invoice, isLoading } = useAuthQuery(api.invoices.getById, { id: id as any });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!invoice) {
    return <div>Invoice not found</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <InvoiceForm invoiceId={id} initialData={invoice} />
    </div>
  );
}
