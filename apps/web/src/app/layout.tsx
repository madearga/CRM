import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { BreadcrumbNav } from '@/components/breadcrumb-nav';

export const metadata: Metadata = {
  title: 'Ruang',
  description: 'Ruang kerja untuk orang dan agen',
};

// viewport-fit=cover turns on env(safe-area-inset-*) on notched phones, and
// interactive-widget resizes the layout when the keyboard opens, so the
// composer is never left under the keyboard.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#0b0b10',
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
