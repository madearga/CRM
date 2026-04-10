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
  Settings,
  Sun,
  Users,
} from 'lucide-react';

import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { signOut } from '@/lib/convex/auth-client';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
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
  { title: 'Activities', href: '/activities', icon: Activity },
  { title: 'Settings', href: '/settings', icon: Settings },
];

function getPageTitle(pathname: string) {
  const item = navItems.find((item) =>
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

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <span className="truncate text-sm font-semibold">
              {user?.activeOrganization?.name ?? 'CRM'}
            </span>
          </div>
          <OrganizationSwitcher />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
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
                <span className="flex-1 truncate text-sm font-medium">
                  {user?.name ?? 'User'}
                </span>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun /> : <Moon />}
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => signOut()}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-semibold">{getPageTitle(pathname)}</h1>
        </header>
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
      <KeyboardShortcuts />
      <CommandPalette />
    </SidebarProvider>
  );
}
