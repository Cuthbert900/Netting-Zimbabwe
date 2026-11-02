'use client';

import { format, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DailyExceptionPoint } from '@/lib/reconciliation-stats';

interface ExceptionTrendChartProps {
  points: DailyExceptionPoint[];
}

const chartConfig: ChartConfig = {
  value: { label: 'Exception value', color: 'var(--status-critical)' },
};

export function ExceptionTrendChart({ points }: ExceptionTrendChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No exceptions to trend yet
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <AreaChart data={points} margin={{ left: 8, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="exceptionFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--status-critical)"
              stopOpacity={0.18}
            />
            <stop
              offset="100%"
              stopColor="var(--status-critical)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => format(parseISO(d), 'd MMM')}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            v.toLocaleString(undefined, { notation: 'compact' })
          }
          tick={{ fontSize: 11 }}
          width={48}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.date
                  ? format(parseISO(payload[0].payload.date), 'd MMM yyyy')
                  : ''
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-alert-text)"
          strokeWidth={2.5}
          fill="url(#exceptionFill)"
          fillOpacity={0.1}
        />
      </AreaChart>
    </ChartContainer>
  );
}
