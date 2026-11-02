import { describe, it, expect } from 'vitest';
import type { NormalizedRecord } from '@/lib/normalization';
import type { SourceKey } from '@/lib/data-sources-context';
import {
  computeBalanceFigures,
  computeReconcilingItems,
  detectReportingPeriod,
  formatAccounting,
  formatPeriodClosing,
  formatPeriodOpening,
  formatPeriodShort,
  previousPeriod,
  type ReconcilingItem,
} from './balance-reconciliation';

let seq = 0;
function rec(
  source: SourceKey,
  date: string | null,
  amount: number,
  reference = '',
  currency: string | null = 'ZWL'
): NormalizedRecord {
  seq++;
  return {
    key: `${source}:${seq}`,
    source,
    fileId: source,
    fileName: `${source}.csv`,
    rowIndex: seq,
    date: date ? new Date(`${date}T00:00:00Z`) : null,
    amount,
    absAmount: Math.abs(amount),
    currency,
    reference,
    zolid: '',
    cashKey: '',
    raw: {},
  };
}

function empty(): Record<SourceKey, NormalizedRecord[]> {
  return { dynamics: [], prism: [], bank: [] };
}

describe('reporting period', () => {
  it('picks the month most dated records fall in', () => {
    const period = detectReportingPeriod([
      rec('bank', '2026-03-02', 1),
      rec('bank', '2026-03-15', 1),
      rec('bank', '2026-04-01', 1),
      rec('bank', null, 1),
    ]);
    expect(period).toEqual({ year: 2026, month: 3 });
  });

  it('returns null when nothing is dated', () => {
    expect(detectReportingPeriod([rec('bank', null, 1)])).toBeNull();
  });

  it('formats the period the way the signed-off pack does', () => {
    const march = { year: 2026, month: 3 };
    expect(formatPeriodShort(march)).toBe('Mar-26');
    expect(formatPeriodOpening(march)).toBe('01 March 2026');
    expect(formatPeriodClosing(march)).toBe('31 Mar 2026');
    expect(formatPeriodClosing({ year: 2028, month: 2 })).toBe('29 Feb 2028');
    expect(previousPeriod({ year: 2026, month: 1 })).toEqual({
      year: 2025,
      month: 12,
    });
  });
});

