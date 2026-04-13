'use client';

import { useState } from 'react';
import { api } from '@convex/_generated/api';
import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserPlus, MoreHorizontal, Shield, Users, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMembersTabProps {
  canManage: boolean;
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case 'owner':
      return 'default' as const;
    case 'admin':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export function TeamMembersTab({ canManage }: TeamMembersTabProps) {
  const user = useCurrentUser();
  const slug = user?.activeOrganization?.slug ?? '';

  const { data: membersData, isLoading } = useAuthQuery(
    api.organization.listMembers,
    slug ? { slug } : 'skip',
  );

  const { data: templates } = useAuthQuery(
    api.permissionTemplates.list,
    slug ? {} : 'skip',
  );

  const removeMember = useAuthMutation(api.organization.removeMember);
  const updateMemberRole = useAuthMutation(api.organization.updateMemberRole);
  const inviteMember = useAuthMutation(api.organization.inviteMember);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviteTemplateId, setInviteTemplateId] = useState<string>('');
  const [inviteSending, setInviteSending] = useState(false);

  const currentUserRole = membersData?.currentUserRole;
  const isOwner = currentUserRole === 'owner';
  const members = membersData?.members ?? [];
  const memberLimit = 5;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setInviteSending(true);
    try {
      await inviteMember.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole as 'owner' | 'member',
        roleTemplateId: inviteTemplateId ? (inviteTemplateId as any) : undefined,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('member');
      setInviteTemplateId('');
      setInviteOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send invitation');
    } finally {
      setInviteSending(false);
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    try {
      await removeMember.mutateAsync({ memberId: memberId as any });
      toast.success(`${name ?? 'Member'} removed from organization`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove member');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'owner' | 'member', name: string) => {
    try {
      await updateMemberRole.mutateAsync({
        memberId: memberId as any,
        role: newRole,
      });
      toast.success(`${name ?? 'Member'} role updated to ${newRole}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update role');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4" />
          Members ({members.length}/{memberLimit})
        </div>
        {canManage && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1 h-4 w-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="name@example.com"
                      className="pl-9"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {templates && templates.length > 0 && inviteRole === 'member' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role Template (optional)</label>
                    <Select value={inviteTemplateId} onValueChange={setInviteTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((tmpl) => (
                          <SelectItem key={tmpl._id} value={tmpl._id}>
                            {tmpl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviteSending}>
                  {inviteSending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        {members.map((member) => {
          const isMemberOwner = member.role === 'owner';
          const isCurrentUser = member.userId === user?.id;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-md p-3 hover:bg-muted/50 transition-colors"
            >
              <Avatar className="size-9">
                <AvatarImage src={member.user.image ?? undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(member.user.name, member.user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {member.user.name ?? member.user.email}
                  </span>
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {member.user.email}
                </p>
              </div>
              <Badge variant={getRoleBadgeVariant(member.role ?? 'member')}>
                {isMemberOwner && <Shield className="mr-1 size-3" />}
                {(member.role ?? 'member').charAt(0).toUpperCase() +
                  (member.role ?? 'member').slice(1)}
              </Badge>
              {canManage && !isMemberOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isOwner && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleChangeRole(
                            member.id,
                            'owner',
                            member.user.name ?? member.user.email,
                          )
                        }
                      >
                        Change to Owner
                      </DropdownMenuItem>
                    )}
                    {isOwner && <DropdownMenuSeparator />}
                    {!isCurrentUser && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          handleRemoveMember(
                            member.id,
                            member.user.name ?? member.user.email,
                          )
                        }
                      >
                        Remove from Organization
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No members found.
          </div>
        )}
      </div>
    </div>
  );
}
