'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShopNavbar } from '@/components/shop/shop-navbar';
import { ShopFooter } from '@/components/shop/shop-footer';
import { Loader2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';
import { useAuthQuery } from '@/lib/convex/hooks';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: config, isLoading } = useAuthQuery(api.commerce.shopSettings.getShopConfig, {});
  const [override, setOverride] = useState(false);

  // Allow admin to preview shop even when inactive
  const shopActive = config?.isActive || override;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!shopActive && config && !override) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <Store className="size-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Shop Coming Soon</h1>
        <p className="text-muted-foreground">This store is not available yet.</p>
        <Button variant="outline" onClick={() => setOverride(true)} className="text-xs">
          Preview as Admin
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ShopNavbar />
      <main className="flex-1">{children}</main>
      <ShopFooter />
    </div>
  );
}
