'use client';

import { useMemo } from 'react';
import { useReconciliation } from '@/lib/reconciliation-context';

// Categorical identity for currency segments — a fixed, small hue set
// distinct from both the source palette and the status ramp so it never
// impersonates either.
const CURRENCY_HUES = ['#5470c4', '#c8187d', '#6d3fa0', '#16a34a', '#d97706'];

export function CurrencyMixBar() {
  const result = useReconciliation();

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of result.groups) {
      const currency =
        g.records.find((r) => r.currency)?.currency ?? 'Unspecified';
      map.set(currency, (map.get(currency) ?? 0) + g.amount);
    }
    return Array.from(map.entries())
      .map(([currency, value]) => ({ currency, value }))
      .sort((a, b) => b.value - a.value);
  }, [result.groups]);

  const total = totals.reduce((s, t) => s + t.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No currency data yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {totals.map((t, i) => {
          const pct = (t.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={t.currency}
              className="h-full first:rounded-l-md last:rounded-r-md"
              style={{
                width: `${pct}%`,
                backgroundColor: CURRENCY_HUES[i % CURRENCY_HUES.length],
                marginRight: i < totals.length - 1 ? 2 : 0,
              }}
              title={`${t.currency}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {totals.map((t, i) => (
          <div key={t.currency} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{
                backgroundColor: CURRENCY_HUES[i % CURRENCY_HUES.length],
              }}
            />
            <span className="text-muted-foreground">{t.currency}</span>
            <span className="font-medium tabular-nums">
              {((t.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
