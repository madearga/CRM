'use client';

import dynamic from 'next/dynamic';

const SaleOrderForm = dynamic(
  () => import('@/components/sales/sale-order-form').then(m => ({ default: m.SaleOrderForm })),
  { loading: () => <div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div> }
);

export default function NewSaleOrderPage() {
  return <SaleOrderForm />;
}
