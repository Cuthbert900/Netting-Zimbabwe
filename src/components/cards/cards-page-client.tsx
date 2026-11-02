'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { StatTile } from '@/components/reconciliation-overview/stat-tile';
import { useReconciliation } from '@/lib/reconciliation-context';
import { MatchTable } from '@/components/matches/match-table';
import { formatMoney } from '@/components/matches/match-status-badge';

export function CardsPageClient() {
  const result = useReconciliation();

  const exceptions = useMemo(
    () => result.groups.filter((g) => g.status !== 'matched'),
    [result.groups]
  );
  const highValue = useMemo(
    () =>
      exceptions
        .filter((g) => g.status === 'investigate' && g.amount >= 5000)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [exceptions]
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Exceptions"
        description={
          <>
            Every unmatched, timing, or amount-variance record surfaced by the
            reconciliation engine — {exceptions.length.toLocaleString()} item
            {exceptions.length === 1 ? '' : 's'} totalling{' '}
            {formatMoney(result.summary.exceptionValue)} to review.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open exceptions"
          value={exceptions.length.toLocaleString()}
          sub="not matched cleanly"
          variant="purple"
        />
        <StatTile
          label="Timing differences"
          value={result.summary.timing.toLocaleString()}
          sub="posted on different dates"
        />
        <StatTile
          label="Mis-posts"
          value={result.summary.mispost.toLocaleString()}
          sub="amount variance across sources"
        />
        <StatTile
          label="Exposed value"
          value={formatMoney(result.summary.exceptionValue)}
          sub={`${result.summary.investigate.toLocaleString()} to investigate`}
          variant="pink"
        />
      </div>

      {highValue.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              Priority — high value, no counterpart found
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {highValue.map((g) => (
                <div
                  key={g.id}
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <div className="text-sm font-semibold tabular-nums">
                    {formatMoney(g.amount, g.records[0]?.currency)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {g.records[0]?.fileName}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <MatchTable
        groups={exceptions}
        emptyLabel="No exceptions — everything uploaded so far reconciles cleanly."
      />
    </div>
  );
}
