// Turns the cells of a freshly read extract into one standard form before
// anything else sees them: amounts as signed numbers to 2dp, dates as
// 'YYYY-MM-DD', currencies as ISO codes, and a ZOL ID on every bank line that
// carries one. Lines that aren't transactions (opening balances, totals,
// footers) are taken out, and everything changed or left unreadable is
// recorded in a CleaningReport so the user can see it on Data Sources.
//
// The rules come from the real August 2026 bank statements (CABS, CBZ, NMB,
// Stanbic, StanChart, TN CyberTech) and the Prism payments extract.

import * as XLSX from 'xlsx';
import type { ExtractRow } from '@/lib/extract-parser';

/** Bump when the rules change, so files cleaned by older rules can be
 * flagged for re-upload. */
export const CLEANING_VERSION = 1;

export const KNOWN_CURRENCIES = ['ZWG', 'USD', 'ZWL', 'ZAR', 'EUR', 'GBP'];

/** Synthesized on bank statements: the ZOL ID found on each line. */
export const ZOL_ID_COLUMN = 'ZOL ID';

const MAX_ISSUES = 200;

export interface CleaningIssue {
  /** Row number in the original sheet (1-based, as Excel shows it). */
  row: number;
  message: string;
}

export interface CleaningReport {
  version: number;
  /** Lines taken out, by reason. */
  removed: Record<string, number>;
  /** Dates put back after Excel read them as yy/mm/dd (see repairSwappedDate). */
  repairedDates: number;
  /** Wrapped narrative lines joined back onto their transaction. */
  joinedLines: number;
  /** Lines with a ZOL ID — the Prism ↔ Bank matching key. */
  zolIds: number;
  /** Lines whose running balance doesn't follow from the line before: a sign
   * that a line is missing or an amount was misread. */
  balanceBreaks: number;
  /** The first MAX_ISSUES things worth a look, in sheet order. */
  issues: CleaningIssue[];
  issueCount: number;
}

// ---- Amounts ----------------------------------------------------------------

const CURRENCY_PREFIX = /^(?:USD|ZWG|ZWL|ZAR|EUR|GBP|ZIG|US\$|\$|€|£)\s*/;

/** Reads an amount as written in any of the extracts: "1,250.00",
 * "32 542 634.80" (NMB), "(1,250.00)", "1250.00-", "1 250.00 DR",
 * "USD 1,250". DR and a trailing minus or brackets mean money out. */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let s = value.trim().toUpperCase();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  const suffix = /\s*(DR|CR)$/.exec(s);
  if (suffix) {
    negative = negative || suffix[1] === 'DR';
    s = s.slice(0, suffix.index);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(CURRENCY_PREFIX, '').replace(/[,\s]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return negative ? -Math.abs(n) : n;
}

/** Rounds to cents, so credit − debit doesn't leave 5632.999999. */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- Currencies -------------------------------------------------------------

const CURRENCY_ALIASES: Record<string, string> = {
  US$: 'USD',
  $: 'USD',
  USD$: 'USD',
  ZIG: 'ZWG',
  ZWL$: 'ZWL',
  RTGS: 'ZWL',
  RTGS$: 'ZWL',
  RAND: 'ZAR',
};

/** "US$" -> "USD", "ZiG" -> "ZWG", "RTGS" -> "ZWL"; anything else is
 * upper-cased as it is. */
export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return null;
  return CURRENCY_ALIASES[s] ?? s;
}

/** "NMB USD AUGUST.xlsx" -> "USD"; null when the name names no currency. */
export function currencyFromFileName(fileName: string): string | null {
  const words = fileName.toUpperCase().split(/[^A-Z]+/);
  return KNOWN_CURRENCIES.find((c) => words.includes(c)) ?? null;
}

/** Bank statements state the account currency in the block above the
 * table: "Currency | ZWG" (TN, CABS), "Account Currency  ZWG" (CBZ),
 * "…OFFICE PARK,Currency:ZWG" (StanChart). */
export function currencyFromPreamble(preamble: unknown[][]): string | null {
  for (const row of preamble) {
    const text = row
      .filter((c) => c !== null && c !== undefined)
      .map(String)
      .join(' ');
    const m = /currency\s*:?\s*([A-Za-z$]{2,5})/i.exec(text);
    if (!m) continue;
    const c = normalizeCurrency(m[1]);
    if (c && KNOWN_CURRENCIES.includes(c)) return c;
  }
  return null;
}

// ---- Dates ------------------------------------------------------------------

