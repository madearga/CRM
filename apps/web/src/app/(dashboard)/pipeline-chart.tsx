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
  Cell,
} from "recharts";
import { STAGE_CHART_COLORS, STAGE_BAR_COLORS as STAGE_COLORS } from "@/lib/constants";
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
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="stage" className="text-xs" tick={{ fontSize: 12 }} />
            <YAxis className="text-xs" tick={{ fontSize: 12 }} />
            <Tooltip formatter={chartFormatter} contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
            }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Deals">
              {dealsByStage.map((stage) => (
                <Cell
                  key={stage.stage}
                  fill={STAGE_CHART_COLORS[stage.stage] ?? "#6366f1"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Value summary */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {dealsByStage.map((stage) => (
          <div key={stage.stage} className="rounded-lg border p-2 text-center">
            <div
              className={`mx-auto mb-1 h-1.5 w-8 rounded-full ${STAGE_COLORS[stage.stage] ?? "bg-primary"}`}
            />
            <p className="text-xs font-medium capitalize">{stage.stage}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatCurrency(stage.value)}
            </p>
          </div>
        ))}
      </div>
    </>
  );
});

export default PipelineChart;
