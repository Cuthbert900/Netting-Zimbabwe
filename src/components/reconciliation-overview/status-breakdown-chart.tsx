'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { STATUS_COLORS } from '@/lib/chart-colors';
import { STATUS_META } from '@/components/matches/match-status-badge';
import type { StatusBreakdownRow } from '@/lib/reconciliation-stats';

interface StatusBreakdownChartProps {
  rows: StatusBreakdownRow[];
}

const chartConfig: ChartConfig = {
  matched: { label: STATUS_META.matched.label, color: STATUS_COLORS.matched },
  timing: { label: STATUS_META.timing.label, color: STATUS_COLORS.timing },
  mispost: { label: STATUS_META.mispost.label, color: STATUS_COLORS.mispost },
  investigate: {
    label: STATUS_META.investigate.label,
    color: STATUS_COLORS.investigate,
  },
};

export function StatusBreakdownChart({ rows }: StatusBreakdownChartProps) {
  const data = rows.map((r) => ({
    status: STATUS_META[r.status].label,
    key: r.status,
    count: r.count,
    fill: STATUS_COLORS[r.status],
  }));

  const hasData = rows.some((r) => r.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No reconciliation groups yet
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 24 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="status"
          tickLine={false}
          axisLine={false}
          width={90}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={4} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
