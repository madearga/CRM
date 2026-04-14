'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { useAuthMutation, usePublicMutation, useIsAuth } from '@/lib/convex/hooks';
import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { Card, CardContent } from '@/components/ui/card';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuth = useIsAuth();
  const user = useCurrentUser();
  const orgSlug = user?.activeOrganization?.slug;

  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  const registerOrLogin = useAuthMutation(api.commerce.customers.registerOrLogin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergeGuestCart = usePublicMutation(api.commerce.cart.mergeGuestCart as any);

  // Determine redirect destination
  const redirectTo = searchParams.get('redirect') || '/shop/account';
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('shop_session_id')
    : null;

  useEffect(() => {
    if (!isAuth || !orgSlug) return;

    let cancelled = false;

    async function processAuth() {
      try {
        // 1. Register/link customer record
        await registerOrLogin.mutateAsync({ organizationSlug: orgSlug } as any);

        // 2. Merge guest cart if session exists
        if (sessionId) {
          try {
            await mergeGuestCart.mutateAsync({
              organizationSlug: orgSlug,
              sessionId,
            } as any);
            localStorage.removeItem('shop_session_id');
          } catch {
            // Cart merge failure is non-fatal
          }
        }

        if (!cancelled) {
          router.push(redirectTo);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to complete login. Please try again.');
          setProcessing(false);
        }
      }
    }

    processAuth();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuth, orgSlug]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-semibold text-destructive">Login Error</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              className="mt-4 text-sm text-blue-600 underline"
              onClick={() => router.push('/shop')}
            >
              Return to Shop
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
      <p className="mt-4 font-medium">Completing sign in...</p>
      <p className="mt-1 text-sm text-muted-foreground">Setting up your account</p>
    </div>
  );
}