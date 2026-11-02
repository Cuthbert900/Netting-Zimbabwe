'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { FileStackIcon, UploadIcon } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { useReconciliation } from '@/lib/reconciliation-context';
import {
  statusBreakdown,
  dailyMatchedVsExceptionTrend,
} from '@/lib/reconciliation-stats';
import { StatTile } from '@/components/reconciliation-overview/stat-tile';
import { MatchRateMeter } from '@/components/reconciliation-overview/match-rate-meter';
import { StatusBreakdownChart } from '@/components/reconciliation-overview/status-breakdown-chart';
import { SourceTotalsChart } from '@/components/reconciliation-overview/source-totals-chart';
import { ReconciliationTrendChart } from '@/components/reconciliation-overview/reconciliation-trend-chart';
import { BankSourceCards } from '@/components/reconciliation-overview/bank-source-cards';
import { AssignExceptionWidget } from '@/components/reconciliation-overview/assign-exception-widget';
import { ReconciliationFlowWidget } from '@/components/reconciliation-overview/reconciliation-flow-widget';
import { HealthScoreGauge } from '@/components/reconciliation-overview/health-score-gauge';
import { RecentMatchesTable } from '@/components/reconciliation-overview/recent-matches-table';
import { DuplicateReviewPanel } from '@/components/reconciliation-overview/duplicate-review-panel';
import { MatchTable } from '@/components/matches/match-table';
import { formatMoney } from '@/components/matches/match-status-badge';

export function OverviewPageClient() {
  const result = useReconciliation();
  const rows = useMemo(() => statusBreakdown(result.groups), [result.groups]);
  const trendPoints = useMemo(
    () => dailyMatchedVsExceptionTrend(result.groups),
    [result.groups]
  );

  const totalGroups = result.groups.length;
  const totalRecords =
    result.totalsBySource.dynamics.count +
    result.totalsBySource.prism.count +
    result.totalsBySource.bank.count;
  const sourceCount = (['dynamics', 'prism', 'bank'] as const).filter(
    (s) => result.totalsBySource[s].count > 0
  ).length;

  const highValueExceptions = useMemo(
    () =>
      result.groups
        .filter((g) => g.status === 'investigate' && g.amount >= 5000)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [result.groups]
  );

  if (totalRecords === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Netting control account"
          description="No extracts loaded yet"
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileStackIcon className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No extracts uploaded yet</p>
              <p className="text-sm text-muted-foreground">
                Upload Dynamics, Prism, or bank statement extracts to see
                reconciliation results here.
              </p>
            </div>
            <Button
              render={<Link href="/data-sources" />}
              nativeButton={false}
              size="sm"
              className="mt-1"
            >
              Go to Data Sources
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Netting control account"
        description={`${totalRecords.toLocaleString()} records loaded across ${sourceCount} source(s)`}
        actions={
          <Button render={<Link href="/data-sources" />} nativeButton={false}>
            <UploadIcon />
            Upload extracts
          </Button>
        }
      />

      <DuplicateReviewPanel duplicates={result.duplicates} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Records loaded"
          value={totalRecords.toLocaleString()}
          sub={`across ${sourceCount} source(s)`}
          variant="purple"
        />
        <StatTile
          label="Matched cleanly"
          value={result.summary.matched.toLocaleString()}
          sub={formatMoney(result.summary.matchedValue)}
          subClassName="font-semibold text-emerald-700 dark:text-emerald-400"
        />
        <StatTile
          label="Flagged for investigation"
          value={result.summary.investigate.toLocaleString()}
          sub={formatMoney(result.summary.exceptionValue) + ' exposed'}
          subClassName="font-semibold text-destructive"
        />
        <StatTile
          label="High-value priority"
          value={highValueExceptions.length.toLocaleString()}
          sub="no counterpart, ≥ 5,000"
          variant="pink"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReconciliationTrendChart points={trendPoints} />
        </div>
        <div className="lg:col-span-1">
          <BankSourceCards />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AssignExceptionWidget />
        <ReconciliationFlowWidget points={trendPoints} />
        <HealthScoreGauge />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MatchRateMeter matched={result.summary.matched} total={totalGroups} />

        <Card className="lg:col-span-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Groups by status</CardTitle>
            <CardDescription>
              Count of reconciliation groups in each outcome
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart rows={rows} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Records by source</CardTitle>
            <CardDescription>Volume uploaded from each system</CardDescription>
          </CardHeader>
          <CardContent>
            <SourceTotalsChart totalsBySource={result.totalsBySource} />
          </CardContent>
        </Card>
      </div>

      <RecentMatchesTable />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Priority exceptions</CardTitle>
            <CardDescription>
              Highest-value records with no counterpart found
            </CardDescription>
          </div>
          <Button
            render={<Link href="/cards" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            View all exceptions
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <MatchTable
            groups={highValueExceptions}
            emptyLabel="No high-value exceptions right now."
          />
        </CardContent>
      </Card>
    </div>
  );
}
