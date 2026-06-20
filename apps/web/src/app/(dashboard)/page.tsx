'use client';

import {
  ArrowRightLeft,
  Calendar,
  FileText,
  Handshake,
  Mail,
  Phone,
  TrendingUp,
  AlertTriangle,
  Plus,
  DollarSign,
  Target,
  BarChart3,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow, format } from '@/lib/format-date';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const RevenueChart = dynamic(
  () => import('./revenue-chart').then((m) => ({ default: m.RevenueChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
    ),
  }
);
const PipelineChart = dynamic(() => import('./pipeline-chart'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
  ),
});

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import {
  useDashboardParams,
  type DateRange,
} from '@/hooks/use-dashboard-params';
import { QuickAddDealDialog } from './quick-add-deal-dialog';
import { InsightsWidget } from '@/components/insights-widget';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0)
    return <span className="text-xs text-muted-foreground">0%</span>;
  const positive = value > 0;
  return (
    <span
      className={`text-xs font-medium ${positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
    >
      {positive ? '+' : ''}
      {value}%
    </span>
  );
}

function SkeletonDashboard() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function DashboardEmptyState({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action: { label: string; href: string };
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      }
    />
  );
}

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  status_change: ArrowRightLeft,
};

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { range, setRange } = useDashboardParams();

  // Fetch all analytics data
  const { data: overview, isLoading: overviewLoading } = useAuthQuery(
    api.dashboard.overview,
    {}
  );
  const { data: revenueData, isLoading: revenueLoading } = useAuthQuery(
    api.analytics.revenueByMonth,
    {}
  );
  const { data: salesData, isLoading: salesLoading } = useAuthQuery(
    api.analytics.salesPerformance,
    {}
  );
  const { data: forecastData, isLoading: forecastLoading } = useAuthQuery(
    api.analytics.pipelineForecast,
    {}
  );
  const { data: agingData, isLoading: agingLoading } = useAuthQuery(
    api.analytics.invoiceAging,
    {}
  );
  const { data: topProductsData, isLoading: productsLoading } = useAuthQuery(
    api.analytics.topProducts,
    {}
  );
  const { data: comparisonData, isLoading: comparisonLoading } = useAuthQuery(
    api.analytics.monthlyComparison,
    {}
  );
  const { data: analyticsOverview } = useAuthQuery(
    api.analytics.getOverview,
    {}
  );

  const isLoading =
    overviewLoading ||
    revenueLoading ||
    salesLoading ||
    forecastLoading ||
    agingLoading ||
    productsLoading ||
    comparisonLoading ||
    analyticsOverview === undefined;

  if (isLoading) return <SkeletonDashboard />;

  if (!overview) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="mt-2 text-muted-foreground">
          No data yet. Start by creating deals, companies, and activities.
        </p>
      </div>
    );
  }

  const activePipelineValue = overview.dealsByStage
    .filter((s) => s.stage !== 'won' && s.stage !== 'lost')
    .reduce((sum, s) => sum + s.value, 0);

  const wonDealsMonth = comparisonData?.current.dealsWon ?? 0;
  const hasOverdue = (analyticsOverview?.overdueAmount ?? 0) > 0;
  const conversionRate =
    comparisonData && comparisonData.current.dealsCreated > 0
      ? Math.round(
          (comparisonData.current.dealsWon /
            comparisonData.current.dealsCreated) *
            100
        )
      : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="this_quarter">This quarter</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowQuickAdd(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Quick Add Deal
        </Button>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/invoices" className="group block">
          <Card className="transition-all hover:border-primary/30 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Revenue (Month)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardTitle className="font-mono text-2xl lg:text-3xl">
                {formatCurrency(comparisonData?.current.revenue ?? 0)}
              </CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <ChangeIndicator value={comparisonData?.change.revenue ?? 0} />
                <span className="text-xs text-muted-foreground">
                  vs last month
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/deals" className="group block">
          <Card className="transition-all hover:border-primary/30 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Active Pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardTitle className="font-mono text-2xl lg:text-3xl">
                {formatCurrency(activePipelineValue)}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {overview.totalDeals} total deals
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/deals" className="group block">
          <Card className="transition-all hover:border-primary/30 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Handshake className="h-4 w-4" />
                Deals Won (Month)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardTitle className="text-2xl lg:text-3xl">
                {wonDealsMonth}
              </CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <ChangeIndicator value={comparisonData?.change.dealsWon ?? 0} />
                <span className="text-xs text-muted-foreground">
                  vs last month
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/deals" className="group block">
          <Card className="transition-all hover:border-primary/30 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                Conversion Rate
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardTitle className="font-mono text-2xl lg:text-3xl">
                {conversionRate}%
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {comparisonData?.current.dealsCreated ?? 0} deals created
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/invoices" className="group block">
          <Card className="border-t-2 border-t-orange-400 transition-all hover:border-primary/30 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full bg-orange-400"
                  aria-hidden="true"
                />
                <FileText className="h-4 w-4" />
                Outstanding Invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardTitle className="font-mono text-2xl text-orange-600 dark:text-orange-400">
                {formatCurrency(analyticsOverview?.outstandingAmount ?? 0)}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Posted invoices awaiting payment
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/invoices" className="group block">
          <Card
            className={`border-t-2 transition-all hover:border-primary/30 hover:shadow-md ${
              hasOverdue ? 'border-t-red-500' : 'border-t-green-500'
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <span
                  className={`inline-block size-2 rounded-full ${
                    hasOverdue ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  aria-hidden="true"
                />
                <AlertTriangle className="h-4 w-4" />
                Overdue Amount
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardTitle
                className={`font-mono text-2xl ${
                  hasOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              >
                {formatCurrency(analyticsOverview?.overdueAmount ?? 0)}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasOverdue
                  ? 'Past due date — needs attention'
                  : 'All invoices current'}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Insights */}
      <InsightsWidget overview={overview} isLoading={overviewLoading} />

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by Month */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Revenue by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData ?? []} />
          </CardContent>
        </Card>

        {/* Pipeline Forecast */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Pipeline Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastData && forecastData.length > 0 ? (
              <PipelineChart
                dealsByStage={
                  forecastData?.map((s: any) => ({
                    stage: s.stage,
                    count: s.dealCount,
                    value: s.totalValue,
                  })) ?? []
                }
              />
            ) : (
              <DashboardEmptyState
                icon={<Target className="h-5 w-5" />}
                title="No pipeline data yet"
                action={{ label: 'View deals', href: '/deals' }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProductsData && topProductsData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProductsData.map((p) => (
                    <TableRow key={p.productId ?? p.productName}>
                      <TableCell className="font-medium">
                        {p.productName}
                      </TableCell>
                      <TableCell className="text-right">{p.totalQty}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(p.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <DashboardEmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="No product data yet"
                action={{ label: 'Add product', href: '/products/new' }}
              />
            )}
          </CardContent>
        </Card>

        {/* Invoice Aging */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Invoice Aging
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agingData && agingData.some((b) => b.count > 0) ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Amount due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingData.map((b) => (
                    <TableRow key={b.bucket}>
                      <TableCell className="font-medium">{b.bucket}</TableCell>
                      <TableCell className="text-right">{b.count}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(b.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <DashboardEmptyState
                icon={<Clock className="h-5 w-5" />}
                title="No overdue invoices"
                action={{ label: 'View invoices', href: '/invoices' }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Sales Performance */}
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salesData && salesData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead className="text-right">Total value</TableHead>
                  <TableHead className="text-right">Avg close (days)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.map((s) => (
                  <TableRow key={s.ownerId}>
                    <TableCell className="font-medium">{s.ownerName}</TableCell>
                    <TableCell className="text-right">{s.totalDeals}</TableCell>
                    <TableCell className="text-right">{s.wonDeals}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={s.winRate >= 50 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {s.winRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(s.totalValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.avgCloseDays}d
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <DashboardEmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No sales data yet"
              action={{ label: 'View deals', href: '/deals' }}
            />
          )}
        </CardContent>
      </Card>

      {/* Row 5: Activities */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview.recentActivities.length === 0 ? (
              <DashboardEmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No recent activities"
                action={{ label: 'View activities', href: '/activities' }}
              />
            ) : (
              <ul className="space-y-2">
                {overview.recentActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                  return (
                    <li key={activity.id}>
                      <Link
                        href="/activities"
                        className="flex items-start gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(activity.createdAt)}
                          </p>
                        </div>
                      </Link>
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
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview.upcomingActivities.length === 0 ? (
              <DashboardEmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No upcoming activities"
                action={{ label: 'View activities', href: '/activities' }}
              />
            ) : (
              <ul className="space-y-2">
                {overview.upcomingActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                  return (
                    <li key={activity.id}>
                      <Link
                        href="/activities"
                        className="flex items-start gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(activity.dueAt, 'MMM d, yyyy')}
                          </p>
                        </div>
                      </Link>
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
