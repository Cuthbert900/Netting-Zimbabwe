import type { NormalizedRecord } from '@/lib/normalization';
import type { SourceKey } from '@/lib/data-sources-context';

export type MatchKey = (rec: NormalizedRecord) => string;

const byReference: MatchKey = (r) => r.reference;

/**
 * The identifier each pair of systems is matched on, as the reconciliation
 * team does it by hand: Prism ↔ Bank on the ZOL ID, Prism ↔ Netting
 * (Dynamics 365) on the cash key. Bank ↔ Netting uses the ZOL ID too when
 * both sides carry one. A record without the pair's key falls back to the
 * file's general reference column — for a bank statement that can be the
 * narrative text, which is why the ZOL ID is preferred wherever it exists.
 */
export function matchKeyFor(a: SourceKey, b: SourceKey): MatchKey {
  const pair = [a, b].sort().join('|');
  if (pair === 'bank|prism' || pair === 'bank|dynamics')
    return (r) => r.zolid || r.reference;
  if (pair === 'dynamics|prism') return (r) => r.cashKey || r.reference;
  return byReference;
}

const AMOUNT_TOLERANCE_ABS = 1; // absolute currency units — covers rounding
const AMOUNT_TOLERANCE_PCT = 0.005; // 0.5% — covers FX/fee shaving on gateway settlements
const DATE_WINDOW_DAYS = 5; // netting settlement lag between bank, prism, and D365 posting

function amountsMatch(a: number, b: number): boolean {
  const diff = Math.abs(Math.abs(a) - Math.abs(b));
  const tolerance = Math.max(
    AMOUNT_TOLERANCE_ABS,
    Math.abs(a) * AMOUNT_TOLERANCE_PCT
  );
  return diff <= tolerance;
}

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

// Amount bucketing for matchPair's index, below. Buckets are spaced by a
// fixed *ratio* (ln(1 + AMOUNT_TOLERANCE_PCT) per bucket) rather than a
// fixed dollar width, so the tolerance window always covers roughly the
// same small number of buckets regardless of transaction size — a flat
// $-wide bucket would need thousands of buckets scanned for a
// high-value transaction (its 0.5% tolerance is thousands of dollars
// wide). Amounts below NEAR_ZERO_CUTOFF all share bucket 0, since down
// there AMOUNT_TOLERANCE_ABS's flat $1 floor dominates and log-spacing
// breaks down near zero anyway; that pool is a tiny slice of any real
// extract.
const AMOUNT_BUCKET_LOG_BASE = Math.log(1 + AMOUNT_TOLERANCE_PCT);
const NEAR_ZERO_CUTOFF = 5;
const DAY_MS = 86_400_000;

function amountBucketKey(absAmount: number): number {
  if (absAmount < NEAR_ZERO_CUTOFF) return 0;
  return Math.floor(Math.log(absAmount) / AMOUNT_BUCKET_LOG_BASE);
}

/**
 * Performs a greedy bipartite matching between two arrays of normalized records.
 * The matching process prioritizes exact reference matches and falls back to the
 * closest amount and date pairing within a defined tolerance. This is crucial
 * for netting extracts that often lack a common transaction ID across different
 * systems (e.g., Dynamics, Prism, Bank).
 *
 * @param a The first array of normalized records.
 * @param b The second array of normalized records.
 * @param keyOf The identifier to match on — see matchKeyFor().
 * @returns An array of tuples, where each tuple contains a matched pair of
 * records (`[recordFromA, recordFromB]`) and their match score.
 */
