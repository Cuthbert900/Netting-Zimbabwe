import { SOURCE_LABELS, type SourceKey } from '@/lib/data-sources-context';
import type { ReconciliationResult } from '@/lib/reconciliation-engine';

/** Turns the current reconciliation results into a compact text block the
 * assistant can ground its answers in. Kept short and numeric so it stays
 * cheap to send on every turn regardless of provider. */
export function buildContextSummary(result: ReconciliationResult): string {
  const { summary, totalsBySource, groups } = result;
  const totalRecords = (Object.keys(totalsBySource) as SourceKey[]).reduce(
    (s, k) => s + totalsBySource[k].count,
    0
  );

  if (totalRecords === 0) {
    return 'No extracts have been uploaded yet — the user has not loaded Dynamics, Prism, or Bank data.';
  }

  const lines: string[] = [];
  lines.push('Uploaded record counts by source:');
  for (const key of Object.keys(totalsBySource) as SourceKey[]) {
    const t = totalsBySource[key];
    if (t.count === 0) continue;
    lines.push(
      `- ${SOURCE_LABELS[key]}: ${t.count} records, net ${t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    );
  }

  lines.push('');
  lines.push(
    `Match summary: ${summary.matched} matched (value ${summary.matchedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}), ` +
      `${summary.timing} timing differences, ${summary.mispost} mis-posts, ${summary.investigate} flagged for investigation ` +
      `(exposure ${summary.exceptionValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}).`
  );

  const topExceptions = groups
    .filter((g) => g.status !== 'matched')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  if (topExceptions.length > 0) {
    lines.push('');
    lines.push('Top exceptions by value:');
    for (const g of topExceptions) {
      const sources = g.sources.map((s) => SOURCE_LABELS[s]).join(' / ');
      const ref = g.records.find((r) => r.reference)?.reference;
      lines.push(
        `- [${g.status}] ${g.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} — ${sources}${
          ref ? ` — ref ${ref}` : ''
        } — ${g.note}`
      );
    }
  }

  return lines.join('\n');
}
