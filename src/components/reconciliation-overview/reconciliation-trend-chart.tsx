'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  type DotProps,
} from 'recharts';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import type { DailyFlowPoint } from '@/lib/reconciliation-stats';

function SquareDot({
  cx,
  cy,
  fill,
  opacity = 1,
  size = 6,
}: DotProps & { size?: number; opacity?: number }) {
  if (cx == null || cy == null) return null;
  return (
    <rect
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      fill={fill}
      fillOpacity={opacity}
      rx={1}
    />
  );
}

const chartConfig = {
  matched: { label: 'Matched value', color: 'var(--status-good)' },
  exception: { label: 'Flagged value', color: 'var(--status-critical)' },
} satisfies ChartConfig;

interface ReconciliationTrendChartProps {
  points: DailyFlowPoint[];
}

export function ReconciliationTrendChart({
  points,
}: ReconciliationTrendChartProps) {
  const bounds = useMemo(() => {
    if (points.length === 0) return null;
    return {
      from: parseISO(points[0].date),
      to: parseISO(points[points.length - 1].date),
    };
  }, [points]);

  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const effective = date ?? bounds ?? undefined;

  const filtered = useMemo(() => {
    if (!effective?.from || !effective?.to) return points;
    const from = effective.from.getTime();
    const to = effective.to.getTime();
    return points.filter((p) => {
      const t = parseISO(p.date).getTime();
      return t >= from && t <= to;
    });
  }, [points, effective]);

  const totals = useMemo(() => {
    const matched = filtered.reduce((s, d) => s + d.matched, 0);
    const exception = filtered.reduce((s, d) => s + d.exception, 0);
    return { matched, exception };
  }, [filtered]);

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            Reconciliation Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
          No dated records to trend yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            Reconciliation Trend
          </CardTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: 'var(--status-good)' }}
              />
              Matched{' '}
              <span className="font-medium text-foreground">
                {totals.matched.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: 'var(--status-critical)' }}
              />
              Flagged{' '}
              <span className="font-medium text-foreground">
                {totals.exception.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </span>
          </div>
        </div>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className={cn(
                  'h-8 w-full justify-start text-left text-xs font-normal sm:w-[200px]',
                  !effective && 'text-muted-foreground'
                )}
              />
            }
          >
            <CalendarIcon className="mr-2 size-3.5" />
            {effective?.from ? (
              effective.to ? (
                <>
                  {format(effective.from, 'd MMM')} -{' '}
                  {format(effective.to, 'd MMM yyyy')}
                </>
              ) : (
                format(effective.from, 'd MMM yyyy')
              )
            ) : (
              'Pick a date range'
            )}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              defaultMonth={effective?.from}
              selected={date ?? bounds ?? undefined}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart
            data={filtered}
            margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id="fillMatched" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--status-good)"
                  stopOpacity={0.22}
                />
                <stop
                  offset="100%"
                  stopColor="var(--status-good)"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="fillException" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--status-critical)"
                  stopOpacity={0.16}
                />
                <stop
                  offset="100%"
                  stopColor="var(--status-critical)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-border)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickMargin={8}
              stroke="var(--color-muted-foreground)"
              tickFormatter={(d: string) => format(parseISO(d), 'd MMM')}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickMargin={8}
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
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {name === 'matched' ? 'Matched' : 'Flagged'}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {Number(value).toLocaleString()}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="exception"
              type="linear"
              stroke="var(--status-critical)"
              strokeWidth={1.5}
              fill="url(#fillException)"
              dot={
                <SquareDot
                  fill="var(--status-critical)"
                  opacity={0.6}
                  size={5}
                />
              }
            />
            <Area
              dataKey="matched"
              type="linear"
              stroke="var(--status-good)"
              strokeWidth={2}
              fill="url(#fillMatched)"
              dot={<SquareDot fill="var(--status-good)" size={6} />}
              activeDot={<SquareDot fill="var(--status-good)" size={9} />}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
