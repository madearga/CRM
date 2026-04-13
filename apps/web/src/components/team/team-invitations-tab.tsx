'use client';

import { api } from '@convex/_generated/api';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Mail, X, Users } from 'lucide-react';
import { toast } from 'sonner';

interface TeamInvitationsTabProps {
  canManage: boolean;
}

function getDaysRemaining(expiresAt: number): number {
  const now = Date.now();
  const diff = expiresAt - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function TeamInvitationsTab({ canManage }: TeamInvitationsTabProps) {
  const user = useCurrentUser();
  const slug = user?.activeOrganization?.slug ?? '';

  const { data: invitations, isLoading } = useAuthQuery(
    api.organization.listPendingInvitations,
    slug ? { slug } : 'skip',
  );

  const cancelInvitation = useAuthMutation(api.organization.cancelInvitation);

  const pendingInvitations = invitations ?? [];

  const handleCancel = async (invitationId: string, email: string) => {
    try {
      await cancelInvitation.mutateAsync({ invitationId: invitationId as any });
      toast.success(`Invitation to ${email} cancelled`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to cancel invitation');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-48" />
        </div>
        <Separator />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="size-9 rounded-full bg-muted flex items-center justify-center">
              <Mail className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="size-4" />
        Pending Invitations ({pendingInvitations.length})
      </div>

      <Separator />

      {pendingInvitations.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No pending invitations
        </div>
      ) : (
        <div className="space-y-1">
          {pendingInvitations.map((invitation) => {
            const daysLeft = getDaysRemaining(invitation.expiresAt);

            return (
              <div
                key={invitation.id}
                className="flex items-center gap-3 rounded-md p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {invitation.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {daysLeft > 0
                      ? `Expires in ${daysLeft}d`
                      : 'Expired'}
                  </div>
                </div>
                <Badge variant="outline">
                  {invitation.role.charAt(0).toUpperCase() +
                    invitation.role.slice(1)}
                </Badge>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                      handleCancel(invitation.id, invitation.email)
                    }
                    disabled={cancelInvitation.isPending}
                  >
                    <X className="mr-1 size-3" />
                    Cancel
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
