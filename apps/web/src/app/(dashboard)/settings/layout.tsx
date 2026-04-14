'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/convex/hooks';
import { usePermissions } from '@/lib/permissions';

const tabs = [
  { title: 'General', href: '/settings/general', feature: 'settings' },
  { title: 'Team', href: '/settings/team', feature: 'team' },
  { title: 'Recurring Invoices', href: '/settings/recurring-invoices', feature: 'settings' },
  { title: 'Pricelists', href: '/settings/pricelists', feature: 'settings'},
  { title: 'Reminder Rules', href: '/settings/reminder-rules', feature: 'settings' },
  { title: 'Shop', href: '/settings/shop', feature: 'settings' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const perms = usePermissions();

  // Filter tabs by permission
  const visibleTabs = tabs.filter((tab) => {
    if (tab.feature) {
      return perms[`${tab.feature}:view`] ?? false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="border-b">
        <nav className="flex gap-4">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(tab.href)
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.title}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}