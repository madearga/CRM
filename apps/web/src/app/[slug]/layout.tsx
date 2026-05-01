'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ShopNavbar } from '@/components/shop/shop-navbar';
import { ShopFooter } from '@/components/shop/shop-footer';
import { Loader2, Store, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';
import { usePublicQuery } from '@/lib/convex/hooks';

export default function ShopSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const [override, setOverride] = useState(false);

  // Single query checks org existence, products, and plugin status
  const { data: orgCheck, isLoading, error } = usePublicQuery(
    api.commerce.products.checkOrg,
    { organizationSlug: slug },
  );

  const hasOrg = !!orgCheck?.exists;
  const shopActive = orgCheck?.isActive || orgCheck?.hasProducts || override;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !orgCheck) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <AlertTriangle className="size-16 text-yellow-500" />
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">Failed to load store. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!hasOrg) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <Store className="size-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Shop Not Found</h1>
        <p className="text-muted-foreground">No store found at this address.</p>
      </div>
    );
  }

  if (!shopActive && !override) {
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
      <ShopNavbar slug={slug} />
      <main className="flex-1">{children}</main>
      <ShopFooter slug={slug} />
    </div>
  );
}
