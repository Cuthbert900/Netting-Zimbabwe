// Derived, read-only views over a ReconciliationResult for charts — kept
// separate from reconciliation-engine.ts so the matching logic stays
// focused on producing groups, not presentation-shaped aggregates.

import type { SourceKey } from '@/lib/data-sources-context';
import type {
  MatchGroup,
  MatchStatus,
  NormalizedRecord,
} from '@/lib/reconciliation-engine';

export interface StatusBreakdownRow {
  status: MatchStatus;
  count: number;
  value: number;
}

export function statusBreakdown(groups: MatchGroup[]): StatusBreakdownRow[] {
  const order: MatchStatus[] = ['matched', 'timing', 'mispost', 'investigate'];
  return order.map((status) => {
    const rows = groups.filter((g) => g.status === status);
    return {
      status,
      count: rows.length,
      value: rows.reduce((s, g) => s + g.amount, 0),
    };
  });
}

export interface DailyExceptionPoint {
  date: string; // yyyy-MM-dd
  value: number;
  count: number;
}

/** Buckets non-matched groups by the earliest record date in the group, so
 * Treasury can see whether exceptions cluster around particular days (e.g.
 * month-end settlement runs) rather than being spread evenly. */
export function dailyExceptionTrend(
  groups: MatchGroup[]
): DailyExceptionPoint[] {
  const byDay = new Map<string, { value: number; count: number }>();

  for (const g of groups) {
    if (g.status === 'matched') continue;
    const dates = g.records
      .map((r) => r.date)
      .filter((d): d is Date => d !== null);
    if (dates.length === 0) continue;
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const key = earliest.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { value: 0, count: 0 };
    entry.value += g.amount;
    entry.count += 1;
    byDay.set(key, entry);
  }

  return Array.from(byDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface DailyFlowPoint {
  date: string; // yyyy-MM-dd
  matched: number;
  exception: number;
}

/** Every group (matched or not) bucketed by its earliest record date, split
 * into matched value vs. flagged (timing/mispost/investigate) value — the
 * reconciliation-domain read on "money in / money out": clean value settling
 * vs. value still needing a human. */
export function dailyMatchedVsExceptionTrend(
  groups: MatchGroup[]
): DailyFlowPoint[] {
  const byDay = new Map<string, { matched: number; exception: number }>();

  for (const g of groups) {
    const dates = g.records
      .map((r) => r.date)
      .filter((d): d is Date => d !== null);
    if (dates.length === 0) continue;
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const key = earliest.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { matched: 0, exception: 0 };
    if (g.status === 'matched') entry.matched += g.amount;
    else entry.exception += g.amount;
    byDay.set(key, entry);
  }

  return Array.from(byDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface PairCoverage {
  pair: [SourceKey, SourceKey];
  coveredA: number;
  totalA: number;
  coveredB: number;
  totalB: number;
}

/** For each pair of uploaded sources, what fraction of each side's records
 * landed in a match group that also contains a record from the other side —
 * a direct read on "how well does bank tie out to Prism" etc., independent
 * of whether a third source is also present in that group. */
export function pairCoverage(
  groups: MatchGroup[],
  filesBySource: Record<SourceKey, { length: number }>
): PairCoverage[] {
  const pairs: Array<[SourceKey, SourceKey]> = [
    ['bank', 'prism'],
    ['bank', 'dynamics'],
    ['prism', 'dynamics'],
  ];

  const bySourceRecords: Record<SourceKey, NormalizedRecord[]> = {
    dynamics: [],
    prism: [],
    bank: [],
  };
  for (const g of groups) {
    for (const r of g.records) bySourceRecords[r.source].push(r);
  }

  return pairs
    .filter(
      ([a, b]) => filesBySource[a].length > 0 && filesBySource[b].length > 0
    )
    .map(([a, b]) => {
      let coveredA = 0;
      let coveredB = 0;
      for (const g of groups) {
        const hasA = g.sources.includes(a);
        const hasB = g.sources.includes(b);
        if (hasA && hasB) {
          coveredA += g.records.filter((r) => r.source === a).length;
          coveredB += g.records.filter((r) => r.source === b).length;
        }
      }
      return {
        pair: [a, b] as [SourceKey, SourceKey],
        coveredA,
        totalA: bySourceRecords[a].length,
        coveredB,
        totalB: bySourceRecords[b].length,
      };
    });
}
