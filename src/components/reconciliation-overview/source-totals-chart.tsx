'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SOURCE_COLORS } from '@/lib/chart-colors';
import { SOURCE_LABELS, type SourceKey } from '@/lib/data-sources-context';
import type { ReconciliationResult } from '@/lib/reconciliation-engine';

interface SourceTotalsChartProps {
  totalsBySource: ReconciliationResult['totalsBySource'];
}

const chartConfig: ChartConfig = {
  dynamics: { label: SOURCE_LABELS.dynamics, color: SOURCE_COLORS.dynamics },
  prism: { label: SOURCE_LABELS.prism, color: SOURCE_COLORS.prism },
  bank: { label: SOURCE_LABELS.bank, color: SOURCE_COLORS.bank },
};

export function SourceTotalsChart({ totalsBySource }: SourceTotalsChartProps) {
  const keys: SourceKey[] = ['dynamics', 'prism', 'bank'];
  const data = keys.map((key) => ({
    source: SOURCE_LABELS[key],
    key,
    count: totalsBySource[key].count,
    fill: SOURCE_COLORS[key],
  }));

  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No extracts uploaded yet
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
          dataKey="source"
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
