'use client';

import { useAuthQuery, useAuthMutation } from '@/lib/convex/hooks';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Building2, Globe, MapPin, Users, Handshake, Activity, Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { STATUS_COLORS } from '@/lib/constants';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: company, isLoading } = useAuthQuery(api.companies.getById, { id: id as any });
  const { data: activities } = useAuthQuery(
    api.activities.listByEntity,
    company ? { entityType: 'company', entityId: id } : 'skip'
  );
  const archiveCompany = useAuthMutation(api.companies.archive);
  const restoreCompany = useAuthMutation(api.companies.restore);

  const handleArchive = async () => {
    try {
      await archiveCompany.mutateAsync({ id: id as any });
      toast.success('Company archived');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to archive');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreCompany.mutateAsync({ id: id as any });
      toast.success('Company restored');
    } catch (e: any) {
      toast.error(e.data?.message ?? 'Failed to restore');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-muted-foreground">Company not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/companies')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/companies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{company.name}</h2>
            {company.archivedAt && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">Archived</Badge>
            )}
          </div>
        </div>
        {company.archivedAt ? (
          <Button variant="outline" size="sm" onClick={handleRestore}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Restore
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleArchive}>
            <Archive className="mr-1 h-4 w-4" />
            Archive
          </Button>
        )}
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {company.website && (
              <div className="flex items-start gap-2">
                <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    {company.website}
                  </a>
                </div>
              </div>
            )}
            {company.industry && (
              <div>
                <p className="text-xs text-muted-foreground">Industry</p>
                <p className="text-sm">{company.industry}</p>
              </div>
            )}
            {company.size && (
              <div>
                <p className="text-xs text-muted-foreground">Size</p>
                <p className="text-sm">{company.size}</p>
              </div>
            )}
            {company.country && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Country</p>
                  <p className="text-sm">{company.country}</p>
                </div>
              </div>
            )}
            {company.status && (
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="secondary" className={STATUS_COLORS[company.status]}>
                  {company.status}
                </Badge>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Contacts</p>
                <p className="text-sm font-mono">{company.contactsCount}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Handshake className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Deals</p>
                <p className="text-sm font-mono">{company.dealsCount}</p>
              </div>
            </div>
          </div>
          {company.notes && (
            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{company.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Activities */}
      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Activities
          </TabsTrigger>
        </TabsList>
        <TabsContent value="activities" className="mt-4">
          {!activities?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center py-8">
                <Activity className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No activities yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activities.map((activity: any) => (
                <div key={activity._id} className="flex items-start gap-3 rounded-md border p-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity._creationTime), { addSuffix: true })}
                    </p>
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
