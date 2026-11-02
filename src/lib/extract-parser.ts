import * as XLSX from 'xlsx';
import {
  cleanRows,
  coerceDate,
  coerceNumber,
  currencyFromFileName,
  currencyFromPreamble,
  inferDateOrder,
  roundMoney,
  type CleaningReport,
  type DateOrder,
} from '@/lib/cleaning';

// Value-level reading lives in cleaning.ts; re-exported for existing callers.
export {
  coerceDate,
  coerceNumber,
  currencyFromFileName,
  inferDateOrder,
  KNOWN_CURRENCIES,
  type DateOrder,
} from '@/lib/cleaning';

export type ExtractRow = Record<string, string | number | boolean | null>;

export interface ParsedExtract {
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  headers: string[];
  rows: ExtractRow[];
  rowCount: number;
  amountColumn: string | null;
  dateColumn: string | null;
  currencyColumn: string | null;
  idColumn: string | null;
  /** Prism and bank extracts: the ZOL ID that ties a Prism payment to its
   * bank line. Optional so extracts saved before it existed still load. */
  zolidColumn?: string | null;
  /** Prism and Dynamics extracts: the cash key that ties a Prism payment to
   * its Netting (Dynamics 365) posting. */
  cashKeyColumn?: string | null;
  /** Currency for the whole file when it has no currency column — read from
   * the statement's header block or guessed from the file name ("NMB USD
   * AUGUST.xlsx"), and editable on Data Sources. Bank statements are one
   * account, so one currency. */
  fileCurrency?: string | null;
  /** How the date column's slash dates read; see inferDateOrder(). */
  dateOrder?: DateOrder;
  /** What cleaning changed, removed or couldn't read. Missing on files
   * uploaded before cleaning existed — those should be re-uploaded. */
  cleaning?: CleaningReport;
  totalAmount: number | null;
  dateRange: { start: string; end: string } | null;
  currencies: string[];
}

const AMOUNT_HINTS = ['amount', 'value', 'net', 'total'];
const DEBIT_HINTS = ['debit', 'dr'];
const CREDIT_HINTS = ['credit', 'cr'];
const DATE_HINTS = [
  'date',
  'posted',
  'txn date',
  'transaction date',
  'value date',
];
const CURRENCY_HINTS = ['currency', 'ccy', 'curr'];
const ID_HINTS = ['zol', 'reference', 'ref', 'id', 'trans', 'narrative'];
// Prism's ZOL ID column is BillingCustomerKey: 92–99% of the ZOL IDs on the
// August 2026 bank statements are found there.
const ZOLID_HINTS = [
  'zolid',
  'zol id',
  'zol_id',
  'zol',
  'billing customer key',
];
const CASH_KEY_HINTS = ['cash key', 'cashkey', 'cash_key', 'cash-key'];
const BALANCE_HINTS = ['balance', 'running balance', 'closing balance'];
const NARRATIVE_HINTS = [
  'narrative',
  'narration',
  'description',
  'details',
  'particulars',
];

export const NET_AMOUNT_COLUMN = 'Net Amount (Credit − Debit)';

/**
 * Statements that come with no header row at all, by file name. The
 * columns are as the bank exports them.
 */
const HEADERLESS_LAYOUTS: { fileName: RegExp; headers: string[] }[] = [
  {
    // StanChart: the table starts straight after the address block.
    fileName: /stan\s*chart|standard\s*chartered/i,
    headers: [
      'Post Date',
      'Narrative',
      'Value Date',
      'Reference',
      'Debit',
      'Credit',
      'Balance',
    ],
  },
];

