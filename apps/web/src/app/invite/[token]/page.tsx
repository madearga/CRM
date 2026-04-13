'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@convex/_generated/api';
import { usePublicQuery, useAuthMutation, useIsAuth } from '@/lib/convex/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  LogIn,
  Shield,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function InviteJoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const isAuth = useIsAuth(true);

  const { data, isLoading, isError } = usePublicQuery(
    api.inviteLinks.getByToken,
    token ? { token } : 'skip',
    {},
  );

  const joinLink = useAuthMutation(api.inviteLinks.joinViaLink);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = async () => {
    setJoinError(null);
    try {
      const result = await joinLink.mutateAsync({ token });
      setJoined(true);
      toast.success(`You've joined ${result.organizationName}!`);
    } catch (err: any) {
      const msg = err?.message ?? err?.data?.message ?? 'Failed to join organization';
      setJoinError(msg);
      toast.error(msg);
    }
  };

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Invalid / Error state ---
  if (isError || !data) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-7 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Invalid Invite Link</h2>
            <p className="text-sm text-muted-foreground">
              This invite link doesn&apos;t exist or has been removed.
            </p>
            <Button variant="outline" asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Expired ---
  if (data.isExpired) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
              <Clock className="size-7 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold">Invite Link Expired</h2>
            <p className="text-sm text-muted-foreground">
              This invite link for <strong>{data.organizationName}</strong> has expired.
              Please request a new one.
            </p>
            <Button variant="outline" asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Not valid (revoked etc.) ---
  if (!data.isValid) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-7 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Invite Link Unavailable</h2>
            <p className="text-sm text-muted-foreground">
              This invite link for <strong>{data.organizationName}</strong> has been revoked
              or is no longer valid.
            </p>
            <Button variant="outline" asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Successfully joined ---
  if (joined) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="size-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold">Welcome aboard!</h2>
            <p className="text-sm text-muted-foreground">
              You&apos;ve successfully joined <strong>{data.organizationName}</strong>.
            </p>
            <Button asChild>
              <Link href="/settings/team">Go to Team</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const daysUntilExpiry = Math.ceil(
    (data.expiresAt - Date.now()) / (1000 * 60 * 60 * 24),
  );

  // --- Not authenticated ---
  if (!isAuth) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            {data.organizationLogo ? (
              <Avatar className="size-16">
                <AvatarImage src={data.organizationLogo} />
                <AvatarFallback>
                  <Building2 className="size-7" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="size-7 text-primary" />
              </div>
            )}
            <CardTitle className="mt-2">
              You&apos;ve been invited to join {data.organizationName}
            </CardTitle>
            <CardDescription className="flex flex-col items-center gap-2">
              <Badge variant="secondary">
                <Shield className="mr-1 size-3" />
                {data.roleName}
              </Badge>
              {daysUntilExpiry <= 3 && daysUntilExpiry > 0 && (
                <span className="text-xs text-orange-600 dark:text-orange-400">
                  Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Separator className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Sign in to accept this invitation and join the team.
            </p>
            <Button className="w-full" asChild>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
              >
                <LogIn className="mr-2 size-4" />
                Sign in to Join
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Authenticated, can join ---
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          {data.organizationLogo ? (
            <Avatar className="size-16">
              <AvatarImage src={data.organizationLogo} />
              <AvatarFallback>
                <Building2 className="size-7" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="size-7 text-primary" />
            </div>
          )}
          <CardTitle className="mt-2">
            Join {data.organizationName}
          </CardTitle>
          <CardDescription className="flex flex-col items-center gap-2">
            <Badge variant="secondary">
              <Shield className="mr-1 size-3" />
              {data.roleName}
            </Badge>
            {daysUntilExpiry <= 3 && daysUntilExpiry > 0 && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Separator className="w-full" />
          <p className="text-sm text-muted-foreground text-center">
            You&apos;ll be added as <strong>{data.roleName}</strong> to{' '}
            <strong>{data.organizationName}</strong>.
          </p>
          {joinError && (
            <div className="w-full rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
              {joinError}
            </div>
          )}
          <Button
            className="w-full"
            onClick={handleJoin}
            disabled={joinLink.isPending}
          >
            <UserPlus className="mr-2 size-4" />
            {joinLink.isPending ? 'Joining...' : 'Join Organization'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
