import logger from '@/lib/logger';
import { normalizeExtract, type NormalizedRecord } from '@/lib/normalization';
export type { NormalizedRecord };
import type { SourceKey, StoredExtract } from '@/lib/data-sources-context';
import {
  detectDuplicates,
  type DuplicateGroup,
} from '@/lib/duplicate-detection';
import { matchKeyFor, matchPair } from '@/lib/matching';
import { UnionFind } from '@/lib/clustering';

const AMOUNT_TOLERANCE_ABS = 1; // absolute currency units — covers rounding
const AMOUNT_TOLERANCE_PCT = 0.005; // 0.5% — covers FX/fee shaving on gateway settlements
const DATE_WINDOW_DAYS = 5; // netting settlement lag between bank, prism, and D365 posting
const HIGH_VALUE_THRESHOLD = 5000; // flag unmatched records above this for investigation priority

/**
 * The status of a match group, indicating whether it's a perfect match, a
 * timing difference, a potential mis-post, or requires investigation.
 */
export type MatchStatus = 'matched' | 'timing' | 'mispost' | 'investigate';

/**
 * Represents a group of matched records from different sources.
 */
export interface MatchGroup {
  id: string;
  status: MatchStatus;
  records: NormalizedRecord[];
  sources: SourceKey[];
  amount: number;
  varianceAmount: number;
  varianceDays: number | null;
  note: string;
}

/**
 * The final result of the reconciliation process, containing matched groups,
 * summary statistics, and information about duplicate records.
 */
export interface ReconciliationResult {
  groups: MatchGroup[];
  totalsBySource: Record<SourceKey, { count: number; amount: number }>;
  /** Records excluded from matching because they look like the same
   * transaction entered more than once — see duplicate-detection.ts. Kept
   * separate from `groups` rather than folded into `investigate`, so
   * duplicate review never distorts the match-rate/status numbers. */
  duplicates: DuplicateGroup[];
  summary: {
    matched: number;
    timing: number;
    mispost: number;
    investigate: number;
    matchedValue: number;
    exceptionValue: number;
  };
}

/**
 * Normalizes every uploaded extract and pulls record-level duplicates aside,
 * per source. Shared by `reconcile()` and the balance reconciliation report
 * (balance-reconciliation.ts), so both work from the same de-duplicated pool.
 *
 * @returns `rawBySource` (every normalized row, for "records loaded" counts),
 * `bySource` (de-duplicated — what matching should use) and `duplicates`.
 */
export function prepareRecords(
  filesBySource: Record<SourceKey, StoredExtract[]>,
  ignoreDuplicateGroupIds: Set<string> = new Set()
): {
  rawBySource: Record<SourceKey, NormalizedRecord[]>;
  bySource: Record<SourceKey, NormalizedRecord[]>;
  duplicates: DuplicateGroup[];
} {
  const rawBySource: Record<SourceKey, NormalizedRecord[]> = {
    dynamics: [],
    prism: [],
    bank: [],
  };
  for (const source of Object.keys(rawBySource) as SourceKey[]) {
    for (const extract of filesBySource[source]) {
      // Not `rawBySource[source].push(...normalizeExtract(extract))` —
      // spreading a large extract's rows as call arguments hits V8's
      // argument-count limit and throws "Maximum call stack size exceeded"
      // for big uploads (same bug fixed in duplicate-detection.ts). A plain
      // loop has no such limit.
      for (const rec of normalizeExtract(extract)) {
        rawBySource[source].push(rec);
      }
    }
  }

  // Duplicate detection runs per source, before matching, so a repeated
  // transaction (duplicate file, overlapping re-export, repeated export
  // line) can't inflate matched/exception totals or manufacture a phantom
  // counterpart. Only the first occurrence of each duplicate group feeds
  // into matching; every occurrence is preserved in `duplicates` for review.
  const bySource: Record<SourceKey, NormalizedRecord[]> = {
    dynamics: [],
    prism: [],
    bank: [],
  };
  const duplicates: DuplicateGroup[] = [];
  for (const source of Object.keys(rawBySource) as SourceKey[]) {
    const { unique, duplicates: dupGroups } = detectDuplicates(
      rawBySource[source],
      ignoreDuplicateGroupIds
    );
    bySource[source] = unique;
    duplicates.push(...dupGroups);
    logger.debug(
      { source, count: unique.length, duplicates: dupGroups.length },
      'Duplicate detection complete'
    );
  }
  return { rawBySource, bySource, duplicates };
}

/**
 * The main entry point for the reconciliation process. It takes extracts from
 * different sources, normalizes them, detects duplicates, matches them, and
 * produces a final reconciliation result.
 *
 * @param filesBySource A record containing arrays of stored extracts, keyed by their source.
 * @param ignoreDuplicateGroupIds A set of duplicate group IDs to ignore,
 * allowing a reviewer to override the duplicate detection.
 * @returns The final reconciliation result.
 */
