'use client';

import { useCurrentUser } from '@/lib/convex/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, User, Building2 } from 'lucide-react';

export default function SettingsPage() {
  const user = useCurrentUser();

  if (!user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="text-lg">
                {user.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.name || 'User'}</p>
              {user.isAdmin && (
                <Badge variant="secondary" className="mt-1">
                  Admin
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Workspace
          </CardTitle>
          <CardDescription>Current organization settings</CardDescription>
        </CardHeader>
        <CardContent>
          {user.activeOrganization ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{user.activeOrganization.name}</p>
                <Badge variant="secondary">{user.activeOrganization.role ?? 'member'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Slug: {user.activeOrganization.slug}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active workspace</p>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>CRM v0.0.1</p>
            <p>Built with Convex + Better Auth + Next.js</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
