import { QueryClientProvider } from '@/lib/react-query/query-client-provider';
import { ConvexProvider } from '@/lib/convex/components/convex-provider';
import { getSessionToken } from '@/lib/convex/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';

export async function Providers({ children }) {
  const token = await getSessionToken();

  return (
    <ConvexProvider token={token}>
      <QueryClientProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </ConvexProvider>
  );
}
