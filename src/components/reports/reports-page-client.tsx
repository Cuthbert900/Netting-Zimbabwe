'use client';

// The Reports page: four report types the user scoped explicitly
// (reconciliation summary, exception detail, duplicate review log, an
// AI-written narrative summary), each exportable as PDF and Excel/CSV.
// Everything runs client-side — jsPDF + jspdf-autotable for PDF,
// SheetJS (xlsx, already used for extract parsing) for Excel — against
// the same live reconciliation data every other page reads, so a report
// is never stale relative to what's on screen.

import { useMemo, useState } from 'react';
import {
  FileStackIcon,
  FileTextIcon,
  TriangleAlertIcon,
  CopyIcon,
  SparklesIcon,
  FileDownIcon,
  Loader2Icon,
  InfoIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/reconciliation-overview/stat-tile';
import { BalanceReconciliationCard } from '@/components/reports/balance-reconciliation-card';
import { useReconciliation } from '@/lib/reconciliation-context';
import { useDuplicateOverrides } from '@/lib/duplicate-overrides-context';
import { useAiUsage } from '@/lib/ai-usage-context';
import { buildContextSummary } from '@/lib/ai/context';
import type { TokenUsage } from '@/lib/ai/providers';
import {
  buildReconciliationSummaryReport,
  buildExceptionDetailReport,
  buildDuplicateReviewReport,
  type ReportTableData,
} from '@/lib/reports';
import {
  exportReportToPdf,
  exportReportToExcel,
  exportNarrativeToPdf,
  exportNarrativeToExcel,
} from '@/lib/report-export';

const NARRATIVE_PROVIDER = 'ai-factory';

const NARRATIVE_PROMPT =
  'Write a formal narrative summary of this reconciliation period suitable for inclusion in a report to ' +
  'Treasury & Billing leadership. Cover: overall reconciliation health and match rate, the most significant ' +
  'exceptions and what likely caused them, any duplicate-record activity worth noting, and a short closing ' +
  'recommendation on what to prioritize next. Write in full paragraphs, no headings or bullet points, three ' +
  'to five paragraphs.';

function ReportCard({
  icon,
  data,
  count,
  countLabel,
}: {
  icon: React.ReactNode;
  data: ReportTableData;
  count: number;
  countLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {data.title}
        </CardTitle>
        <CardDescription>{data.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary" className="font-normal">
          {count.toLocaleString()} {countLabel}
        </Badge>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="sm" onClick={() => exportReportToPdf(data)}>
          <FileDownIcon className="size-3.5" />
          Export PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportReportToExcel(data)}
        >
          <FileDownIcon className="size-3.5" />
          Export Excel
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ReportsPageClient() {
  const result = useReconciliation();
  const { dismissed } = useDuplicateOverrides();
  const { logUsage } = useAiUsage();

  const totalRecords =
    result.totalsBySource.dynamics.count +
    result.totalsBySource.prism.count +
    result.totalsBySource.bank.count;

  const contextSummary = useMemo(() => buildContextSummary(result), [result]);
  const summaryReport = useMemo(
    () => buildReconciliationSummaryReport(result),
    [result]
  );
  const exceptionReport = useMemo(
    () => buildExceptionDetailReport(result),
    [result]
  );
  const duplicateReport = useMemo(
    () => buildDuplicateReviewReport(result, dismissed),
    [result, dismissed]
  );

  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeDemo, setNarrativeDemo] = useState(false);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  const periodLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  async function generateNarrative() {
    setNarrativeLoading(true);
    setNarrativeError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: NARRATIVE_PROVIDER,
          context: contextSummary,
          messages: [{ role: 'user', content: NARRATIVE_PROMPT }],
        }),
      });
      const data: {
        reply: string;
        usage?: TokenUsage;
        configured: boolean;
        error?: string;
      } = await res.json();
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);

      setNarrative(data.reply);
      setNarrativeDemo(!data.configured);
      logUsage({
        provider: NARRATIVE_PROVIDER,
        usage: data.usage ?? null,
        source: 'reports',
      });
    } catch (e) {
      setNarrativeError(
        e instanceof Error
          ? e.message
          : 'Something went wrong generating the narrative'
      );
    } finally {
      setNarrativeLoading(false);
    }
  }

  if (totalRecords === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <FileStackIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">No extracts uploaded yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Reports fill in once Dynamics, Prism, or bank extracts are loaded on
            Data Sources — each report is generated from whatever is currently
            reconciled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary dark:text-foreground">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate a report from the current reconciliation data — exported as
          PDF or Excel, entirely in this browser.
        </p>
      </div>

      <BalanceReconciliationCard />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Records in scope"
          value={totalRecords.toLocaleString()}
          sub="across all uploaded sources"
          variant="purple"
        />
        <StatTile
          label="Sources covered"
          value={summaryReport.rows.length.toLocaleString()}
          sub="in the reconciliation summary"
        />
        <StatTile
          label="Duplicate groups"
          value={duplicateReport.rows.length.toLocaleString()}
          sub="in the duplicate review log"
        />
        <StatTile
          label="Exceptions"
          value={exceptionReport.rows.length.toLocaleString()}
          sub="in the exception detail listing"
          variant="pink"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReportCard
          icon={<FileTextIcon className="size-4 text-primary" />}
          data={summaryReport}
          count={summaryReport.rows.length}
          countLabel="sources covered"
        />
        <ReportCard
          icon={
            <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />
          }
          data={exceptionReport}
          count={exceptionReport.rows.length}
          countLabel="exceptions"
        />
        <ReportCard
          icon={
            <CopyIcon className="size-4 text-blue-600 dark:text-blue-400" />
          }
          data={duplicateReport}
          count={duplicateReport.rows.length}
          countLabel="duplicate groups"
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SparklesIcon className="size-4 text-primary" />
              AI-Written Narrative Summary
            </CardTitle>
            <CardDescription>
              A formal, generated write-up of the period for{' '}
              {'Treasury & Billing'} leadership — prose, not a table.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {narrative && (
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {narrative}
              </div>
            )}
            {narrativeDemo && narrative && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground opacity-80">
                <InfoIcon className="size-3" />
                Demo mode — no API key configured for this provider
              </div>
            )}
            {narrativeError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {narrativeError}
              </div>
            )}
            {!narrative && !narrativeError && (
              <p className="text-xs text-muted-foreground">
                Generate the narrative first, then export it — it isn&apos;t
                written until you ask, so nothing is spent on tokens you
                don&apos;t use.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateNarrative}
              disabled={narrativeLoading}
            >
              {narrativeLoading ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="size-3.5" />
              )}
              {narrative ? 'Regenerate' : 'Generate'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!narrative}
              onClick={() =>
                narrative &&
                exportNarrativeToPdf(periodLabel, narrative, narrativeDemo)
              }
            >
              <FileDownIcon className="size-3.5" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!narrative}
              onClick={() =>
                narrative &&
                exportNarrativeToExcel(periodLabel, narrative, narrativeDemo)
              }
            >
              <FileDownIcon className="size-3.5" />
              Export Excel
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
