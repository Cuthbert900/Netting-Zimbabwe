'use client';

import { useMemo } from 'react';
import { FileStackIcon } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { useReconciliation } from '@/lib/reconciliation-context';
import { useDataSources } from '@/lib/data-sources-context';
import { dailyExceptionTrend, pairCoverage } from '@/lib/reconciliation-stats';
import { ExceptionTrendChart } from '@/components/analytics/exception-trend-chart';
import { PairCoverageChart } from '@/components/analytics/pair-coverage-chart';
import { CurrencyMixBar } from '@/components/analytics/currency-mix-bar';
import { AiSummaryCard } from '@/components/analytics/ai-summary-card';

export function AnalyticsPageClient() {
  const result = useReconciliation();
  const { filesBySource } = useDataSources();

  const trend = useMemo(
    () => dailyExceptionTrend(result.groups),
    [result.groups]
  );
  const pairs = useMemo(
    () => pairCoverage(result.groups, filesBySource),
    [result.groups, filesBySource]
  );

  const totalRecords =
    result.totalsBySource.dynamics.count +
    result.totalsBySource.prism.count +
    result.totalsBySource.bank.count;

  if (totalRecords === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Analytics"
          description="Trends and coverage across the current reconciliation period."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FileStackIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">No extracts uploaded yet</p>
            <p className="text-sm text-muted-foreground">
              Analytics fill in once Dynamics, Prism, or bank extracts are
              loaded on Data Sources.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Analytics"
        description="Trends and coverage across the current reconciliation period."
      />

      <AiSummaryCard />

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Exception value over time</CardTitle>
          <CardDescription>
            Flagged exposure by the earliest transaction date in each unmatched
            group — clusters often line up with settlement runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExceptionTrendChart points={trend} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">
              Tie-out rate by source pair
            </CardTitle>
            <CardDescription>
              Share of each pair&apos;s records that found a counterpart
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PairCoverageChart pairs={pairs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Currency mix</CardTitle>
            <CardDescription>
              Share of total reconciled value by currency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CurrencyMixBar />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
