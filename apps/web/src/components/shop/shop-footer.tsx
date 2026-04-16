import Link from 'next/link';

interface ShopFooterProps {
  slug?: string;
  storeName?: string;
}

export function ShopFooter({ storeName = 'Store' }: ShopFooterProps) {
  const footerLinks = [
    { label: 'About', href: '/about' },
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between md:px-6">
        <div className="flex flex-col items-center gap-1 md:items-start">
          <p className="text-sm font-semibold">{storeName}</p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
        </div>
        <nav className="flex gap-4">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
