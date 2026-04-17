'use client';

import dynamic from 'next/dynamic';

const InvoiceForm = dynamic(
  () => import('@/components/invoices/invoice-form').then(m => ({ default: m.InvoiceForm })),
  { loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div> }
);

export default function NewInvoicePage() {
  return (
    <div className="container mx-auto py-6">
      <InvoiceForm />
    </div>
  );
}
