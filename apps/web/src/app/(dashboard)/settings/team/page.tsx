'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentUser } from '@/lib/convex/hooks/useCurrentUser';
import { TeamMembersTab } from '@/components/team/team-members-tab';
import { TeamInvitationsTab } from '@/components/team/team-invitations-tab';
import { TeamInviteLinkTab } from '@/components/team/team-invite-link-tab';
import { TeamRolesTab } from '@/components/team/team-roles-tab';

const subTabs = [
  { value: 'members', label: 'Members' },
  { value: 'invitations', label: 'Invitations' },
  { value: 'invite-link', label: 'Invite Link' },
  { value: 'roles', label: 'Roles & Permissions' },
];

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState('members');
  const user = useCurrentUser();
  const isOwner = user?.activeOrganization?.role === 'owner';
  const isAdmin = user?.activeOrganization?.role === 'admin';
  const canManage = isOwner || isAdmin;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {subTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="members" className="mt-4">
        <TeamMembersTab canManage={canManage} />
      </TabsContent>

      <TabsContent value="invitations" className="mt-4">
        <TeamInvitationsTab canManage={canManage} />
      </TabsContent>

      <TabsContent value="invite-link" className="mt-4">
        <TeamInviteLinkTab />
      </TabsContent>

      <TabsContent value="roles" className="mt-4">
        <TeamRolesTab />
      </TabsContent>
    </Tabs>
  );
}
