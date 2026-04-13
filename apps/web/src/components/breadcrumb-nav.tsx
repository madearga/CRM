'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  LogOut,
  LogIn,
} from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/lib/convex/hooks';
import { signOut } from '@/lib/convex/auth-client';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';

export function BreadcrumbNav() {
  const pathname = usePathname();
  const user = useCurrentUser();

  // Parse the pathname into segments
  const segments = pathname.split('/').filter(Boolean);

  // Generate breadcrumb items
  const breadcrumbItems: React.ReactNode[] = [];

  // Always add home
  if (pathname === '/') {
    breadcrumbItems.push(
      <BreadcrumbItem key="home">
        <BreadcrumbPage className="flex items-center gap-1">
          <Home className="h-4 w-4" />
          <span>Dashboard</span>
        </BreadcrumbPage>
      </BreadcrumbItem>
    );
  } else {
    breadcrumbItems.push(
      <BreadcrumbItem key="home">
        <BreadcrumbLink asChild>
          <Link href="/" className="flex items-center gap-1">
            <Home className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
    );
  }

  // Add separator after home if there are segments
  if (segments.length > 0) {
    breadcrumbItems.push(<BreadcrumbSeparator key="home-separator" />);
  }

  // Add each segment
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    const href = '/' + segments.slice(0, index + 1).join('/');

    // Format segment name
    let displayName = segment.charAt(0).toUpperCase() + segment.slice(1);
    // Handle IDs — just show a shortened version
    if (segment.match(/^[a-z0-9]{20,}$/)) {
      displayName = '...';
    }

    if (isLast) {
      breadcrumbItems.push(
        <BreadcrumbItem key={segment}>
          <BreadcrumbPage>{displayName}</BreadcrumbPage>
        </BreadcrumbItem>
      );
    } else {
      breadcrumbItems.push(
        <BreadcrumbItem key={segment}>
          <BreadcrumbLink asChild>
            <Link href={href}>{displayName}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
      );
      breadcrumbItems.push(
        <BreadcrumbSeparator key={`${segment}-separator`} />
      );
    }
  });

  return (
    <div className="border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Breadcrumbs */}
          <Breadcrumb>
            <BreadcrumbList>{breadcrumbItems}</BreadcrumbList>
          </Breadcrumb>

          {/* Right side - Organization Switcher & Auth */}
          <div className="flex items-center gap-2">
            {user && user.id && user.id !== '0' ? (
              <>
                <OrganizationSwitcher />
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </>
            ) : user?.id === '0' ? (
              // Loading state — show placeholder
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
