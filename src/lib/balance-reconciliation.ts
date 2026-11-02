// Balance reconciliation for the Netting control account — the signed-off
// front page of the month-end reconciliation pack:
//
//   1.   Balance as at the first of the month       (carried over)
//   1.1. Reconciling items                          (computed here)
//        Subtotal = 1 + 1.1
//   2.   Balance as per General Ledger (TB)          (entered)
//   3.   Difference = Subtotal - 2                   (should be 0.00)
//
// Each reconciling item is the value of the items left unmatched between two
// systems for the reporting month. "Netting" in the item names is the
// Dynamics 365 ledger. Every figure is calculated here, never by the AI — the
// AI only drafts the Comments box from these numbers.

import type { SourceKey } from '@/lib/data-sources-context';
import type { NormalizedRecord } from '@/lib/normalization';
import { matchKeyFor, matchPair } from '@/lib/matching';

export const NETTING_ACCOUNT = {
  name: 'Netting Account',
  number: '60703003',
} as const;

/** Shown in the report's column header when the uploads carry no currency. */
export const DEFAULT_REPORT_CURRENCY = 'ZWL';

export interface ReportingPeriod {
  year: number;
  /** 1-12 */
  month: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function inPeriod(date: Date, period: ReportingPeriod): boolean {
  return (
    date.getUTCFullYear() === period.year &&
    date.getUTCMonth() + 1 === period.month
  );
}

/** The month most of the dated records fall in, or null if none are dated.
 * Ties go to the later month — a month-end pack is usually built from
 * extracts that spill a few days into the next month, not the reverse. */
export function detectReportingPeriod(
  records: NormalizedRecord[]
): ReportingPeriod | null {
  const counts = new Map<number, number>();
  for (const rec of records) {
    if (!rec.date) continue;
    const k = rec.date.getUTCFullYear() * 12 + rec.date.getUTCMonth();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [k, n] of counts) {
    if (
      best === null ||
      n > counts.get(best)! ||
      (n === counts.get(best)! && k > best)
    ) {
      best = k;
    }
  }
  if (best === null) return null;
  return { year: Math.floor(best / 12), month: (best % 12) + 1 };
}

export function previousPeriod(period: ReportingPeriod): ReportingPeriod {
  return period.month === 1
    ? { year: period.year - 1, month: 12 }
    : { year: period.year, month: period.month - 1 };
}

/** "2026-03-01" — the key a period is stored under. */
export function periodKey(period: ReportingPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`;
}

/** "Mar-26" */
export function formatPeriodShort(period: ReportingPeriod): string {
  return `${MONTHS[period.month - 1].slice(0, 3)}-${String(period.year).slice(-2)}`;
}

/** "01 March 2026" */
export function formatPeriodOpening(period: ReportingPeriod): string {
  return `01 ${MONTHS[period.month - 1]} ${period.year}`;
}

/** "31 Mar 2026" */
export function formatPeriodClosing(period: ReportingPeriod): string {
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  return `${lastDay} ${MONTHS[period.month - 1].slice(0, 3)} ${period.year}`;
}

export type ReconcilingItemId =
  'prismVsNetting' | 'prismVsBank' | 'bankVsNetting';

/** The three lines under "1.1. Reconciling Items", in report order. Each
 * value is (unmatched in `left`) minus (unmatched in `right`). */
export const RECONCILING_ITEM_DEFS: {
  id: ReconcilingItemId;
  label: string;
  left: SourceKey;
  right: SourceKey;
}[] = [
  {
    id: 'prismVsNetting',
    label: 'Prism to Netting Interface timing difference',
    left: 'prism',
    right: 'dynamics',
  },
  {
    id: 'prismVsBank',
    label: 'Prism vs Bank Difference',
    left: 'prism',
    right: 'bank',
  },
  {
    id: 'bankVsNetting',
    label: 'Bank Vs Netting Difference',
    left: 'bank',
    right: 'dynamics',
  },
];

export interface ReconcilingItem {
  id: ReconcilingItemId;
  label: string;
  left: SourceKey;
  right: SourceKey;
  /** null when either system has no records uploaded at all — the
   * difference can't be worked out, which is not the same as zero. */
  value: number | null;
  leftUnmatchedCount: number;
  leftUnmatchedValue: number;
  rightUnmatchedCount: number;
  rightUnmatchedValue: number;
}

export interface ReconcilingItemsResult {
  period: ReportingPeriod;
  items: ReconcilingItem[];
  /** The currency the report is in — only records in this currency are
   * counted. null when no uploaded record carries a currency at all. */
  currency: string | null;
  /** Every currency found in the period, most records first, for the
   * report's currency picker. */
  availableCurrencies: { code: string; count: number }[];
  recordsInPeriod: number;
  /** In-period records in another currency, left out. */
  otherCurrencyRecords: number;
  /** In-period records with no currency (a file with no currency column and
   * none set on Data Sources), left out once any currency is known. */
  noCurrencyRecords: number;
  /** Dated records outside the period, left out of every figure. */
  recordsOutsidePeriod: number;
  /** Records with no usable date, also left out. */
  undatedRecords: number;
}

/** Rounds to cents so float drift never shows up as a 0.01 difference. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sumSigned(records: NormalizedRecord[]): number {
  return roundMoney(records.reduce((s, r) => s + (r.amount ?? 0), 0));
}

/**
 * @param currency The report currency. Defaults to the currency most of the
 * period's records are in; records in any other currency are left out, so
 * unlike currencies are never added together.
 */
export function computeReconcilingItems(
  bySource: Record<SourceKey, NormalizedRecord[]>,
  period: ReportingPeriod,
  currency?: string | null
): ReconcilingItemsResult {
  const periodBySource: Record<SourceKey, NormalizedRecord[]> = {
    dynamics: [],
    prism: [],
    bank: [],
  };
  let recordsOutsidePeriod = 0;
  let undatedRecords = 0;
  const currencyCounts = new Map<string, number>();

  for (const source of Object.keys(bySource) as SourceKey[]) {
    for (const rec of bySource[source]) {
      if (!rec.date) {
        undatedRecords++;
      } else if (!inPeriod(rec.date, period)) {
        recordsOutsidePeriod++;
      } else {
        periodBySource[source].push(rec);
        if (rec.currency)
          currencyCounts.set(
            rec.currency,
            (currencyCounts.get(rec.currency) ?? 0) + 1
          );
      }
    }
  }

  const availableCurrencies = Array.from(currencyCounts, ([code, count]) => ({
    code,
    count,
  })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  const chosen =
    currency && currencyCounts.has(currency)
      ? currency
      : (availableCurrencies[0]?.code ?? null);

  let otherCurrencyRecords = 0;
  let noCurrencyRecords = 0;
  if (chosen) {
    for (const source of Object.keys(periodBySource) as SourceKey[]) {
      periodBySource[source] = periodBySource[source].filter((rec) => {
        if (rec.currency === chosen) return true;
        if (rec.currency) otherCurrencyRecords++;
        else noCurrencyRecords++;
        return false;
      });
    }
  }

  const items = RECONCILING_ITEM_DEFS.map((def): ReconcilingItem => {
    const leftRecs = periodBySource[def.left];
    const rightRecs = periodBySource[def.right];
    // Only a source with nothing uploaded at all makes a pair unworkable. A
    // source that was uploaded but has nothing dated in the period is a real
    // answer: everything on the other side is unmatched.
    if (bySource[def.left].length === 0 || bySource[def.right].length === 0) {
      return {
        ...def,
        value: null,
        leftUnmatchedCount: 0,
        leftUnmatchedValue: 0,
        rightUnmatchedCount: 0,
        rightUnmatchedValue: 0,
      };
    }

    const pairs = matchPair(
      leftRecs,
      rightRecs,
      matchKeyFor(def.left, def.right)
    );
    const matchedLeft = new Set(pairs.map(([a]) => a.key));
    const matchedRight = new Set(pairs.map(([, b]) => b.key));
    const leftUnmatched = leftRecs.filter((r) => !matchedLeft.has(r.key));
    const rightUnmatched = rightRecs.filter((r) => !matchedRight.has(r.key));
    const leftUnmatchedValue = sumSigned(leftUnmatched);
    const rightUnmatchedValue = sumSigned(rightUnmatched);

    return {
      ...def,
      value: roundMoney(leftUnmatchedValue - rightUnmatchedValue),
      leftUnmatchedCount: leftUnmatched.length,
      leftUnmatchedValue,
      rightUnmatchedCount: rightUnmatched.length,
      rightUnmatchedValue,
    };
  });

  return {
    period,
    items,
    currency: chosen,
    availableCurrencies,
    otherCurrencyRecords,
    noCurrencyRecords,
    recordsInPeriod:
      periodBySource.dynamics.length +
      periodBySource.prism.length +
      periodBySource.bank.length,
    recordsOutsidePeriod,
    undatedRecords,
  };
}

export interface BalanceFigures {
  openingBalance: number | null;
  /** Sum of the reconciling items; null if any item couldn't be worked out. */
  reconcilingTotal: number | null;
  subtotal: number | null;
  glBalance: number | null;
  difference: number | null;
}

export function computeBalanceFigures(
  openingBalance: number | null,
  items: ReconcilingItem[],
  glBalance: number | null
): BalanceFigures {
  const reconcilingTotal = items.some((i) => i.value === null)
    ? null
    : roundMoney(items.reduce((s, i) => s + (i.value ?? 0), 0));
  const subtotal =
    openingBalance === null || reconcilingTotal === null
      ? null
      : roundMoney(openingBalance + reconcilingTotal);
  const difference =
    subtotal === null || glBalance === null
      ? null
      : roundMoney(subtotal - glBalance);
  return { openingBalance, reconcilingTotal, subtotal, glBalance, difference };
}

/** "3,633,640.12", "(5,809,523.50)" for negatives — the accounting format
 * the signed-off pack uses. Zero is "-" on a plain line and "0.00" in a
 * boxed total, as on the pack (a nil Bank Vs Netting line, a 0.00
 * Difference). */
export function formatAccounting(
  n: number | null,
  zero: 'dash' | 'number' = 'dash'
): string {
  if (n === null) return 'n/a';
  const r = roundMoney(n);
  if (r === 0) return zero === 'dash' ? '-' : '0.00';
  const s = Math.abs(r).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return r < 0 ? `(${s})` : s;
}
