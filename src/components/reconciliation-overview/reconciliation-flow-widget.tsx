'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ArrowDownLeftIcon, ArrowUpRightIcon } from 'lucide-react';
import type { DailyFlowPoint } from '@/lib/reconciliation-stats';

const chartConfig = {
  matched: { label: 'Matched', color: 'var(--status-good)' },
  exception: { label: 'Flagged', color: 'var(--status-critical)' },
} satisfies ChartConfig;

const WINDOWS = { '7d': 7, '30d': 30, '90d': 90 } as const;
type Window = keyof typeof WINDOWS;

interface ReconciliationFlowWidgetProps {
  points: DailyFlowPoint[];
}

export function ReconciliationFlowWidget({
  points,
}: ReconciliationFlowWidgetProps) {
  const [window, setWindow] = useState<Window>('30d');

  const data = useMemo(() => {
    if (points.length === 0) return [];
    const days = WINDOWS[window];
    return points.slice(-days);
  }, [points, window]);

  const totals = useMemo(() => {
    const matched = data.reduce((s, d) => s + d.matched, 0);
    const exception = data.reduce((s, d) => s + d.exception, 0);
    return { matched, exception, net: matched - exception };
  }, [data]);

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            Reconciliation Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          No dated records yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Reconciliation Flow
        </CardTitle>
        <Select
          value={window}
          onValueChange={(v) => v && setWindow(v as Window)}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <ArrowDownLeftIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/70">
                Matched
              </p>
              <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {totals.matched.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 px-3 py-2.5 dark:bg-rose-950/30">
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/50">
              <ArrowUpRightIcon className="size-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-rose-600/70 dark:text-rose-400/70">
                Flagged
              </p>
              <p className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {totals.exception.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-xs text-muted-foreground">Net Position</span>
          <span
            className={
              totals.net >= 0
                ? 'text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400'
                : 'text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400'
            }
          >
            {totals.net >= 0 ? '+' : ''}
            {totals.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
            barGap={2}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-border)"
              strokeOpacity={0.4}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickMargin={6}
              stroke="var(--color-muted-foreground)"
              tickFormatter={(d: string) => format(parseISO(d), 'd MMM')}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickMargin={4}
              stroke="var(--color-muted-foreground)"
              tickFormatter={(v) =>
                Number(v).toLocaleString(undefined, { notation: 'compact' })
              }
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
            <Bar
              dataKey="matched"
              fill="var(--status-good)"
              radius={[6, 6, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="exception"
              fill="var(--status-critical)"
              fillOpacity={0.7}
              radius={[6, 6, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
