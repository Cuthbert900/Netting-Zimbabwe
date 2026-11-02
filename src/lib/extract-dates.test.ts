import { describe, it, expect } from 'vitest';
import {
  coerceDate,
  coerceNumber,
  inferDateOrder,
  pickAmountColumn,
} from './extract-parser';

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe('date reading, as found in real August 2026 extracts', () => {
  it('reads NMB slash dates day-first and CABS month-first', () => {
    const nmb = ['1/8/2026', '13/8/2026', '31/8/2026'];
    const cabs = ['8/1/2026', '8/3/2026', '8/31/2026'];
    expect(inferDateOrder(nmb)).toBe('dmy');
    expect(inferDateOrder(cabs)).toBe('mdy');
    expect(day(coerceDate('1/8/2026', 'dmy'))).toBe('2026-08-01');
    expect(day(coerceDate('8/1/2026', 'mdy'))).toBe('2026-08-01');
  });

  it('defaults ambiguous columns to day-first', () => {
    expect(inferDateOrder(['1/8/2026', '2/8/2026'])).toBe('dmy');
  });

  it('reads dashed day-first dates', () => {
    expect(day(coerceDate('31-07-2026', 'dmy'))).toBe('2026-07-31');
  });

  it('puts Excel dates stored as Harare midnight back on the right day', () => {
    // Prism: 1 August 00:00 in Harare, held as 31 July 21:59:42 UTC.
    expect(day(coerceDate(new Date('2026-07-31T21:59:42.000Z')))).toBe(
      '2026-08-01'
    );
    expect(day(coerceDate('2026-08-22T21:59:42.000Z'))).toBe('2026-08-23');
    expect(day(coerceDate('2026-08-05'))).toBe('2026-08-05');
  });

  it('rejects impossible dates instead of rolling them over', () => {
    expect(coerceDate('31/2/2026', 'dmy')).toBeNull();
  });

  it('reads amounts with space thousands separators', () => {
    expect(coerceNumber('3 570 378.34')).toBe(3570378.34);
    expect(coerceNumber('1 588')).toBe(1588);
  });

  it('never takes a date or a one-sided debit/credit column as the amount', () => {
    // NMB: no single amount column, so a net Credit − Debit column is built.
    expect(
      pickAmountColumn([
        'Transaction Date',
        'Value Date',
        'Narration',
        'Debit Amount',
        'Credit Amount',
        'Running Balance',
      ])
    ).toBeNull();
    // Prism: the signed Amount column, not DebitAmount/CreditAmount.
    expect(
      pickAmountColumn(['PostDate', 'DebitAmount', 'CreditAmount', 'Amount'])
    ).toBe('Amount');
  });
});
