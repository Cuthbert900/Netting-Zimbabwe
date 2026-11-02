import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/components/matches/match-status-badge';
import { StatTile } from '@/components/reconciliation-overview/stat-tile';
import type { ReconciliationResult } from '@/lib/reconciliation-engine';

interface MatchSummaryProps {
  result: ReconciliationResult;
}

export function MatchSummary({ result }: MatchSummaryProps) {
  const { summary, totalsBySource } = result;
  const totalRecords =
    totalsBySource.dynamics.count +
    totalsBySource.prism.count +
    totalsBySource.bank.count;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Matched"
        value={summary.matched.toLocaleString()}
        sub={formatMoney(summary.matchedValue)}
        variant="purple"
      />
      <StatTile
        label="Timing differences"
        value={summary.timing.toLocaleString()}
        sub="posted on different dates"
      />
      <StatTile
        label="Mis-posts"
        value={summary.mispost.toLocaleString()}
        sub="amount variance across sources"
      />
      <StatTile
        label="Investigate"
        value={summary.investigate.toLocaleString()}
        sub={formatMoney(summary.exceptionValue) + ' exposed'}
        variant="pink"
      />
      {totalRecords === 0 && (
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No extracts uploaded yet — go to Data Sources and upload Dynamics,
            Prism, or Bank extracts to see reconciliation results here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
