import { describe, it, expect } from 'vitest';
import { matchKeyFor, matchPair } from './matching';
import type { NormalizedRecord } from './normalization';

describe('matchPair', () => {
  const baseRecord: Omit<
    NormalizedRecord,
    'key' | 'amount' | 'date' | 'reference'
  > = {
    source: 'bank',
    fileId: 'file-1',
    fileName: 'test.csv',
    rowIndex: 0,
    absAmount: 0,
    currency: 'USD',
    zolid: '',
    cashKey: '',
    raw: {},
  };

  it('should match records with the same reference', () => {
    const a: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'a1',
        amount: 100,
        date: new Date('2023-01-15'),
        reference: 'ref-1',
      },
    ];
    const b: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'b1',
        amount: 100,
        date: new Date('2023-01-15'),
        reference: 'ref-1',
      },
      {
        ...baseRecord,
        key: 'b2',
        amount: 200,
        date: new Date('2023-01-15'),
        reference: 'ref-2',
      },
    ];
    const pairs = matchPair(a, b);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0].key).toBe('a1');
    expect(pairs[0][1].key).toBe('b1');
  });

  it('should match records with similar amounts and dates', () => {
    const a: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'a1',
        amount: 100.1,
        date: new Date('2023-01-15'),
        reference: '',
      },
    ];
    const b: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'b1',
        amount: 100.2,
        date: new Date('2023-01-16'),
        reference: '',
      },
      {
        ...baseRecord,
        key: 'b2',
        amount: 200,
        date: new Date('2023-01-15'),
        reference: '',
      },
    ];
    const pairs = matchPair(a, b);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0].key).toBe('a1');
    expect(pairs[0][1].key).toBe('b1');
  });

  it('should not match records outside the date window', () => {
    const a: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'a1',
        amount: 100,
        date: new Date('2023-01-15'),
        reference: '',
      },
    ];
    const b: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'b1',
        amount: 100,
        date: new Date('2023-01-25'),
        reference: '',
      },
    ];
    const pairs = matchPair(a, b);
    expect(pairs).toHaveLength(0);
  });

  it('should not match records with different amounts outside the tolerance', () => {
    const a: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'a1',
        amount: 100,
        date: new Date('2023-01-15'),
        reference: '',
      },
    ];
    const b: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'b1',
        amount: 110,
        date: new Date('2023-01-15'),
        reference: '',
      },
    ];
    const pairs = matchPair(a, b);
    expect(pairs).toHaveLength(0);
  });

  it('should handle multiple matches and pick the best score', () => {
    const a: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'a1',
        amount: 100,
        date: new Date('2023-01-15'),
        reference: '',
      },
    ];
    const b: NormalizedRecord[] = [
      {
        ...baseRecord,
        key: 'b1',
        amount: 100.1,
        date: new Date('2023-01-16'),
        reference: '',
      }, // Good match
      {
        ...baseRecord,
        key: 'b2',
        amount: 100.0,
        date: new Date('2023-01-15'),
        reference: '',
      }, // Better match
    ];
    const pairs = matchPair(a, b);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][1].key).toBe('b2');
  });

  it('matches Prism to Bank on the ZOL ID and Prism to Netting on the cash key', () => {
    const rec = (
      key: string,
      amount: number,
      ids: { zolid?: string; cashKey?: string; reference?: string }
    ): NormalizedRecord => ({
      ...baseRecord,
      key,
      amount,
      absAmount: amount,
      date: new Date('2026-08-10'),
      reference: ids.reference ?? '',
      zolid: ids.zolid ?? '',
      cashKey: ids.cashKey ?? '',
    });
    // Two Prism payments of the same amount on the same day: only the keys
    // tell them apart.
    const prism = [
      rec('p1', 500, { zolid: 'zol-1', cashKey: 'ck-9' }),
      rec('p2', 500, { zolid: 'zol-2', cashKey: 'ck-8' }),
    ];
    const bank = [rec('b2', 500, { zolid: 'zol-2' })];
    const netting = [rec('d1', 500, { cashKey: 'ck-9' })];

    const vsBank = matchPair(prism, bank, matchKeyFor('prism', 'bank'));
    expect(vsBank.map(([a, b]) => [a.key, b.key])).toEqual([['p2', 'b2']]);

    const vsNetting = matchPair(
      prism,
      netting,
      matchKeyFor('dynamics', 'prism')
    );
    expect(vsNetting.map(([a, b]) => [a.key, b.key])).toEqual([['p1', 'd1']]);
  });

  it('falls back to the general reference when a record has no pair key', () => {
    const key = matchKeyFor('prism', 'bank');
    expect(
      key({
        ...baseRecord,
        key: 'x',
        amount: 1,
        date: null,
        reference: 'inv-1',
      })
    ).toBe('inv-1');
  });

  it('matches Bank to Netting on the ZOL ID, not the narrative text', () => {
    // A bank statement's general reference column is often its narrative.
    const key = matchKeyFor('bank', 'dynamics');
    expect(
      key({
        ...baseRecord,
        key: 'y',
        amount: 1,
        date: null,
        reference: 'merchant settlement zol abc123',
        zolid: 'abc123',
      })
    ).toBe('abc123');
  });
});
