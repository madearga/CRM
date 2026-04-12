"use client";

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
  DollarSign,
  Target,
  BarChart3,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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
    <div className="container mx-auto space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowQuickAdd(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Quick Add Deal
        </Button>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              Revenue (Month)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="font-mono text-3xl">
              {formatCurrency(comparisonData?.current.revenue ?? 0)}
            </CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <ChangeIndicator value={comparisonData?.change.revenue ?? 0} />
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Active Pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="font-mono text-3xl">
              {formatCurrency(activePipelineValue)}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.totalDeals} total deals
            </p>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Handshake className="h-4 w-4" />
              Deals Won (Month)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="text-3xl">{wonDealsMonth}</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <ChangeIndicator value={comparisonData?.change.dealsWon ?? 0} />
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              Conversion Rate
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <CardTitle className="font-mono text-3xl">{conversionRate}%</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {comparisonData?.current.dealsCreated ?? 0} deals created
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Revenue by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData && revenueData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="month"
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} name="Revenue">
                      {revenueData.map((_, i) => (
                        <Cell key={i} fill="#6366f1" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No revenue data yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Forecast */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Pipeline Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastData && forecastData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={forecastData}
                    layout="vertical"
                    margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                    />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      className="text-xs capitalize"
                      tick={{ fontSize: 12 }}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                    <Bar dataKey="expectedRevenue" radius={[0, 6, 6, 0]} name="Expected Revenue">
                      {forecastData.map((stage) => (
                        <Cell
                          key={stage.stage}
                          fill={STAGE_CHART_COLORS[stage.stage] ?? "#6366f1"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No pipeline data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
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
              <p className="py-8 text-center text-sm text-muted-foreground">
                No product data yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Invoice Aging */}
        <Card>
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
                    <TableHead className="text-right">Amount Due</TableHead>
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
                No overdue invoices 🎉
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Sales Performance */}
      <Card>
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
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Avg Close (days)</TableHead>
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
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
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

      <QuickAddDealDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} />
    </div>
  );
}