/** Whether a column's slash/dash dates read day-first ("1/8/2026" = 1 Aug,
 * as in NMB statements) or month-first ("8/1/2026" = 1 Aug, as in CABS). */
export type DateOrder = 'dmy' | 'mdy';

const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;

/** Works out a column's date order from its values: a first part above 12
 * means day-first, a second part above 12 means month-first. Ambiguous
 * columns default to day-first, the usual Zimbabwean convention. */
export function inferDateOrder(values: unknown[]): DateOrder {
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const m = NUMERIC_DATE.exec(v.trim());
    if (!m) continue;
    if (Number(m[1]) > 12) return 'dmy';
    if (Number(m[2]) > 12) return 'mdy';
  }
  return 'dmy';
}

/** A calendar day as midnight UTC, so every date compares by day alone. */
function utcDay(y: number, m: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** Excel stores a plain date as local midnight. Read in Harare (UTC+2) that
 * comes out as 21:59:42 UTC the day before, which put the 1st of every
 * month in the previous month. Rounding to the nearest day recovers the
 * calendar date for any time zone within ±12 hours. */
function nearestUtcDay(d: Date): Date {
  const shifted = new Date(d.getTime() + 12 * 3_600_000);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate()
    )
  );
}

export function coerceDate(
  value: unknown,
  order: DateOrder = 'dmy'
): Date | null {
  if (value instanceof Date && !isNaN(value.getTime()))
    return nearestUtcDay(value);
  if (typeof value === 'number') {
    // Excel serial date
    const d = XLSX.SSF?.parse_date_code
      ? XLSX.SSF.parse_date_code(value)
      : null;
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof value === 'string' && value.trim()) {
    const t = value.trim();
    const numeric = NUMERIC_DATE.exec(t);
    if (numeric) {
      const a = Number(numeric[1]);
      const b = Number(numeric[2]);
      let y = Number(numeric[3]);
      if (y < 100) y += 2000;
      return order === 'dmy' ? utcDay(y, b, a) : utcDay(y, a, b);
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (iso) return utcDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const d = new Date(t);
    if (!isNaN(d.getTime())) return nearestUtcDay(d);
  }
  return null;
}

/** The date with its day and two-digit year swapped, or null if that isn't
 * a real date: 26 Aug 2017 -> 17 Aug 2026. */
function swapDayAndYear(d: Date): Date | null {
  return utcDay(
    2000 + d.getUTCDate(),
    d.getUTCMonth() + 1,
    d.getUTCFullYear() % 100
  );
}

/** Months since year 0, so neighbouring months are 1 apart across years. */
function monthIndex(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** The month a statement is for (as a monthIndex): the one most of its
 * dates read as, directly or with day and year swapped (see
 * repairSwappedDate). */
export function statementMonth(dates: (Date | null)[]): number | null {
  const votes = new Map<number, number>();
  const vote = (m: number) => votes.set(m, (votes.get(m) ?? 0) + 1);
  for (const d of dates) {
    if (!d) continue;
    vote(monthIndex(d));
    const swapped = swapDayAndYear(d);
    if (swapped && monthIndex(swapped) !== monthIndex(d))
      vote(monthIndex(swapped));
  }
  let best: number | null = null;
  let bestVotes = 0;
  for (const [m, n] of votes) {
    if (n > bestVotes) {
      best = m;
      bestVotes = n;
    }
  }
  return best;
}

/**
 * CBZ statements hold dd/mm/yy dates that Excel read as yy/mm/dd, so
 * 17 Aug 2026 arrives as 26 Aug 2017, 25 Aug 2026 as 26 Aug 2025 and
 * 31 Jul 2026 as 26 Jul 1931 — the file's dates then spanned 1930 to 2029.
 * When a date falls outside the statement's month (or the months either
 * side) and swapping its day and two-digit year back lands inside them, the
 * swapped date is the real one. Returns null when the date needs no repair
 * or can't be repaired.
 */
export function repairSwappedDate(d: Date, refMonth: number): Date | null {
  if (Math.abs(monthIndex(d) - refMonth) <= 1) return null;
  const swapped = swapDayAndYear(d);
  if (!swapped || Math.abs(monthIndex(swapped) - refMonth) > 1) return null;
  return swapped;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---- ZOL IDs ----------------------------------------------------------------

/** Where a ZOL ID sits in a bank narrative, by bank. */
const ZOL_IN_TEXT = [
  // "IB202608037290EC40 ZOL-224046" (NMB), "USSD ZOL 230141 ZJ085B9V" (Stanbic)
  /\bZOL[\s:-]*(\d{3,7})\b/i,
  // "LIT ID 63455  SIMBARASHE" (Stanbic), "LIT-307484" (CBZ comments)
  /\bLIT(?:[\s-]*ID)?[\s:-]*(\d{3,7})\b/i,
  // "430378:ZOL MB1785…", "290935 LTE_PAYG_30_5GB:ZOL MB1785…" (NMB 304)
  /^\s*(\d{3,7})\b[^:]*:ZOL\b/i,
];

function canonicalZolId(digits: string): string {
  return String(Number(digits));
}

export function zolIdFromText(text: string): string | null {
  for (const pattern of ZOL_IN_TEXT) {
    const m = pattern.exec(text);
    if (m) return canonicalZolId(m[1]);
  }
  return null;
}

/**
 * The reconciliation team notes each bank line's ZOL ID in the unlabeled
 * columns after the balance (sometimes headed "comment"), alongside tags
 * like INT, USSD or MPOS and CS references: 47555, "75420 CS10829232",
 * "LIT-326807,CS10848916". A 3–7 digit number leading the note is the ZOL
 * ID; "LTZ 006315" is something else and is left alone.
 */
export function zolIdFromNote(value: unknown): string | null {
  if (typeof value === 'number')
    return Number.isInteger(value) && value >= 100 && value < 10_000_000
      ? String(value)
      : null;
  if (typeof value !== 'string') return null;
  const bare = /^(\d{3,7})(?=$|[\s,.])/.exec(value.trim());
  if (bare) return canonicalZolId(bare[1]);
  return zolIdFromText(value);
}

/** Headers SheetJS left blank (named "Column N" by the parser) or "comment":
 * where the reconciliation team writes its notes. */
export function isNoteColumn(header: string): boolean {
  return /^column \d+$/i.test(header) || /^comments?$/i.test(header.trim());
}

// ---- Lines that aren't transactions ----------------------------------------

const BALANCE_OR_TOTAL_LINE =
  /\b(opening|closing) balance\b|\bbalance (at period (start|end)|b\/?f|c\/?f|brought forward|carried forward)\b|^\s*(grand )?totals?\b/i;

// ---- The cleaning step ------------------------------------------------------

export interface CleanInput {
  headers: string[];
  rows: ExtractRow[];
  /** Sheet row number of each entry in `rows`. */
  rowNumbers: number[];
  amountColumn: string | null;
  dateColumn: string | null;
  dateOrder: DateOrder;
  currencyColumn: string | null;
  balanceColumn: string | null;
  narrativeColumn: string | null;
  zolidColumn: string | null;
}

export interface CleanOutput {
  headers: string[];
  rows: ExtractRow[];
  zolidColumn: string | null;
  report: CleaningReport;
}

export function cleanRows(input: CleanInput): CleanOutput {
  const { amountColumn, dateColumn, currencyColumn, balanceColumn } = input;
  const headers = [...input.headers];
  const report: CleaningReport = {
    version: CLEANING_VERSION,
    removed: {},
    repairedDates: 0,
    joinedLines: 0,
    zolIds: 0,
    balanceBreaks: 0,
    issues: [],
    issueCount: 0,
  };
  const note = (row: number, message: string) => {
    report.issueCount++;
    if (report.issues.length < MAX_ISSUES) report.issues.push({ row, message });
  };
  const remove = (row: number, reason: string) => {
    report.removed[reason] = (report.removed[reason] ?? 0) + 1;
    note(row, `Removed: ${reason.toLowerCase()}`);
  };

  const isBlank = (v: unknown) =>
    v === null || v === undefined || String(v).trim() === '';

  // StanChart wraps long narratives onto lines of their own — no date, no
  // amount, no balance — and the ZOL ID is often on the wrapped part
  // ("//XXXX/BKP/SBICZWHXXXX PJ ERASMUS ZOL 57573"). Join them back onto
  // the transaction above.
  const { narrativeColumn: textColumn } = input;
  const lines: { row: ExtractRow; rowNumber: number }[] = [];
  input.rows.forEach((row, i) => {
    const rowNumber = input.rowNumbers[i] ?? i + 1;
    const prev = lines[lines.length - 1];
    const wrapped =
      prev &&
      textColumn &&
      typeof row[textColumn] === 'string' &&
      (!dateColumn || isBlank(row[dateColumn])) &&
      (!amountColumn || !coerceNumber(row[amountColumn])) &&
      (!balanceColumn || isBlank(row[balanceColumn]));
    if (wrapped) {
      prev.row[textColumn] =
        `${String(prev.row[textColumn] ?? '').trimEnd()} ${String(row[textColumn]).trim()}`;
      report.joinedLines++;
    } else {
      lines.push({ row, rowNumber });
    }
  });

  const dates = dateColumn
    ? lines.map(({ row }) => coerceDate(row[dateColumn], input.dateOrder))
    : [];
  const refMonth = statementMonth(dates);

  // ZOL IDs are pulled from the team's notes and the narrative only when
  // the file has no ZOL ID column of its own (Prism has BillingCustomerKey).
  const noteColumns = input.zolidColumn ? [] : headers.filter(isNoteColumn);
  const narrativeColumn = input.zolidColumn ? null : textColumn;
  const findZolIds = noteColumns.length > 0 || narrativeColumn !== null;

  const rows: ExtractRow[] = [];
  let prevBalance: number | null = null;

  lines.forEach(({ row, rowNumber }, i) => {
    const balance = balanceColumn ? coerceNumber(row[balanceColumn]) : null;
    const amount = amountColumn ? coerceNumber(row[amountColumn]) : null;
    const rawDate = dateColumn ? row[dateColumn] : null;

    // ---- Take out lines that aren't transactions
    const sameAsHeader = headers.filter(
      (h) => !isBlank(row[h]) && String(row[h]).trim() === h
    ).length;
    if (sameAsHeader >= 2) {
      remove(rowNumber, 'Repeated header row');
      return;
    }
    const text = headers
      .map((h) => row[h])
      .filter((c) => typeof c === 'string')
      .join(' ');
    if (BALANCE_OR_TOTAL_LINE.test(text)) {
      remove(rowNumber, 'Opening/closing balance or total line');
      if (balance !== null) prevBalance = balance;
      return;
    }
    if (dateColumn && isBlank(rawDate) && (amount === null || amount === 0)) {
      remove(rowNumber, 'Line with no date and no amount');
      return;
    }

    // ---- Date: standard 'YYYY-MM-DD'
    if (dateColumn) {
      let d = dates[i];
      if (d && refMonth !== null) {
        const repaired = repairSwappedDate(d, refMonth);
        if (repaired) {
          // Counted, not listed: a CBZ statement has hundreds, and listing
          // them would bury the issues that need a look.
          report.repairedDates++;
          d = repaired;
        }
      }
      if (d) row[dateColumn] = isoDay(d);
      else if (isBlank(rawDate)) note(rowNumber, 'No date');
      else note(rowNumber, `Unreadable date "${String(rawDate)}"`);
    }

    // ---- Amount: signed number to 2dp
    if (amountColumn) {
      if (amount !== null) row[amountColumn] = roundMoney(amount);
      else if (isBlank(row[amountColumn])) note(rowNumber, 'No amount');
      else note(rowNumber, `Unreadable amount "${String(row[amountColumn])}"`);
    }

    // ---- Currency: ISO code
    if (currencyColumn && !isBlank(row[currencyColumn])) {
      const c = normalizeCurrency(row[currencyColumn]);
      row[currencyColumn] = c;
      if (c && !KNOWN_CURRENCIES.includes(c))
        note(rowNumber, `Unrecognized currency "${c}"`);
    }

    // ---- ZOL ID: the team's note first, then the narrative
    if (findZolIds) {
      let id: string | null = null;
      for (const h of noteColumns) {
        id = zolIdFromNote(row[h]);
        if (id) break;
      }
      if (!id && narrativeColumn && typeof row[narrativeColumn] === 'string')
        id = zolIdFromText(row[narrativeColumn] as string);
      row[ZOL_ID_COLUMN] = id;
      if (id) report.zolIds++;
    }

    // ---- Running balance: each line's balance should follow from the last
    if (balance !== null) {
      if (
        prevBalance !== null &&
        amount !== null &&
        Math.abs(prevBalance + amount - balance) > 0.01
      ) {
        report.balanceBreaks++;
        note(
          rowNumber,
          `Balance ${balance.toFixed(2)} doesn't follow from ${prevBalance.toFixed(2)} ${amount < 0 ? '−' : '+'} ${Math.abs(amount).toFixed(2)} — a line may be missing or misread`
        );
      }
      prevBalance = balance;
    }

    rows.push(row);
  });

  let zolidColumn = input.zolidColumn;
  if (findZolIds && report.zolIds > 0) {
    headers.push(ZOL_ID_COLUMN);
    zolidColumn = ZOL_ID_COLUMN;
  } else if (findZolIds) {
    for (const row of rows) delete row[ZOL_ID_COLUMN];
  }

  return { headers, rows, zolidColumn, report };
}
