'use client';

import { useEffect, useState } from 'react';
import { useRouter , useParams } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Save, X, Package, LogOut, Loader2 } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { useAuthQuery, useAuthMutation, useIsAuth } from '@/lib/convex/hooks';
import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { signOut } from '@/lib/convex/auth-client';
import { formatIDR } from '@/lib/commerce/format-currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function AccountPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const isAuth = useIsAuth();
  const user = useCurrentUser();
  const orgSlug = user?.activeOrganization?.slug;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Ensure customer record exists
  const registerOrLogin = useAuthMutation(api.commerce.customers.registerOrLogin);
  const { data: profile, isLoading } = useAuthQuery(
    api.commerce.customers.getProfile,
    orgSlug ? { organizationSlug: orgSlug } : 'skip',
  );

  const updateProfile = useAuthMutation(api.commerce.customers.updateProfile);

  // Trigger registration on mount
  useEffect(() => {
    if (isAuth && orgSlug) {
      registerOrLogin.mutateAsync({ organizationSlug: orgSlug } as any).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuth, orgSlug]);

  // Sync local state when profile loads
  if (profile && !editing && name !== profile.name) {
    setName(profile.name ?? '');
    setPhone(profile.phone ?? '');
    setAddress(profile.address ?? '');
    setCity(profile.city ?? '');
    setPostalCode(profile.postalCode ?? '');
  }

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Package className="mx-auto size-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Sign in to view your account</h2>
        <Button className="mt-4" onClick={() => router.push(`/shop/${slug}`)}>
          Go to Shop
        </Button>
      </div>
    );
  }

  const handleSave = async () => {
    if (!orgSlug) return;
    try {
      await updateProfile.mutateAsync({
        organizationSlug: orgSlug,
        name: name || undefined,
        phone: phone || undefined,
        address: address || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
      } as any);
      toast.success('Profile updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push(`/shop/${slug}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Account</h1>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" />
          Sign Out
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {/* Profile Card */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Profile</CardTitle>
              {!editing ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    <X className="mr-1.5 size-3.5" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 size-3.5" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{profile?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{profile?.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{profile?.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{profile?.address || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium">{profile?.city || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Postal Code</p>
                    <p className="font-medium">{profile?.postalCode || '—'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{profile?.orderCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">{formatIDR(profile?.totalSpent ?? 0)}</p>
                </div>
              </div>
              <Separator className="my-4" />
              <Link href={`/shop/${slug}/orders`}>
                <Button variant="outline" className="w-full">
                  <Package className="mr-2 size-4" />
                  View Order History
                </Button>
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}