'use client';

import { useMemo, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  LogOut,
  Moon,
  Search,
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
import { ErrorBoundary } from '@/components/error-boundary';



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

  const openCommandPalette = () => {
    window.dispatchEvent(new Event('open-command-palette'));
  };

  // AI Chat (owner only)
  const isOwner = user?.activeOrganization?.role === 'owner';
  const aiChat = useAiChat();

  if (needsOnboarding) {
    return <OnboardingOverlay />;
  }



  return (
    <SidebarProvider
      style={{
        '--sidebar-width': '17rem',
        '--sidebar-width-icon': '3.5rem',
        '--sidebar': 'oklch(12% 0.005 260)',
        '--sidebar-foreground': 'rgba(240,240,250,0.88)',
        '--sidebar-primary': '#f0f0fa',
        '--sidebar-primary-foreground': 'oklch(12% 0.005 260)',
        '--sidebar-accent': 'rgba(240,240,250,0.06)',
        '--sidebar-accent-foreground': 'rgba(240,240,250,0.88)',
        '--sidebar-border': 'rgba(240,240,250,0.08)',
        '--sidebar-ring': 'rgba(240,240,250,0.2)',
      } as React.CSSProperties}
    >
      <Sidebar>
        <SidebarHeader className="gap-2 p-4 pb-3">
          <div className="flex items-center gap-3 px-1 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-foreground">
              <Building2 className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">
                {user?.activeOrganization?.name ?? 'CRM'}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/50">
                Workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg bg-sidebar-accent px-3 text-left text-[13px] text-sidebar-foreground/50 transition-all duration-150 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring active:scale-[0.98]"
          >
            <Search className="size-3.5 shrink-0" />
            <span className="truncate">Find anything</span>
            <kbd className="ml-auto hidden rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/40 md:inline-flex">
              ⌘K
            </kbd>
          </button>
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

        <SidebarFooter className="border-t border-sidebar-border/50 p-3">
          {isLoggedIn ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Avatar className="size-7 rounded-lg">
                  <AvatarImage src={user?.image ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {user?.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase() ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-[13px] font-medium text-sidebar-foreground">
                  {user?.name ?? 'User'}
                </span>
              </div>
              <div className="flex gap-1">
                <SidebarMenuButton
                  className="h-8 flex-1 rounded-lg text-[12px] active:scale-[0.97]"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                  <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </SidebarMenuButton>
                <SidebarMenuButton
                  className="h-8 flex-1 rounded-lg text-[12px] active:scale-[0.97]"
                  onClick={() => signOut()}
                >
                  <LogOut className="size-3.5" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </div>
            </div>
          ) : (
            <SidebarMenuButton
              asChild
              className="h-8 w-full rounded-lg active:scale-[0.97]"
            >
              <Link href="/login">
                <LogOut className="size-3.5" style={{ transform: 'rotate(180deg)' }} />
                <span>Sign in</span>
              </Link>
            </SidebarMenuButton>
          )}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border/40 px-4">
          <SidebarTrigger className="size-8 rounded-lg active:scale-[0.97]" />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-[13px] font-medium tracking-tight text-foreground/70">
            {getPageTitle(pathname, pluginNavItems)}
          </h1>
        </header>
        <main className="flex-1 p-4">
          <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
            <ErrorBoundary>{children}</ErrorBoundary>
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
