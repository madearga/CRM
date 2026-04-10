'use client';

import {
  ArrowRightLeft,
  Building2,
  Calendar,
  FileText,
  Handshake,
  Mail,
  Phone,
  TrendingUp,
  Activity,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { api } from '@convex/_generated/api';
import { useAuthQuery } from '@/lib/convex/hooks';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickAddDealDialog } from './quick-add-deal-dialog';
import { STAGE_CHART_COLORS, STAGE_BAR_COLORS as STAGE_COLORS, STAGE_COLORS as STAGE_BADGE_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';

const STAGE_BADGE_VARIANTS = STAGE_BADGE_COLORS;

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  status_change: ArrowRightLeft,
};

function DashboardSkeleton() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { data, isLoading } = useAuthQuery(api.dashboard.overview, {});

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="mt-2 text-muted-foreground">
          No data yet. Start by creating deals, companies, and activities.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setShowQuickAdd(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Quick Add Deal
        </Button>
      </div>

      {/* Pipeline Value */}
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Pipeline Value
          </CardDescription>
          <CardTitle className="font-mono text-4xl">
            {formatCurrency(data.pipelineValue)}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Handshake className="h-4 w-4" />
              Total Deals
            </CardDescription>
            <Handshake className="h-5 w-5 text-muted-foreground/40" />
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="text-3xl">{data.totalDeals}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(data.pipelineValue)} pipeline
            </p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              Total Companies
            </CardDescription>
            <Building2 className="h-5 w-5 text-muted-foreground/40" />
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="text-3xl">{data.totalCompanies}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.totalCompanies > 0 ? 'Active accounts' : 'Get started'}
            </p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              Total Activities
            </CardDescription>
            <Activity className="h-5 w-5 text-muted-foreground/40" />
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="text-3xl">{data.totalActivities}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.recentActivities.length} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline by Stage */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          {data.dealsByStage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals yet</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.dealsByStage.map((s) => ({
                    stage: s.stage.charAt(0).toUpperCase() + s.stage.slice(1),
                    count: s.count,
                    value: s.value,
                  }))}
                  margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="stage" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'value' ? formatCurrency(value) : [value, 'Deals']
                    }
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Deals">
                    {data.dealsByStage.map((stage) => (
                      <Cell
                        key={stage.stage}
                        fill={STAGE_CHART_COLORS[stage.stage] ?? '#6366f1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Value summary */}
          {data.dealsByStage.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {data.dealsByStage.map((stage) => (
                <div key={stage.stage} className="rounded-lg border p-2 text-center">
                  <div
                    className={`mx-auto mb-1 h-1.5 w-8 rounded-full ${STAGE_COLORS[stage.stage] ?? 'bg-primary'}`}
                  />
                  <p className="text-xs font-medium capitalize">{stage.stage}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatCurrency(stage.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent & Upcoming Activities */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Aging Deals */}
        {data.agingDeals && data.agingDeals.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                Deals Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.agingDeals.slice(0, 5).map((deal) => (
                  <li key={deal.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 rounded-full bg-amber-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{deal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-1 text-xs capitalize">
                          {deal.stage}
                        </Badge>
                        {deal.daysInStage}d in stage
                      </p>
                    </div>
                    {deal.value != null && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatCurrency(deal.value)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activities
              </p>
            ) : (
              <ul className="space-y-3">
                {data.recentActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                  return (
                    <li
                      key={activity.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming activities
              </p>
            ) : (
              <ul className="space-y-3">
                {data.upcomingActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                  return (
                    <li
                      key={activity.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.dueAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <QuickAddDealDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} />
    </div>
  );
}
