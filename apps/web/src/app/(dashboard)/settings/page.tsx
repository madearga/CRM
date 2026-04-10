'use client';

import { useState } from 'react';
import { useCurrentUser } from '@/lib/convex/hooks';
import { useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Settings, User, Building2, Save, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const user = useCurrentUser();
  const [editing, setEditing] = useState<'profile' | 'org' | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '' });
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' });

  const updateProfile = useAuthMutation(api.user.updateSettings);
  const updateOrg = useAuthMutation(api.organization.updateOrganization);

  const startEditProfile = () => {
    if (user) {
      setProfileForm({ name: user.name ?? '' });
      setEditing('profile');
    }
  };

  const startEditOrg = () => {
    if (user?.activeOrganization) {
      setOrgForm({ name: user.activeOrganization.name ?? '', slug: user.activeOrganization.slug ?? '' });
      setEditing('org');
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name: profileForm.name || undefined });
      toast.success('Profile updated');
      setEditing(null);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to update profile');
    }
  };

  const handleSaveOrg = async () => {
    try {
      await updateOrg.mutateAsync({
        name: orgForm.name || undefined,
        slug: orgForm.slug || undefined,
      });
      toast.success('Organization updated');
      setEditing(null);
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to update organization');
    }
  };

  if (!user || user.id === '0') {
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </div>
            {editing !== 'profile' && (
              <Button variant="outline" size="sm" onClick={startEditProfile}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing === 'profile' ? (
            <div className="space-y-4">
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
              </div>
              <div className="max-w-md space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">
                    Managed by your auth provider (Google).
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    Save Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
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
                {user.image && <p className="text-xs text-muted-foreground">Signed in with Google</p>}
                <div className="mt-1 flex items-center gap-2">
                  {user.isAdmin && (
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                      Admin
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Workspace
              </CardTitle>
              <CardDescription>Current organization settings</CardDescription>
            </div>
            {editing !== 'org' && user.activeOrganization?.role === 'owner' && (
              <Button variant="outline" size="sm" onClick={startEditOrg}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {user.activeOrganization ? (
            editing === 'org' ? (
              <div className="max-w-md space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Organization Name</label>
                  <Input
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    placeholder="Organization name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Slug</label>
                  <Input
                    value={orgForm.slug}
                    onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })}
                    placeholder="org-slug"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveOrg} disabled={updateOrg.isPending}>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    Save Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{user.activeOrganization.name}</p>
                  <Badge variant="secondary" className="capitalize">{user.activeOrganization.role ?? 'member'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Slug: {user.activeOrganization.slug}
                </p>
              </div>
            )
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
