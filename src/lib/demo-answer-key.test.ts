// @vitest-environment node
// End-to-end check against the synthetic August 2026 demo set and its
// answer key (fixtures/demo-august-2026): every file goes through the real
// pipeline — parse and clean, normalize, de-duplicate, match — and the
// result must reproduce the answer key exactly. The expected figures and
// planted exceptions are read from the answer key workbook itself, so
// updating the demo set never means editing this file.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExtractFile } from './extract-parser';
import { prepareRecords } from './reconciliation-engine';
import { matchKeyFor, matchPair } from './matching';
import {
  RECONCILING_ITEM_DEFS,
  computeReconcilingItems,
  detectReportingPeriod,
  type ReconcilingItemId,
  type ReportingPeriod,
} from './balance-reconciliation';
import type { SourceKey, StoredExtract } from './data-sources-context';
import type { NormalizedRecord } from './normalization';

const DEMO = fileURLToPath(
  new URL('../../fixtures/demo-august-2026/', import.meta.url)
);
const FOLDERS: Record<SourceKey, string> = {
  prism: 'Prism',
  dynamics: 'Netting',
  bank: 'Bank Statements',
};
const CURRENCIES = ['ZWG', 'USD'];

// ---- The answer key ---------------------------------------------------------

const answerKey = XLSX.read(readFileSync(`${DEMO}ANSWER KEY (DEMO).xlsx`));

/** Front-page line label as in the answer key, by reconciling item. */
const LINE_LABEL: Record<ReconcilingItemId, string> = {
  prismVsNetting: 'Prism to Netting Interface timing difference',
  prismVsBank: 'Prism vs Bank Difference',
  bankVsNetting: 'Bank Vs Netting Difference',
};

/** "Lines affected" wording in the Planted exceptions sheet. */
const AFFECTS: Record<ReconcilingItemId, string> = {
  prismVsNetting: 'Prism to Netting timing difference',
  prismVsBank: 'Prism vs Bank',
  bankVsNetting: 'Bank Vs Netting',
};

const frontPage = XLSX.utils.sheet_to_json<Record<string, unknown>>(
  answerKey.Sheets['Expected front page']
);
function expectedFigure(id: ReconcilingItemId, currency: string): number {
  const line = frontPage.find((r) => String(r.Line).trim() === LINE_LABEL[id]);
  if (!line) throw new Error(`Answer key has no line "${LINE_LABEL[id]}"`);
  return Number(line[currency]);
}

interface PlantedException {
  what: string;
  currency: string;
  reference: string;
  affects: string;
}
const planted: PlantedException[] = XLSX.utils
  .sheet_to_json<Record<string, unknown>>(
    answerKey.Sheets['Planted exceptions']
  )
  .map((r) => ({
    what: String(r['What happened']),
    currency: String(r.Currency),
    reference: String(r['Reference (ZOLID / journal)']),
    affects: String(r['Lines affected']),
  }));

/** Row counts the Read me sheet gives for each file. */
const readMe = XLSX.utils
  .sheet_to_json<unknown[]>(answerKey.Sheets['Read me'], { header: 1 })
  .map((r) => r.join(' '))
  .join('\n');

// ---- Running the pipeline ---------------------------------------------------

let files: Record<SourceKey, StoredExtract[]>;
let bySource: Record<SourceKey, NormalizedRecord[]>;
let duplicateKeys: string[];
let period: ReportingPeriod;

beforeAll(async () => {
  files = { prism: [], dynamics: [], bank: [] };
  for (const source of Object.keys(FOLDERS) as SourceKey[]) {
    const folder = `${DEMO}${FOLDERS[source]}/`;
    for (const name of readdirSync(folder).filter((n) => n.endsWith('.xlsx'))) {
      const parsed = await parseExtractFile(
        new File([readFileSync(folder + name)], name)
      );
      files[source].push({ ...parsed, id: name, source });
    }
  }
  const prepared = prepareRecords(files);
  bySource = prepared.bySource;
  duplicateKeys = prepared.duplicates.map((d) => `${d.source}:${d.key}`);
  period = detectReportingPeriod([
    ...bySource.dynamics,
    ...bySource.prism,
    ...bySource.bank,
  ])!;
});

/** The planted reference a record carries, if any. */
function plantedReference(rec: NormalizedRecord): string | null {
  const cells = Object.values(rec.raw).map((v) =>
    String(v ?? '').toLowerCase()
  );
  return (
    planted.find((p) => cells.includes(p.reference.toLowerCase()))?.reference ??
    null
  );
}

/** Records left unmatched by one reconciling item, in the report's scope:
 * the reporting month, one currency. */
function unmatchedRecords(id: ReconcilingItemId, currency: string) {
  const def = RECONCILING_ITEM_DEFS.find((d) => d.id === id)!;
  const inScope = (r: NormalizedRecord) =>
    r.currency === currency &&
    r.date?.getUTCFullYear() === period.year &&
    r.date.getUTCMonth() + 1 === period.month;
  const left = bySource[def.left].filter(inScope);
  const right = bySource[def.right].filter(inScope);
  const pairs = matchPair(left, right, matchKeyFor(def.left, def.right));
  const matched = new Set(pairs.flatMap(([a, b]) => [a.key, b.key]));
  return [...left, ...right].filter((r) => !matched.has(r.key));
}

// ---- The checks -------------------------------------------------------------

describe('demo August 2026 set against its answer key', () => {
  it('reads every file with the row counts the answer key gives', () => {
    const count = (s: SourceKey) =>
      files[s].map((f) => f.rowCount).sort((a, b) => b - a);
    expect(readMe).toContain(`Prism ${count('prism').join(' / ')} rows`);
    expect(readMe).toContain(`Netting ${count('dynamics').join(' / ')} rows`);
    expect(readMe).toContain(`banks ${count('bank').join(' / ')} rows`);
  });

  it('reports August 2026', () => {
    expect(period).toEqual({ year: 2026, month: 8 });
  });

  it('flags the repeated CBZ line as a possible duplicate', () => {
    expect(duplicateKeys).toHaveLength(1);
    expect(duplicateKeys[0]).toMatch(/^bank:.*cbz/);
  });

  describe.each(CURRENCIES)('%s front page', (currency) => {
    it.each(RECONCILING_ITEM_DEFS.map((d) => d.id))(
      '%s matches the answer key',
      (id) => {
        const item = computeReconcilingItems(
          bySource,
          period,
          currency
        ).items.find((i) => i.id === id)!;
        expect(item.value).toBeCloseTo(expectedFigure(id, currency), 2);
      }
    );

    it.each(RECONCILING_ITEM_DEFS.map((d) => d.id))(
      '%s leaves exactly the planted exceptions unmatched',
      (id) => {
        const found = unmatchedRecords(id, currency)
          .map((r) => plantedReference(r) ?? `unplanted ${r.key}`)
          .sort();
        const expected = planted
          .filter((p) => p.currency === currency)
          .filter((p) => p.affects.includes(AFFECTS[id]))
          .map((p) => p.reference)
          .sort();
        expect(found).toEqual(expected);
      }
    );
  });
});
