"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Lightbulb, AlertTriangle, Clock, ArrowRight } from "lucide-react";

import { api } from "@convex/_generated/api";
import { useAuthQuery } from "@/lib/convex/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { formatDistanceToNow } from "@/lib/format-date";

function InsightSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

export function InsightsWidget() {
  const { data: overview, isLoading } = useAuthQuery(api.dashboard.overview, {});

  const insights = useMemo(() => {
    if (!overview) return [];

    const items: {
      id: string;
      severity: "high" | "medium";
      icon: React.ReactNode;
      title: string;
      description: React.ReactNode;
      cta: { label: string; href: string };
    }[] = [];

    // Aging deals
    const aging = overview.agingDeals ?? [];
    if (aging.length > 0) {
      const totalValue = aging.reduce((s, d) => s + (d.value ?? 0), 0);
      const longest = aging.reduce((a, b) => (a.daysInStage > b.daysInStage ? a : b), aging[0]);
      items.push({
        id: "aging-deals",
        severity: "high",
        icon: <AlertTriangle className="h-5 w-5" />,
        title: `${aging.length} deal${aging.length > 1 ? "s" : ""} stuck in stage`,
        description: (
          <span className="text-sm text-muted-foreground">
            Total value {formatCurrency(totalValue)}. Longest stuck:{" "}
            <span className="font-medium text-foreground">{longest.title}</span>{" "}
            ({longest.daysInStage}d in {longest.stage})
          </span>
        ),
        cta: { label: "View deals", href: "/deals" },
      });
    }

    // Due soon activities (< 24h)
    const now = Date.now();
    const dueSoon = (overview.upcomingActivities ?? []).filter((a) => {
      const diff = a.dueAt - now;
      return diff > 0 && diff < 24 * 60 * 60 * 1000;
    });
    if (dueSoon.length > 0) {
      const next = dueSoon.reduce((a, b) =>
        a.dueAt < b.dueAt ? a : b
      );
      items.push({
        id: "due-soon",
        severity: "medium",
        icon: <Clock className="h-5 w-5" />,
        title: `${dueSoon.length} activity${dueSoon.length > 1 ? "ies" : "y"} due within 24h`,
        description: (
          <span className="text-sm text-muted-foreground">
            Next up: <span className="font-medium text-foreground">{next.title}</span>{" "}
            <Badge variant="outline" className="ml-1 text-xs capitalize">{next.type}</Badge>{" "}
            — {formatDistanceToNow(new Date(next.dueAt))}
          </span>
        ),
        cta: { label: "View activities", href: "/activities" },
      });
    }

    return items;
  }, [overview]);

  if (isLoading) return <InsightSkeleton />;

  if (insights.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-4 py-5">
          <div className="rounded-full bg-green-100 p-2.5 dark:bg-green-900/40">
            <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-green-700 dark:text-green-300">All clear</p>
            <p className="text-sm text-muted-foreground">
              No aging deals or urgent activities right now. Great job!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {insights.map((insight) => {
        const borderColor =
          insight.severity === "high"
            ? "border-red-300 dark:border-red-700"
            : "border-amber-300 dark:border-amber-700";
        const iconBg =
          insight.severity === "high"
            ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
            : "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400";

        return (
          <Card key={insight.id} className={`border-l-4 ${borderColor}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className={`rounded-full p-1.5 ${iconBg}`}>{insight.icon}</span>
                {insight.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div>{insight.description}</div>
              <Button variant="outline" size="sm" asChild className="gap-1">
                <Link href={insight.cta.href}>
                  {insight.cta.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
