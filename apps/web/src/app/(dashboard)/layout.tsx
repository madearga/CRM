'use client';

import Link from 'next/link';
import { useMemo, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import {
  Building2,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';

import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { usePermissionsWithStatus } from '@/lib/permissions';
import { useAuthQuery } from '@/lib/convex/hooks';
import { PLUGINS } from '@/lib/plugins/registry';
import { NavGroup } from '@/components/sidebar/nav-group';
import { navGroups, featureMap, getPageTitle } from '@/lib/navigation';
import { api } from '@convex/_generated/api';
import { signOut } from '@/lib/convex/auth-client';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { OnboardingOverlay } from '@/components/onboarding/onboarding-overlay';
import { CommandPalette } from '@/components/command-palette';
import { ChatPanel } from '@/components/ai-chat/chat-panel';
import { ChatToggle } from '@/components/ai-chat/chat-toggle';
import { useAiChat } from '@/hooks/use-ai-chat';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';



export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { perms, isLoading: permsLoading } = usePermissionsWithStatus();
  const permsLoaded = !permsLoading;

  // Plugin nav items
  const { data: activePluginIds } = useAuthQuery(api.plugins.getActive, {});
  const pluginNavItems = useMemo(() => {
    if (!activePluginIds || activePluginIds.length === 0) return [];
    return activePluginIds.flatMap((pluginId: string) => {
      const plugin = PLUGINS.find((p) => p.id === pluginId);
      if (!plugin) return [];
      return plugin.navItems.map((item) => ({
        title: item.label,
        href: item.href,
        icon: item.icon,
      }));
    });
  }, [activePluginIds]);

  // Show onboarding overlay if user is authenticated but has no active org
  // Placeholder data has id === '0', so we exclude that
  const isLoggedIn = Boolean(user?.id && String(user.id) !== '0');

  // Memoize filtered nav groups so NavGroup receives stable item references
  const visibleNavGroups = useMemo(() => {
    return navGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!permsLoaded) return true;
        const feature = featureMap[item.href];
        if (!feature) return true;
        return perms[`${feature}:view`] ?? false;
      }),
    })).filter((group) => group.items.length > 0);
  }, [permsLoaded, perms]);

  const needsOnboarding = isLoggedIn && !user.activeOrganization;

  // AI Chat (owner only)
  const isOwner = user?.activeOrganization?.role === 'owner';
  const aiChat = useAiChat();

  if (needsOnboarding) {
    return <OnboardingOverlay />;
  }



  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex size-8 items-center justify-center rounded-[32px] border border-[rgba(240,240,250,0.35)] bg-[rgba(240,240,250,0.1)] text-foreground">
              <Building2 className="size-4" />
            </div>
            <span className="truncate text-sm font-semibold">
              {user?.activeOrganization?.name ?? 'CRM'}
            </span>
          </div>
          <OrganizationSwitcher />
        </SidebarHeader>

        <SidebarContent>
          {visibleNavGroups.map((group) => (
            <NavGroup
              key={group.id}
              label={group.label}
              icon={group.icon}
              items={group.items}
              defaultOpen={group.defaultOpen}
            />
          ))}

          {/* Plugin items grouped for consistent UX */}
          {pluginNavItems.length > 0 && (
            <NavGroup
              key="plugins"
              label="Integrations"
              items={pluginNavItems}
              defaultOpen={false}
            />
          )}
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
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/login">
                    <LogOut style={{ transform: 'rotate(180deg)' }} />
                    <span>Sign in</span>
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
          <h1 className="text-sm font-semibold">{getPageTitle(pathname, pluginNavItems)}</h1>
        </header>
        <main className="flex-1 p-4">
          <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
            {children}
          </Suspense>
        </main>
      </SidebarInset>
      <KeyboardShortcuts />
      <CommandPalette />

      {/* AI Chat Assistant - Owner Only */}
      {isOwner && (
        <>
          <ChatToggle onClick={aiChat.togglePanel} isOpen={aiChat.isOpen} />
          <ChatPanel
            messages={aiChat.messages}
            isLoading={aiChat.isLoading}
            isOpen={aiChat.isOpen}
            onClose={aiChat.togglePanel}
            onSend={aiChat.sendMessage}
            conversations={aiChat.conversations}
            currentConversationId={aiChat.currentConversationId}
            onSelectConversation={aiChat.selectConversation}
            onNewConversation={aiChat.newConversation}
          />
        </>
      )}
    </SidebarProvider>
  );
}
