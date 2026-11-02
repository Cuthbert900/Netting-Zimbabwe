'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SOURCE_LABELS } from '@/lib/data-sources-context';
import type { PairCoverage } from '@/lib/reconciliation-stats';

interface PairCoverageChartProps {
  pairs: PairCoverage[];
}

const chartConfig: ChartConfig = {
  rate: { label: 'Tie-out rate', color: 'var(--status-good)' },
};

export function PairCoverageChart({ pairs }: PairCoverageChartProps) {
  if (pairs.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Upload at least two sources to compare tie-out rates
      </div>
    );
  }

  const data = pairs.map((p) => {
    const [a, b] = p.pair;
    const totalRecords = p.totalA + p.totalB;
    const coveredRecords = p.coveredA + p.coveredB;
    const rate =
      totalRecords > 0 ? Math.round((coveredRecords / totalRecords) * 100) : 0;
    return {
      label: `${SOURCE_LABELS[a]} ↔ ${SOURCE_LABELS[b]}`,
      rate,
    };
  });

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 32 }}
        barCategoryGap={14}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={130}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">Tie-out rate</span>
                  <span className="font-mono font-medium tabular-nums">
                    {value}%
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="rate"
          fill="var(--status-good)"
          radius={4}
          maxBarSize={20}
        />
      </BarChart>
    </ChartContainer>
  );
}
