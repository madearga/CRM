"use client";

import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Calendar,
  FileText,
  Mail,
  Phone,
  TrendingUp,
  Activity,
  AlertTriangle,
  Plus,
  Target,
  BarChart3,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "@/lib/format-date";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";


const RevenueChart = dynamic(
  () => import("./revenue-chart").then((m) => ({ default: m.RevenueChart })),
  {
    ssr: false,
    loading: () => <div className="h-[300px] rounded-lg bg-muted" />,
  }
);
const PipelineChart = dynamic(() => import("./pipeline-chart"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] rounded-lg bg-muted" />
  ),
});

import { api } from "@convex/_generated/api";
import { useAuthQuery } from "@/lib/convex/hooks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  STAGE_CHART_COLORS,
  STAGE_BAR_COLORS,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { useDashboardParams, type DateRange } from "@/hooks/use-dashboard-params";
import { QuickAddDealDialog } from "./quick-add-deal-dialog";
import { InsightsWidget } from "@/components/insights-widget";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">0%</span>;
  const positive = value > 0;
  return (
    <span className={`text-xs font-medium ${positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

function SkeletonDashboard() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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

  // Widgets proposed by an agent and approved by a person. Spec only; built-in components render it.
  const { data: agentWidgets } = useAuthQuery(api.widgets.listWidgets, {});
  const wantsPipeline = (agentWidgets ?? []).some(
    (widget: { source: string }) => widget.source === "pipeline_overview"
  );
  const { data: widgetPipeline } = useAuthQuery(
    api.webmcp.pipelineOverview,
    wantsPipeline ? {} : "skip"
  );

  const isLoading =
    overviewLoading || revenueLoading || salesLoading || forecastLoading;

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
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((sum, s) => sum + s.value, 0);

  const wonDealsMonth = comparisonData?.current.dealsWon ?? 0;
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
    <div className="rise-stagger container mx-auto space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Active pipeline {formatCurrency(activePipelineValue)} across{" "}
            {overview.totalDeals} deals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="this_quarter">This quarter</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowQuickAdd(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Quick Add Deal
          </Button>
        </div>
      </div>

      {/* Row 1: KPI strip — one container split by hairlines, labels above values */}
      <Card className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-6 lg:divide-x">
        {[
          {
            label: "Revenue (Month)",
            value: formatCurrency(comparisonData?.current.revenue ?? 0),
            caption: (
              <>
                <ChangeIndicator value={comparisonData?.change.revenue ?? 0} />
                <span className="ml-1">vs last month</span>
              </>
            ),
          },
          {
            label: "Active Pipeline",
            value: formatCurrency(activePipelineValue),
            caption: <>{overview.totalDeals} total deals</>,
          },
          {
            label: "Deals Won (Month)",
            value: String(wonDealsMonth),
            caption: (
              <>
                <ChangeIndicator value={comparisonData?.change.dealsWon ?? 0} />
                <span className="ml-1">vs last month</span>
              </>
            ),
          },
          {
            label: "Conversion Rate",
            value: `${conversionRate}%`,
            caption: <>{comparisonData?.current.dealsCreated ?? 0} deals created</>,
          },
          {
            label: "Outstanding Invoices",
            value: formatCurrency(analyticsOverview?.outstandingAmount ?? 0),
            caption: <>Posted invoices awaiting payment</>,
          },
          {
            label: "Overdue Amount",
            value: formatCurrency(analyticsOverview?.overdueAmount ?? 0),
            danger: (analyticsOverview?.overdueAmount ?? 0) > 0,
            caption: (analyticsOverview?.overdueAmount ?? 0) > 0 ? <>Past due date — needs attention</> : <>All invoices current</>,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-1.5 p-4">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p
              className={`font-mono text-2xl ${
                kpi.danger ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {kpi.value}
            </p>
            <p className="flex items-center text-xs text-muted-foreground">
              {kpi.caption}
            </p>
          </div>
        ))}
      </Card>

      {/* Insights */}
      <InsightsWidget overview={overview} isLoading={overviewLoading} />

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by Month */}
        <Card className="">
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
        <Card className="">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Pipeline Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastData && forecastData.length > 0 ? (
              <PipelineChart dealsByStage={forecastData?.map((s: any) => ({ stage: s.stage, count: s.dealCount, value: s.totalValue })) ?? []} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No pipeline data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Tables */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card className="">
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
                  {topProductsData.slice(0, 5).map((p) => (
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
              <p className="py-8 text-center text-sm text-muted-foreground">
                No product data yet
              </p>
            )}
            {topProductsData && topProductsData.length > 5 && (
              <Link
                href="/products"
                className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View all {topProductsData.length} products
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Invoice Aging */}
        <Card className="">
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
              <p className="py-8 text-center text-sm text-muted-foreground">
                No overdue invoices
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Sales Performance */}
      <Card className="">
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
                        variant={s.winRate >= 50 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {s.winRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(s.totalValue)}
                    </TableCell>
                    <TableCell className="text-right">{s.avgCloseDays}d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sales data yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Row 5: Recent Activities + Upcoming */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Aging Deals */}
        {overview.agingDeals && overview.agingDeals.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                Deals Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {overview.agingDeals.slice(0, 5).map((deal) => (
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
                    {deal.value != null ? (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatCurrency(deal.value)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activities</p>
            ) : (
              <ul className="space-y-3">
                {overview.recentActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                  return (
                    <li key={activity.id} className="flex items-start gap-3 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.createdAt))}
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
            {overview.upcomingActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming activities</p>
            ) : (
              <ul className="space-y-3">
                {overview.upcomingActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
                  return (
                    <li key={activity.id} className="flex items-start gap-3 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.dueAt), "MMM d, yyyy")}
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

      {(agentWidgets ?? []).length > 0 && widgetPipeline && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Agen Widgets</CardTitle>
            <CardDescription>
              Dibuat oleh agen, disetujui oleh kamu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(agentWidgets ?? []).map((widget: { id: string; title: string; source: string }) =>
              widget.source === "pipeline_overview" ? (
                <div key={widget.id}>
                  <p className="mb-2 text-sm font-medium">{widget.title}</p>
                  <PipelineChart
                    dealsByStage={
                      widgetPipeline.by_stage.map((s: { stage: string; count: number; value: number }) => ({
                        stage: s.stage,
                        count: s.count,
                        value: s.value,
                      })) ?? []
                    }
                  />
                </div>
              ) : null
            )}
          </CardContent>
        </Card>
      )}

      <QuickAddDealDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} />
    </div>
  );
}
