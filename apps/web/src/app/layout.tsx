import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { BreadcrumbNav } from '@/components/breadcrumb-nav';

export const metadata: Metadata = {
  title: 'CRM',
  description: 'Personal CRM built with Convex',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <BreadcrumbNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
