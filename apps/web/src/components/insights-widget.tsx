"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Lightbulb, AlertTriangle, Clock, ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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

export function InsightsWidget({ overview, isLoading }: { overview: any | undefined; isLoading: boolean }) {
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
      <Card>
        <CardContent className="flex items-center gap-3 py-5">
          <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">All clear</p>
            <p className="text-sm text-muted-foreground">
              No aging deals or urgent activities right now.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-4 ${insights.length > 1 ? "sm:grid-cols-2" : ""}`}
    >
      {insights.map((insight) => {
        // Colour only on the mark that needs attention; the card stays neutral.
        const iconColor =
          insight.severity === "high"
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400";

        return (
          <Card key={insight.id} className="py-4">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 ${iconColor}`}>{insight.icon}</span>
                <div>
                  <p className="font-medium">{insight.title}</p>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {insight.description}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 gap-1 self-start">
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
