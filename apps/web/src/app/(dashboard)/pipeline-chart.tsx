"use client";

import { memo } from "react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/format";

interface StageData {
  stage: string;
  count: number;
  value: number;
}

interface PipelineChartProps {
  dealsByStage: StageData[];
}

const chartFormatter = (value: number, name: string) =>
  name === "value" ? formatCurrency(value) : [value, "Deals"];

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
};

export const PipelineChart = memo(function PipelineChart({ dealsByStage }: PipelineChartProps) {
  const chartData = dealsByStage.map((s) => ({
    stage: s.stage.charAt(0).toUpperCase() + s.stage.slice(1),
    count: s.count,
    value: s.value,
  }));

  return (
    <>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
          >
            <CartesianGrid vertical={false} className="stroke-border" />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 12 }}
            />
            <Tooltip formatter={chartFormatter} contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
            {/* One hue on the data; square corners, as measured screens do. */}
            <Bar dataKey="count" radius={0} fill="#f2b33d" name="Deals" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Per-stage values: neutral, aligned, no hue per stage. */}
      <dl className="mt-4 divide-y divide-border border-t border-border">
        {dealsByStage.map((stage) => (
          <div
            key={stage.stage}
            className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
          >
            <dt className="capitalize text-muted-foreground">{stage.stage}</dt>
            <dd className="font-mono tabular-nums">{formatCurrency(stage.value)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
});

export default PipelineChart;
