'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Building2,
  Handshake,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  FileText,
  Settings,
  ShoppingCart,
  Sun,
  Users,
  LayoutTemplate,
  RefreshCw,
} from 'lucide-react';

import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { usePermissions } from '@/lib/permissions';
import { signOut } from '@/lib/convex/auth-client';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { OnboardingOverlay } from '@/components/onboarding/onboarding-overlay';
import { CommandPalette } from '@/components/command-palette';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Companies', href: '/companies', icon: Building2 },
  { title: 'Contacts', href: '/contacts', icon: Users },
  { title: 'Deals', href: '/deals', icon: Handshake },
  { title: 'Products', href: '/products', icon: Package },
  { title: 'Sales', href: '/sales', icon: ShoppingCart },
  { title: 'Invoices', href: '/invoices', icon: FileText },
  { title: 'Subscriptions', href: '/subscriptions', icon: RefreshCw },
  { title: 'Templates', href: '/templates', icon: LayoutTemplate },
  { title: 'Activities', href: '/activities', icon: Activity },
  { title: 'Settings', href: '/settings', icon: Settings },
];

const featureMap: Record<string, string> = {
  '/': 'dashboard',
  '/companies': 'companies',
  '/contacts': 'contacts',
  '/deals': 'deals',
  '/products': 'products',
  '/sales': 'sales',
  '/invoices': 'invoices',
  '/subscriptions': 'subscriptions',
  '/templates': 'templates',
  '/activities': 'activities',
  '/settings': 'settings',
};

function getPageTitle(pathname: string, items: typeof navItems) {
  const item = items.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );
  return item?.title ?? 'Dashboard';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const perms = usePermissions();
  const permsLoaded = Object.keys(perms).length > 0;

  // Show onboarding overlay if user is authenticated but has no active org
  // Placeholder data has id === '0', so we exclude that
  const isLoggedIn =
    user && user.id && user.id !== ('0' as any);

  const needsOnboarding = isLoggedIn && !user.activeOrganization;

  if (needsOnboarding) {
    return <OnboardingOverlay />;
  }

  const visibleNavItems = navItems.filter((item) => {
    if (!permsLoaded) return true; // Show all until permissions resolve
    const feature = featureMap[item.href];
    if (!feature) return true;
    return perms[`${feature}:view`] ?? false;
  });

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex size-8 items-center justify-center rounded-[32px] border border-[rgba(240,240,250,0.35)] bg-[rgba(240,240,250,0.1)] text-foreground">
              <Building2 className="size-4" />
            </div>
            <span className="truncate text-sm font-bold uppercase tracking-[0.96px]">
              {user?.activeOrganization?.name ?? 'CRM'}
            </span>
          </div>
          <OrganizationSwitcher />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase tracking-[1.17px]">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNavItems.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href}>
                          <item.icon />
                          <span className="uppercase tracking-[1.17px]">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          {isLoggedIn ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Avatar className="size-7">
                    <AvatarImage src={user?.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {user?.name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-medium uppercase tracking-[0.96px]">
                    {user?.name ?? 'User'}
                  </span>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun /> : <Moon />}
                  <span className="uppercase tracking-[1.17px]">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => signOut()}>
                  <LogOut />
                  <span className="uppercase tracking-[1.17px]">Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/login">
                    <LogOut style={{ transform: 'rotate(180deg)' }} />
                    <span className="uppercase tracking-[1.17px]">Sign in</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 bg-black/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-bold uppercase tracking-[0.96px]">{getPageTitle(pathname, visibleNavItems)}</h1>
        </header>
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
      <KeyboardShortcuts />
      <CommandPalette />
    </SidebarProvider>
  );
}
