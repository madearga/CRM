'use client';

import { use } from 'react';
import { PricelistForm } from '@/components/pricelists/pricelist-form';

export default function PricelistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PricelistForm pricelistId={id} />;
}