describe('reconciling items', () => {
  const march = { year: 2026, month: 3 };

  it('values each pair as unmatched left minus unmatched right', () => {
    const bySource = empty();
    // Matched in all three systems — contributes nothing.
    bySource.prism.push(rec('prism', '2026-03-05', -1000, 'a'));
    bySource.dynamics.push(rec('dynamics', '2026-03-05', -1000, 'a'));
    bySource.bank.push(rec('bank', '2026-03-05', -1000, 'a'));
    // In Prism only: shows up against both Netting and Bank.
    bySource.prism.push(rec('prism', '2026-03-30', -250.5, 'b'));
    // In Dynamics only.
    bySource.dynamics.push(rec('dynamics', '2026-03-20', -40, 'c'));

    const { items } = computeReconcilingItems(bySource, march);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.prismVsNetting.value).toBe(-210.5); // -250.5 - (-40)
    expect(byId.prismVsBank.value).toBe(-250.5);
    expect(byId.bankVsNetting.value).toBe(40); // 0 - (-40)
    expect(byId.prismVsNetting.leftUnmatchedCount).toBe(1);
    expect(byId.prismVsNetting.rightUnmatchedCount).toBe(1);
  });

  it('leaves out records dated outside the period', () => {
    const bySource = empty();
    bySource.prism.push(rec('prism', '2026-03-31', -100, 'x'));
    // Posted in April — at 31 March it is still a reconciling item.
    bySource.dynamics.push(rec('dynamics', '2026-04-02', -100, 'x'));
    bySource.bank.push(rec('bank', '2026-03-31', -100, 'x'));

    const result = computeReconcilingItems(bySource, march);
    const byId = Object.fromEntries(result.items.map((i) => [i.id, i]));
    expect(byId.prismVsNetting.value).toBe(-100);
    expect(byId.prismVsBank.value).toBe(0);
    expect(result.recordsOutsidePeriod).toBe(1);
  });

  it('cannot value a pair when one side has no records', () => {
    const bySource = empty();
    bySource.prism.push(rec('prism', '2026-03-05', -10));
    bySource.dynamics.push(rec('dynamics', '2026-03-05', -10));
    const byId = Object.fromEntries(
      computeReconcilingItems(bySource, march).items.map((i) => [i.id, i])
    );
    expect(byId.prismVsNetting.value).toBe(0);
    expect(byId.prismVsBank.value).toBeNull();
    expect(byId.bankVsNetting.value).toBeNull();
  });

  it('counts only the report currency, defaulting to the most common', () => {
    const bySource = empty();
    bySource.prism.push(rec('prism', '2026-03-05', -10, 'a', 'ZWG'));
    bySource.prism.push(rec('prism', '2026-03-06', -20, 'b', 'ZWG'));
    bySource.prism.push(rec('prism', '2026-03-07', -99, 'c', 'USD'));
    bySource.bank.push(rec('bank', '2026-03-05', -10, 'a', 'ZWG'));
    bySource.bank.push(rec('bank', '2026-03-09', -7, 'd', null));
    bySource.dynamics.push(rec('dynamics', '2026-03-07', -99, 'c', 'USD'));

    const zwg = computeReconcilingItems(bySource, march);
    expect(zwg.currency).toBe('ZWG');
    expect(zwg.availableCurrencies).toEqual([
      { code: 'ZWG', count: 3 },
      { code: 'USD', count: 2 },
    ]);
    expect(zwg.otherCurrencyRecords).toBe(2);
    expect(zwg.noCurrencyRecords).toBe(1);
    const zwgById = Object.fromEntries(zwg.items.map((i) => [i.id, i]));
    expect(zwgById.prismVsBank.value).toBe(-20);

    const usd = computeReconcilingItems(bySource, march, 'USD');
    expect(usd.currency).toBe('USD');
    const usdById = Object.fromEntries(usd.items.map((i) => [i.id, i]));
    expect(usdById.prismVsNetting.value).toBe(0);
    expect(usdById.prismVsBank.value).toBe(-99);
  });
});

describe('balance figures', () => {
  function item(value: number | null): ReconcilingItem {
    return {
      id: 'prismVsNetting',
      label: '',
      left: 'prism',
      right: 'dynamics',
      value,
      leftUnmatchedCount: 0,
      leftUnmatchedValue: 0,
      rightUnmatchedCount: 0,
      rightUnmatchedValue: 0,
    };
  }

  it('reproduces the March 2026 signed-off front page', () => {
    const figures = computeBalanceFigures(
      9_443_163.62,
      [item(-4_091_942.01), item(-1_717_581.49), item(0)],
      3_633_640.12
    );
    expect(figures.reconcilingTotal).toBe(-5_809_523.5);
    expect(figures.subtotal).toBe(3_633_640.12);
    expect(figures.difference).toBe(0);
  });

  it('cannot total when an item or input is missing', () => {
    expect(computeBalanceFigures(100, [item(null)], 100).subtotal).toBeNull();
    expect(computeBalanceFigures(null, [item(1)], 100).difference).toBeNull();
    expect(computeBalanceFigures(100, [item(1)], null).difference).toBeNull();
  });

  it('formats amounts in accounting style', () => {
    expect(formatAccounting(3_633_640.12)).toBe('3,633,640.12');
    expect(formatAccounting(-5_809_523.5)).toBe('(5,809,523.50)');
    expect(formatAccounting(0)).toBe('-');
    expect(formatAccounting(0, 'number')).toBe('0.00');
    expect(formatAccounting(null)).toBe('n/a');
  });
});