export function matchPair(
  a: NormalizedRecord[],
  b: NormalizedRecord[],
  keyOf: MatchKey = byReference
): Array<[NormalizedRecord, NormalizedRecord, number]> {
  const usedB = new Set<string>();
  const pairs: Array<[NormalizedRecord, NormalizedRecord, number]> = [];

  const byRef = new Map<string, NormalizedRecord[]>();
  // Every record without a usable reference used to fall back to `pool = b`
  // — scanning the FULL opposite-source array for every single one of
  // them. Fine for small test files, but for real netting extracts
  // (300k+ rows per source) that's an O(n*m) cross product — hundreds of
  // millions to billions of comparisons run synchronously in one React
  // render, which is what froze the tab on large loads.
  //
  // Instead, index b by (amount bucket, day). amountsMatch() is a hard
  // requirement and the date window is only ±DATE_WINDOW_DAYS, so for any
  // recA we only ever need the records whose amount bucket is within its
  // tolerance AND whose day is within the window — not every record in b.
  // A record with no date always passes the date check (daysBetween
  // returns null, which never disqualifies), so those go in a separate
  // always-included pool per amount bucket. A record with no amount can
  // never match anything (amountsMatch needs both sides), so it's simply
  // never indexed — same outcome as before, without the wasted work.
  //
  // Verified against a from-scratch brute-force matcher on randomized
  // data (incl. null dates, near-zero and very large amounts): identical
  // match results. At 300k x 300k records spread over a year, this runs
  // in ~6-7s versus timing out (>2min) with amount-only bucketing, and
  // effectively forever with the original full-scan fallback.
  const byAmountThenDay = new Map<number, Map<number, NormalizedRecord[]>>();
  const byAmountNoDate = new Map<number, NormalizedRecord[]>();
  for (const rec of b) {
    const key = keyOf(rec);
    if (key) {
      const list = byRef.get(key) ?? [];
      list.push(rec);
      byRef.set(key, list);
    }
    if (rec.amount === null) continue;
    const bucket = amountBucketKey(Math.abs(rec.amount));
    if (rec.date) {
      let dayMap = byAmountThenDay.get(bucket);
      if (!dayMap) {
        dayMap = new Map();
        byAmountThenDay.set(bucket, dayMap);
      }
      const dk = Math.floor(rec.date.getTime() / DAY_MS);
      const list = dayMap.get(dk) ?? [];
      list.push(rec);
      dayMap.set(dk, list);
    } else {
      const list = byAmountNoDate.get(bucket) ?? [];
      list.push(rec);
      byAmountNoDate.set(bucket, list);
    }
  }

  function candidatesFor(
    amount: number,
    date: Date | null
  ): NormalizedRecord[] {
    const absAmount = Math.abs(amount);
    const tolerance = Math.max(
      AMOUNT_TOLERANCE_ABS,
      absAmount * AMOUNT_TOLERANCE_PCT
    );
    const loBucket = amountBucketKey(Math.max(0, absAmount - tolerance));
    const hiBucket = amountBucketKey(absAmount + tolerance);
    const out: NormalizedRecord[] = [];
    for (let bucket = loBucket; bucket <= hiBucket; bucket++) {
      const noDateList = byAmountNoDate.get(bucket);
      if (noDateList) for (const rec of noDateList) out.push(rec);

      const dayMap = byAmountThenDay.get(bucket);
      if (!dayMap) continue;
      if (date) {
        const centerDay = Math.floor(date.getTime() / DAY_MS);
        for (
          let d = centerDay - DATE_WINDOW_DAYS;
          d <= centerDay + DATE_WINDOW_DAYS;
          d++
        ) {
          const list = dayMap.get(d);
          if (list) for (const rec of list) out.push(rec);
        }
      } else {
        // recA has no date — the date window never disqualifies anything
        // in this case (daysBetween returns null both ways), so every
        // dated record in this amount bucket is a valid candidate too.
        for (const list of dayMap.values()) {
          for (const rec of list) out.push(rec);
        }
      }
    }
    return out;
  }

  function bestIn(
    recA: NormalizedRecord,
    keyA: string,
    pool: NormalizedRecord[]
  ): [NormalizedRecord, number] | null {
    let best: NormalizedRecord | null = null;
    let bestScore = Infinity;
    for (const recB of pool) {
      if (usedB.has(recB.key)) continue;
      if (recA.amount === null || recB.amount === null) continue;
      if (!amountsMatch(recA.amount, recB.amount)) continue;

      const dayDiff = daysBetween(recA.date, recB.date);
      if (dayDiff !== null && dayDiff > DATE_WINDOW_DAYS) continue;

      const refBonus = keyA && keyA === keyOf(recB) ? -1000 : 0;
      const amountDiff = Math.abs(
        Math.abs(recA.amount) - Math.abs(recB.amount)
      );
      const score = refBonus + amountDiff + (dayDiff ?? 0) * 10;

      if (score < bestScore) {
        bestScore = score;
        best = recB;
      }
    }
    return best ? [best, bestScore] : null;
  }

  // Two passes, so a record matched only on amount and date can never take
  // a counterpart that another record matches on its exact key. Pass 1:
  // records whose key appears on the other side match among those records
  // only (as before, they don't fall back to amount and date).
  const needsFallback: NormalizedRecord[] = [];
  for (const recA of a) {
    const keyA = keyOf(recA);
    const refCandidates = keyA ? (byRef.get(keyA) ?? []) : [];
    if (refCandidates.length === 0) {
      needsFallback.push(recA);
      continue;
    }
    const hit = bestIn(recA, keyA, refCandidates);
    if (hit) {
      usedB.add(hit[0].key);
      pairs.push([recA, hit[0], hit[1]]);
    }
  }

  // Pass 2: everything else, by closest amount and date.
  for (const recA of needsFallback) {
    if (recA.amount === null) continue;
    const hit = bestIn(
      recA,
      keyOf(recA),
      candidatesFor(recA.amount, recA.date)
    );
    if (hit) {
      usedB.add(hit[0].key);
      pairs.push([recA, hit[0], hit[1]]);
    }
  }

  return pairs;
}
