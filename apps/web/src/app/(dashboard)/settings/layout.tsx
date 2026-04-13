'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/convex/hooks';

const tabs = [
  { title: 'General', href: '/settings/general' },
  { title: 'Team', href: '/settings/team', ownerOnly: true },
  { title: 'Pricelists', href: '/settings/pricelists' },
  { title: 'Reminder Rules', href: '/settings/reminder-rules' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useCurrentUser();

  // Filter tabs by permission (Team tab only for owner/admin for now)
  const visibleTabs = tabs.filter((tab) => {
    if (tab.ownerOnly) {
      return user?.activeOrganization?.role === 'owner' || user?.activeOrganization?.role === 'admin';
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
