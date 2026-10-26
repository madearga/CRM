'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

// Short axis ticks that stay readable when the amounts are small.
const tick = (v: number) =>
  v >= 1_000_000 ? `${v / 1_000_000}M` : v >= 1_000 ? `${v / 1_000}k` : `${v}`;

export function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No revenue data yet
      </p>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} className="stroke-border" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11 }}
            tickFormatter={tick}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
            }}
            cursor={{ fill: 'transparent' }}
          />
          {/* One hue on the data, square corners. */}
          <Bar dataKey="revenue" radius={0} fill="#f2b33d" name="Revenue" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
