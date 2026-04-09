'use client';

import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, Mail, Phone, Building2, Handshake, Activity, Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

const LIFECYCLE_COLORS: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700',
  prospect: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
  churned: 'bg-red-100 text-red-700',
};

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: contact, isLoading } = useAuthQuery(api.contacts.getById, { id: id as any });
  const { data: activities } = useAuthQuery(
    api.activities.listByEntity,
    contact ? { entityType: 'contact', entityId: id } : 'skip'
  );
  const archiveContact = useAuthMutation(api.contacts.archive);
  const restoreContact = useAuthMutation(api.contacts.restore);

  const handleArchive = async () => {
    try {
      await archiveContact.mutateAsync({ id: id as any });
      toast.success('Contact archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreContact.mutateAsync({ id: id as any });
      toast.success('Contact restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Users className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Contact not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/contacts')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/contacts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{contact.fullName}</h2>
            {contact.archivedAt && <Badge variant="secondary" className="bg-gray-100 text-gray-600">Archived</Badge>}
          </div>
        </div>
        {contact.archivedAt ? (
          <Button variant="outline" size="sm" onClick={handleRestore}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleArchive}><Archive className="mr-1 h-4 w-4" />Archive</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Contact Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline">{contact.email}</a>
              </div>
            </div>
            {contact.phone && (
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm">{contact.phone}</p>
                </div>
              </div>
            )}
            {contact.companyName && (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  {contact.companyId ? (
                    <Link href={`/companies/${contact.companyId}`} className="text-sm text-blue-600 hover:underline">
                      {contact.companyName}
                    </Link>
                  ) : (
                    <p className="text-sm">{contact.companyName}</p>
                  )}
                </div>
              </div>
            )}
            {contact.jobTitle && (
              <div>
                <p className="text-xs text-muted-foreground">Job Title</p>
                <p className="text-sm">{contact.jobTitle}</p>
              </div>
            )}
            {contact.lifecycleStage && (
              <div>
                <p className="text-xs text-muted-foreground">Stage</p>
                <Badge variant="secondary" className={LIFECYCLE_COLORS[contact.lifecycleStage]}>
                  {contact.lifecycleStage}
                </Badge>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Handshake className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Deals</p>
                <p className="text-sm font-mono">{contact.dealCount}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Touch</p>
              {contact.lastTouchedDays !== null ? (
                <Badge variant={contact.lastTouchStatus === 'green' ? 'secondary' : 'destructive'} className="text-xs">
                  {contact.lastTouchedDays}d ago
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Never</span>
              )}
            </div>
          </div>
          {contact.notes && (
            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{contact.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities" className="flex items-center gap-1"><Activity className="h-4 w-4" />Activities</TabsTrigger>
        </TabsList>
        <TabsContent value="activities" className="mt-4">
          {!activities?.length ? (
            <Card><CardContent className="flex flex-col items-center py-8">
              <Activity className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No activities yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {activities.map((activity: any) => (
                <div key={activity._id} className="flex items-start gap-3 rounded-md border p-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    {activity.description && <p className="text-xs text-muted-foreground">{activity.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{activity.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