/** "PostDate" -> "post date", "BillingCustomerKey" -> "billing customer key". */
function headerWords(header: string): string {
  return header
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 3 for an exact match, 2 when a hint starts a word of the header, else 0.
 * Matching at word starts only keeps "cr" out of "Description" and "id" out
 * of "Paid". */
function scoreHeader(header: string, hints: string[]): number {
  const h = headerWords(header);
  let best = 0;
  for (const hint of hints) {
    if (h === hint) best = Math.max(best, 3);
    else if (new RegExp(`(^|[^a-z])${escapeRegExp(hint)}`).test(h))
      best = Math.max(best, 2);
  }
  return best;
}

function pickColumn(
  headers: string[],
  hints: string[],
  skip?: RegExp
): string | null {
  let bestHeader: string | null = null;
  let bestScore = 0;
  for (const header of headers) {
    if (skip?.test(header)) continue;
    const score = scoreHeader(header, hints);
    if (score > bestScore) {
      bestScore = score;
      bestHeader = header;
    }
  }
  return bestScore > 0 ? bestHeader : null;
}

/**
 * Ledger exports (Dynamics especially) often carry several amount-shaped
 * columns side by side — e.g. "Amount in transaction currency", "Amount",
 * "Amount in reporting currency" — where only the first is in the same
 * currency as the row's Currency column; the others are FX-converted. A
 * plain best-match on AMOUNT_HINTS picks the exact-match "Amount" column,
 * which for a multi-currency ledger is silently the wrong (converted)
 * figure. Prefer a column that pairs with the row's own transaction
 * currency, and penalize columns that look like a converted/reporting
 * figure.
 */
export function pickAmountColumn(headers: string[]): string | null {
  let bestHeader: string | null = null;
  let bestScore = -Infinity;
  for (const header of headers) {
    const base = scoreHeader(header, AMOUNT_HINTS);
    if (base === 0) continue;
    const h = header.toLowerCase();
    // "Value Date" is a date, and "Debit Amount" / "Credit Amount" are one
    // side each — taking either as the amount drops half the statement. A
    // statement with only debit/credit columns gets a net column instead
    // (see parseExtractFile).
    if (h.includes('date')) continue;
    if (/debit|credit|\b(dr|cr)\b/.test(h)) continue;
    let score = base;
    if (h.includes('transaction')) score += 3;
    if (
      h.includes('reporting') ||
      h.includes('local') ||
      h.includes('functional')
    )
      score -= 3;
    if (score > bestScore) {
      bestScore = score;
      bestHeader = header;
    }
  }
  return bestHeader;
}

type Cell = string | number | boolean | Date | null;

function countNonEmpty(row: Cell[]): number {
  return row.filter(
    (c) => c !== null && c !== undefined && String(c).trim() !== ''
  ).length;
}

/** A header row names a date column and an amount (or debit/credit) column. */
function looksLikeHeader(row: Cell[]): boolean {
  const labels = row.filter((c): c is string => typeof c === 'string');
  return (
    labels.some((l) => scoreHeader(l, DATE_HINTS) > 0) &&
    labels.some(
      (l) =>
        scoreHeader(l, [...AMOUNT_HINTS, ...DEBIT_HINTS, ...CREDIT_HINTS]) > 0
    )
  );
}

/**
 * Real-world extracts (bank statements especially) often prepend a metadata
 * block — account number, account name, currency — before the actual
 * transaction table starts; CBZ's runs to 14 rows. Scan the first ~25 rows
 * for the header: a row naming a date and an amount column, followed by
 * consistently dense data rows. Returns -1 when no row qualifies.
 */
function findHeaderRowIndex(aoa: Cell[][]): number {
  const maxScan = Math.min(25, aoa.length);
  let bestIdx = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < maxScan; i++) {
    const row = aoa[i] ?? [];
    const nonEmpty = countNonEmpty(row);
    if (nonEmpty < 2 || !looksLikeHeader(row)) continue;
    const stringish = row.filter(
      (c) => typeof c === 'string' && c.trim() !== ''
    ).length;

    let lookaheadTotal = 0;
    let lookaheadRows = 0;
    for (let j = i + 1; j < Math.min(i + 6, aoa.length); j++) {
      lookaheadTotal += countNonEmpty(aoa[j] ?? []);
      lookaheadRows++;
    }
    const avgLookahead = lookaheadRows ? lookaheadTotal / lookaheadRows : 0;

    const score = stringish * 2 + Math.min(avgLookahead, nonEmpty);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

const DATE_TEXT = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$|^\d{4}-\d{2}-\d{2}/;

/** First row of a header-less table: starts with a date, has 4+ cells. */
function findFirstDataRow(aoa: Cell[][]): number {
  return aoa.findIndex(
    (row) =>
      countNonEmpty(row) >= 4 &&
      (row[0] instanceof Date ||
        (typeof row[0] === 'string' && DATE_TEXT.test(row[0].trim())))
  );
}

interface TableStart {
  /** Index of the first data row. */
  dataStart: number;
  headerRow: Cell[];
}

function findTableStart(aoa: Cell[][], fileName: string): TableStart {
  const headerIdx = findHeaderRowIndex(aoa);
  if (headerIdx >= 0)
    return { dataStart: headerIdx + 1, headerRow: aoa[headerIdx] ?? [] };
  const layout = HEADERLESS_LAYOUTS.find((l) => l.fileName.test(fileName));
  const firstData = layout ? findFirstDataRow(aoa) : -1;
  if (layout && firstData >= 0)
    return { dataStart: firstData, headerRow: layout.headers };
  // Unknown layout: fall back to the first row as the header.
  return { dataStart: 1, headerRow: aoa[0] ?? [] };
}

function buildRowsFromAoa(
  aoa: Cell[][],
  { dataStart, headerRow }: TableStart
): { headers: string[]; rows: ExtractRow[]; rowNumbers: number[] } {
  const width = Math.max(
    headerRow.length,
    ...aoa.slice(dataStart, dataStart + 50).map((r) => r.length)
  );
  const headers = Array.from({ length: width }, (_, i) => {
    const cell = headerRow[i];
    const label =
      cell !== null && cell !== undefined ? String(cell).trim() : '';
    return label !== '' ? label : `Column ${i + 1}`;
  });
  // De-duplicate identical header labels
  const seen = new Map<string, number>();
  const dedupedHeaders = headers.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h} (${count + 1})`;
  });

  const rows: ExtractRow[] = [];
  const rowNumbers: number[] = [];
  for (let i = dataStart; i < aoa.length; i++) {
    const raw = aoa[i] ?? [];
    if (countNonEmpty(raw) === 0) continue;
    const row: ExtractRow = {};
    dedupedHeaders.forEach((h, colIdx) => {
      const value = raw[colIdx];
      row[h] =
        value instanceof Date
          ? value.toISOString()
          : ((value as string | number | boolean | null | undefined) ?? null);
    });
    rows.push(row);
    rowNumbers.push(i + 1);
  }
  return { headers: dedupedHeaders, rows, rowNumbers };
}

export function validateRow(
  row: ExtractRow,
  amountColumn: string | null,
  dateColumn: string | null
): string[] {
  const errors: string[] = [];
  if (amountColumn && coerceNumber(row[amountColumn]) === null) {
    errors.push(`Invalid amount in column "${amountColumn}"`);
  }
  if (dateColumn && coerceDate(row[dateColumn]) === null) {
    errors.push(`Invalid date in column "${dateColumn}"`);
  }
  return errors;
}

export async function parseExtractFile(file: File): Promise<ParsedExtract> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const aoa = XLSX.utils.sheet_to_json<Cell[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  const tableStart = findTableStart(aoa, file.name);
  const built = buildRowsFromAoa(aoa, tableStart);
  const { rowNumbers } = built;
  let { headers, rows } = built;

  let amountColumn = pickAmountColumn(headers);
  const dateColumn = pickColumn(headers, DATE_HINTS);
  const currencyColumn = pickColumn(headers, CURRENCY_HINTS);
  // "Transaction Date" starts with "trans" but is no reference.
  const idColumn = pickColumn(headers, ID_HINTS, /date/i);
  const cashKeyColumn = pickColumn(headers, CASH_KEY_HINTS);
  const balanceColumn = pickColumn(headers, BALANCE_HINTS);
  const narrativeColumn = pickColumn(headers, NARRATIVE_HINTS);

  // Bank statements (and some ledger exports) split value across separate
  // Debit/Credit columns rather than one signed Amount column. Naively
  // grabbing just the Debit column (as a single "amount" pick would) silently
  // drops every credit-side transaction from totals and matching. When no
  // single amount column is found, synthesize one: net = credit − debit.
  if (!amountColumn) {
    const debitColumn = pickColumn(headers, DEBIT_HINTS);
    const creditColumn = pickColumn(headers, CREDIT_HINTS);
    if (debitColumn || creditColumn) {
      headers.push(NET_AMOUNT_COLUMN);
      for (const row of rows) {
        const debit = debitColumn ? (coerceNumber(row[debitColumn]) ?? 0) : 0;
        const credit = creditColumn
          ? (coerceNumber(row[creditColumn]) ?? 0)
          : 0;
        row[NET_AMOUNT_COLUMN] = roundMoney(credit - debit);
      }
      amountColumn = NET_AMOUNT_COLUMN;
    }
  }

  const dateOrder = dateColumn
    ? inferDateOrder(rows.map((r) => r[dateColumn]))
    : undefined;

  const cleaned = cleanRows({
    headers,
    rows,
    rowNumbers,
    amountColumn,
    dateColumn,
    dateOrder: dateOrder ?? 'dmy',
    currencyColumn,
    balanceColumn,
    narrativeColumn,
    zolidColumn: pickColumn(headers, ZOLID_HINTS),
  });
  headers = cleaned.headers;
  rows = cleaned.rows;
  const { zolidColumn } = cleaned;

  let totalAmount: number | null = null;
  if (amountColumn) {
    let sum = 0;
    let any = false;
    for (const row of rows) {
      const n = coerceNumber(row[amountColumn]);
      if (n !== null) {
        sum += n;
        any = true;
      }
    }
    totalAmount = any ? roundMoney(sum) : null;
  }

  let dateRange: { start: string; end: string } | null = null;
  if (dateColumn) {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const row of rows) {
      const d = coerceDate(row[dateColumn], dateOrder);
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    if (min && max) {
      dateRange = { start: min.toISOString(), end: max.toISOString() };
    }
  }

  const currencies = currencyColumn
    ? Array.from(
        new Set(
          rows
            .map((r) => r[currencyColumn])
            .filter((v): v is string => typeof v === 'string' && v !== '')
        )
      )
    : [];

  const preamble = aoa.slice(0, Math.max(0, tableStart.dataStart - 1));

  return {
    fileName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    headers,
    rows,
    rowCount: rows.length,
    amountColumn,
    dateColumn,
    currencyColumn,
    idColumn,
    zolidColumn,
    cashKeyColumn,
    fileCurrency: currencyColumn
      ? null
      : (currencyFromPreamble(preamble) ?? currencyFromFileName(file.name)),
    dateOrder,
    cleaning: cleaned.report,
    totalAmount,
    dateRange,
    currencies,
  };
}
