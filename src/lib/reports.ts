// Pure data builders for the Reports page — turn the live reconciliation
// result (and duplicate-review state) into flat tabular structures that
// both the PDF and Excel exporters can render, without either exporter
// needing to know anything about the reconciliation engine's shape.

import { SOURCE_LABELS, type SourceKey } from '@/lib/data-sources-context';
import type { ReconciliationResult } from '@/lib/reconciliation-engine';

export interface ReportTableData {
  title: string;
  /** Short human-readable line describing the report, shown under the title. */
  description: string;
  generatedAt: string;
  columns: string[];
  rows: (string | number)[][];
  /** Extra summary lines rendered above the table (e.g. totals). */
  meta: string[];
}

function fmtAmount(n: number): string {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function buildReconciliationSummaryReport(
  result: ReconciliationResult
): ReportTableData {
  const { summary, totalsBySource } = result;
  const columns = ['Source', 'Records', 'Net Value'];
  const rows: (string | number)[][] = (
    Object.keys(totalsBySource) as SourceKey[]
  )
    .filter((k) => totalsBySource[k].count > 0)
    .map((k) => [
      SOURCE_LABELS[k],
      totalsBySource[k].count,
      fmtAmount(totalsBySource[k].amount),
    ]);

  const totalRecords =
    summary.matched + summary.timing + summary.mispost + summary.investigate;
  const matchRate =
    totalRecords > 0
      ? ((summary.matched / totalRecords) * 100).toFixed(1)
      : '0.0';

  return {
    title: 'Reconciliation Summary',
    description:
      'Record counts and net value by source, plus the overall match breakdown for the current period.',
    generatedAt: new Date().toISOString(),
    columns,
    rows,
    meta: [
      `Match rate: ${matchRate}% (${summary.matched} of ${totalRecords} groups)`,
      `Matched value: ${fmtAmount(summary.matchedValue)}`,
      `Timing differences: ${summary.timing}`,
      `Mis-posts: ${summary.mispost}`,
      `Flagged for investigation: ${summary.investigate}`,
      `Total exception exposure: ${fmtAmount(summary.exceptionValue)}`,
    ],
  };
}

export function buildExceptionDetailReport(
  result: ReconciliationResult
): ReportTableData {
  const columns = [
    'Status',
    'Sources',
    'Amount',
    'Variance',
    'Reference',
    'Note',
  ];
  const exceptions = result.groups
    .filter((g) => g.status !== 'matched')
    .sort((a, b) => b.amount - a.amount);

  const rows: (string | number)[][] = exceptions.map((g) => {
    const ref = g.records.find((r) => r.reference)?.reference || '—';
    const variance =
      g.varianceAmount !== 0
        ? fmtAmount(g.varianceAmount)
        : g.varianceDays != null
          ? `${g.varianceDays}d`
          : '—';
    return [
      g.status[0].toUpperCase() + g.status.slice(1),
      g.sources.map((s) => SOURCE_LABELS[s]).join(' / '),
      fmtAmount(g.amount),
      variance,
      ref,
      g.note,
    ];
  });

  return {
    title: 'Exception Detail Listing',
    description:
      'Every unmatched or flagged group in the current period — timing differences, mis-posts, and items sent for investigation — sorted by value.',
    generatedAt: new Date().toISOString(),
    columns,
    rows,
    meta: [
      `${rows.length} exceptions`,
      `Total exposure: ${fmtAmount(result.summary.exceptionValue)}`,
    ],
  };
}

export function buildDuplicateReviewReport(
  result: ReconciliationResult,
  dismissed: Set<string>
): ReportTableData {
  const columns = ['Source', 'Reason', 'Records', 'Amount', 'Status'];
  const rows: (string | number)[][] = result.duplicates.map((d) => {
    const amount = d.records.reduce((s, r) => s + (r.amount ?? 0), 0);
    return [
      SOURCE_LABELS[d.source],
      d.reason === 'reference' ? 'Same reference' : 'Identical row',
      d.records.length,
      fmtAmount(amount),
      dismissed.has(d.key) ? 'Dismissed — not a duplicate' : 'Pending review',
    ];
  });

  const pending = result.duplicates.filter((d) => !dismissed.has(d.key)).length;

  return {
    title: 'Duplicate Review Log',
    description:
      'Record groups the duplicate detector pulled aside as possible re-entries, and whether a reviewer has since confirmed or dismissed each one.',
    generatedAt: new Date().toISOString(),
    columns,
    rows,
    meta: [
      `${result.duplicates.length} groups flagged`,
      `${pending} still pending review`,
    ],
  };
}