export function reconcile(
  filesBySource: Record<SourceKey, StoredExtract[]>,
  /** DuplicateGroup ids a reviewer has confirmed are not real duplicates —
   * see duplicate-overrides-context.tsx. Those records fold back into
   * matching instead of being excluded. */
  ignoreDuplicateGroupIds: Set<string> = new Set()
): ReconciliationResult {
  logger.info('Starting reconciliation process');
  try {
    const { rawBySource, bySource, duplicates } = prepareRecords(
      filesBySource,
      ignoreDuplicateGroupIds
    );

    const allRecords = [
      ...bySource.dynamics,
      ...bySource.prism,
      ...bySource.bank,
    ];
    const uf = new UnionFind();

    const sourcePairs: Array<[SourceKey, SourceKey]> = [
      ['bank', 'prism'],
      ['bank', 'dynamics'],
      ['prism', 'dynamics'],
    ];

    for (const [sa, sb] of sourcePairs) {
      if (bySource[sa].length === 0 || bySource[sb].length === 0) continue;
      logger.debug({ sourceA: sa, sourceB: sb }, 'Matching pair');
      const pairs = matchPair(bySource[sa], bySource[sb], matchKeyFor(sa, sb));
      for (const [recA, recB] of pairs) {
        uf.union(recA.key, recB.key);
      }
      logger.debug(
        { sourceA: sa, sourceB: sb, pairs: pairs.length },
        'Matching complete'
      );
    }

    const clusters = new Map<string, NormalizedRecord[]>();
    for (const rec of allRecords) {
      const root = uf.find(rec.key);
      const list = clusters.get(root) ?? [];
      list.push(rec);
      clusters.set(root, list);
    }

    const groups: MatchGroup[] = [];
    let gid = 0;
    for (const records of clusters.values()) {
      const sources = Array.from(new Set(records.map((r) => r.source)));
      const amounts = records
        .map((r) => r.amount)
        .filter((a): a is number => a !== null);
      const avgAmount = amounts.length
        ? amounts.reduce((s, a) => s + Math.abs(a), 0) / amounts.length
        : 0;
      const maxDiff =
        amounts.length > 1
          ? Math.max(...amounts.map((a) => Math.abs(a))) -
            Math.min(...amounts.map((a) => Math.abs(a)))
          : 0;
      const dates = records
        .map((r) => r.date)
        .filter((d): d is Date => d !== null);
      const maxDayDiff =
        dates.length > 1
          ? Math.max(...dates.map((d) => d.getTime())) -
            Math.min(...dates.map((d) => d.getTime()))
          : 0;
      const varianceDays =
        dates.length > 1 ? Math.round(maxDayDiff / 86_400_000) : null;

      const uploadedSources = (
        ['dynamics', 'prism', 'bank'] as SourceKey[]
      ).filter((s) => filesBySource[s].length > 0);
      const missingSources = uploadedSources.filter(
        (s) => !sources.includes(s)
      );

      let status: MatchStatus;
      let note: string;

      if (records.length === 1) {
        status = 'investigate';
        const rec = records[0];
        note =
          rec.absAmount >= HIGH_VALUE_THRESHOLD
            ? `No counterpart found in the other sources — high value, flagged for priority investigation`
            : `No counterpart found in the other sources within the ${DATE_WINDOW_DAYS}-day matching window`;
      } else if (missingSources.length > 0) {
        // Matched in at least two sources, but not every uploaded source has a counterpart in this cluster.
        status = 'investigate';
        note = `Matched across ${sources.length} of the uploaded sources — missing a counterpart in ${missingSources.join(', ')}`;
      } else if (
        maxDiff >
        Math.max(AMOUNT_TOLERANCE_ABS, avgAmount * AMOUNT_TOLERANCE_PCT) + 0.005
      ) {
        status = 'mispost';
        note = `Amount differs by ${maxDiff.toLocaleString(undefined, { maximumFractionDigits: 2 })} across matched records — possible mis-post`;
      } else if (varianceDays !== null && varianceDays > 0) {
        status = 'timing';
        note = `Posted ${varianceDays} day${varianceDays > 1 ? 's' : ''} apart across sources — timing difference`;
      } else {
        status = 'matched';
        note = 'Amount and date agree across all matched sources';
      }

      groups.push({
        id: `grp-${gid++}`,
        status,
        records,
        sources,
        amount: avgAmount,
        varianceAmount: maxDiff,
        varianceDays,
        note,
      });
    }

    groups.sort((a, b) => b.amount - a.amount);

    // Deliberately counted from the raw (pre-dedup) pool, not `bySource` — this
    // is "records loaded", matching what Data Sources shows was uploaded. The
    // matching/summary numbers below use the deduped pool instead.
    const totalsBySource: Record<SourceKey, { count: number; amount: number }> =
      {
        dynamics: { count: 0, amount: 0 },
        prism: { count: 0, amount: 0 },
        bank: { count: 0, amount: 0 },
      };
    for (const source of Object.keys(totalsBySource) as SourceKey[]) {
      totalsBySource[source].count = rawBySource[source].length;
      totalsBySource[source].amount = rawBySource[source].reduce(
        (s, r) => s + (r.amount ?? 0),
        0
      );
    }

    const summary = {
      matched: groups.filter((g) => g.status === 'matched').length,
      timing: groups.filter((g) => g.status === 'timing').length,
      mispost: groups.filter((g) => g.status === 'mispost').length,
      investigate: groups.filter((g) => g.status === 'investigate').length,
      matchedValue: groups
        .filter((g) => g.status === 'matched')
        .reduce((s, g) => s + g.amount, 0),
      exceptionValue: groups
        .filter((g) => g.status !== 'matched')
        .reduce((s, g) => s + g.amount, 0),
    };

    logger.info({ summary }, 'Reconciliation process complete');
    return { groups, totalsBySource, duplicates, summary };
  } catch (error) {
    logger.error(error, 'An unexpected error occurred during reconciliation');
    throw error;
  }
}
