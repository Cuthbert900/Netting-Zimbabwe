// Duplicate detection — two distinct problems, handled separately:
//
//  1. File-level: the exact same extract gets uploaded twice (an accidental
//     re-drag, re-selecting a file that's already loaded). Caught at upload
//     time, before it ever reaches the reconciliation engine.
//
//  2. Record-level: the same underlying transaction appears twice within a
//     source's records — from a duplicate file that slipped through, an
//     overlapping re-export (e.g. a bank re-sends a statement covering some
//     of the same dates), or a repeated line in the source export itself.
//     Caught inside the engine, before matching, so a duplicated row can't
//     silently inflate matched/exception totals or manufacture a phantom
//     counterpart.
//
// Neither layer deletes anything — duplicates are pulled aside for a human
// to review (a "Possible Duplicates" panel), never auto-discarded. Financial
// data should never disappear without someone looking at it first.

import type { ExtractRow, ParsedExtract } from '@/lib/extract-parser';
import type { NormalizedRecord } from '@/lib/reconciliation-engine';

// ---- File-level fingerprint ----------------------------------------------

/** Cheap, deterministic, non-cryptographic hash (FNV-1a) — good enough to
 * recognize "this is the same file's content" without the cost of a real
 * crypto hash over every upload. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/** Fingerprints an extract by its row count plus a hash of the row content.
 * Deliberately ignores the file name — a re-export saved under a different
 * name (e.g. "CABS March (1).xlsx") with identical rows still gets caught. */
export function fingerprintExtract(
  extract: Pick<ParsedExtract, 'rows' | 'rowCount'>
): string {
  return `${extract.rowCount}:${fnv1a(JSON.stringify(extract.rows))}`;
}

// ---- Record-level duplicates ----------------------------------------------

export interface DuplicateGroup {
  source: NormalizedRecord['source'];
  key: string;
  reason: 'reference' | 'identical-row';
  records: NormalizedRecord[];
}

function stableRowKey(raw: ExtractRow): string {
  return Object.keys(raw)
    .sort()
    .map((k) => `${k}=${String(raw[k])}`)
    .join('|');
}

/**
 * Within a single source's records, finds groups that look like the same
 * transaction entered more than once — either sharing a reference *and*
 * amount *and* date (strong signal — a bare reference match isn't enough:
 * many bank exports put a reusable narrative like "MERCHANT SETTLEMENT
 * CABSBILLPAYAMT" in what looks like a reference/ID column, and dozens of
 * genuinely distinct transactions share that same text), or having
 * byte-identical row content when there's no reference to key off (a
 * genuinely duplicated line, as opposed to two different transactions that
 * merely happen to share an amount and date). Returns the deduplicated set
 * — first occurrence of each group kept — to feed into matching, plus every
 * group found so nothing is silently lost.
 */
export function detectDuplicates(
  records: NormalizedRecord[],
  /** DuplicateGroup ids a reviewer has already confirmed are NOT duplicates
   * (see duplicate-overrides-context.tsx). All records in an ignored group
   * are treated as unique and fold back into matching. */
  ignoreGroupIds: Set<string> = new Set()
): {
  unique: NormalizedRecord[];
  duplicates: DuplicateGroup[];
} {
  const byRef = new Map<string, NormalizedRecord[]>();
  const noRef: NormalizedRecord[] = [];

  for (const rec of records) {
    if (rec.reference && rec.amount !== null && rec.date) {
      const key = `${rec.reference}|${rec.amount}|${rec.date.toISOString().slice(0, 10)}`;
      const list = byRef.get(key) ?? [];
      list.push(rec);
      byRef.set(key, list);
    } else {
      noRef.push(rec);
    }
  }

  const byRow = new Map<string, NormalizedRecord[]>();
  for (const rec of noRef) {
    const key = stableRowKey(rec.raw);
    const list = byRow.get(key) ?? [];
    list.push(rec);
    byRow.set(key, list);
  }

  const unique: NormalizedRecord[] = [];
  const duplicates: DuplicateGroup[] = [];

  for (const [ref, list] of byRef) {
    const id = `${list[0].source}:ref:${ref}`;
    if (ignoreGroupIds.has(id)) {
      // Not `unique.push(...list)` — spreading a large array as call
      // arguments hits V8's argument-count limit and throws "Maximum call
      // stack size exceeded" once a duplicate group gets big enough (seen
      // in production on large extracts, inside this function's caller's
      // useMemo). A plain loop has no such limit.
      for (const rec of list) unique.push(rec);
      continue;
    }
    unique.push(list[0]);
    if (list.length > 1)
      duplicates.push({
        source: list[0].source,
        key: id,
        reason: 'reference',
        records: list,
      });
  }
  for (const [rowKey, list] of byRow) {
    const id = `${list[0].source}:row:${rowKey}`;
    if (ignoreGroupIds.has(id)) {
      for (const rec of list) unique.push(rec);
      continue;
    }
    unique.push(list[0]);
    if (list.length > 1)
      duplicates.push({
        source: list[0].source,
        key: id,
        reason: 'identical-row',
        records: list,
      });
  }

  return { unique, duplicates };
}
