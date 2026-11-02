import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  coerceDate,
  coerceNumber,
  currencyFromPreamble,
  normalizeCurrency,
  repairSwappedDate,
  statementMonth,
  ZOL_ID_COLUMN,
  zolIdFromNote,
  zolIdFromText,
} from './cleaning';
import { NET_AMOUNT_COLUMN, parseExtractFile } from './extract-parser';

// Shapes copied from the real August 2026 extracts; names, accounts and
// amounts are made up.

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

function workbookFile(name: string, aoa: unknown[][]): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], name);
}

describe('amounts', () => {
  it.each([
    ['32 542 634.80', 32542634.8],
    ['1,250.00', 1250],
    ['(1,250.00)', -1250],
    ['1250.00-', -1250],
    ['1 250.00 DR', -1250],
    ['1 250.00 CR', 1250],
    ['USD 1,250', 1250],
    ['US$1,250.50', 1250.5],
  ])('reads %j', (input, expected) => {
    expect(coerceNumber(input)).toBe(expected);
  });

  it('rejects text', () => {
    expect(coerceNumber('REF 123')).toBeNull();
    expect(coerceNumber('')).toBeNull();
  });
});

describe('currencies', () => {
  it('maps the spellings in use to ISO codes', () => {
    expect(normalizeCurrency(' us$ ')).toBe('USD');
    expect(normalizeCurrency('ZiG')).toBe('ZWG');
    expect(normalizeCurrency('RTGS')).toBe('ZWL');
    expect(normalizeCurrency('usd')).toBe('USD');
  });

  it('reads the account currency from a statement header block', () => {
    expect(currencyFromPreamble([['Currency', 'ZWG']])).toBe('ZWG');
    expect(
      currencyFromPreamble([['Statement Period :', 'Account Currency  ZWG']])
    ).toBe('ZWG');
    expect(
      currencyFromPreamble([['BLOCK B SOME OFFICE PARK,Currency:ZWG']])
    ).toBe('ZWG');
    expect(currencyFromPreamble([['Account Name:', 'ACME']])).toBeNull();
  });
});

describe('CBZ dates Excel read as yy/mm/dd', () => {
  const aug2026 = 2026 * 12 + 7;
  const utc = (s: string) => new Date(`${s}T00:00:00Z`);

  it('swaps day and year back', () => {
    expect(day(repairSwappedDate(utc('2017-08-26'), aug2026))).toBe(
      '2026-08-17'
    );
    expect(day(repairSwappedDate(utc('1931-07-26'), aug2026))).toBe(
      '2026-07-31'
    );
    // Off by only a year, but still a swapped 25 Aug 2026
    expect(day(repairSwappedDate(utc('2025-08-26'), aug2026))).toBe(
      '2026-08-25'
    );
  });

  it('leaves dates in or next to the statement month alone', () => {
    expect(repairSwappedDate(utc('2026-08-26'), aug2026)).toBeNull();
    expect(repairSwappedDate(utc('2026-09-01'), aug2026)).toBeNull();
    // A genuine December date in a January statement isn't "repaired"
    expect(repairSwappedDate(utc('2025-12-26'), 2026 * 12)).toBeNull();
  });

  it('finds the statement month even when most dates are swapped', () => {
    const dates = ['2017-08-26', '2018-08-26', '2019-08-26', '2026-08-01'].map(
      utc
    );
    expect(statementMonth(dates)).toBe(aug2026);
  });
});

describe('ZOL IDs', () => {
  it.each([
    ['IB202608037290EC40 ZOL-224046 ', '224046'],
    ['USSD ZOL 230141 ZJ085B9V', '230141'],
    ['LIT ID 63455  JOHN DOE', '63455'],
    ['430378:ZOL MB17855238058DB18365 ', '430378'],
    ['290935 LTE_PAYG_30_5GB:ZOL MB17855240870', '290935'],
    ['//XXXX/BKP/SBICZWHXXXX J DOE ZOL 057573', '57573'],
  ])('finds it in narrative %j', (text, expected) => {
    expect(zolIdFromText(text)).toBe(expected);
  });

  it('ignores narratives without one', () => {
    expect(zolIdFromText('SERVICE FEES : AUG-2026')).toBeNull();
    expect(zolIdFromText('MPOS/Purchase /X0434T08/Liquid Home')).toBeNull();
  });

  it.each([
    [47555, '47555'],
    ['75420 CS10829232', '75420'],
    ['LIT-326807,CS10848916', '326807'],
    ['ZOL  143596', '143596'],
    ['LIT-503631.', '503631'],
  ])("reads the team's note %j", (note, expected) => {
    expect(zolIdFromNote(note)).toBe(expected);
  });

  it.each(['INT', 'USSD', 'CS10820040', 'LTZ 006315', -19562.06, 4406327.32])(
    'ignores note %j',
    (note) => {
      expect(zolIdFromNote(note)).toBeNull();
    }
  );
});

describe('parseExtractFile on real statement layouts', () => {
  it('cleans an NMB-style statement', async () => {
    const p = await parseExtractFile(
      workbookFile('NMB ZWG 0001 AUGUST.xlsx', [
        ['ACCOUNT NAME : ', 'Acme t/a Example'],
        [],
        ['ACCOUNT NUMBER : ', 'ZWG 00000000000001'],
        [],
        [
          'Transaction Date',
          'Value Date',
          'Narration',
          'Ref. No.',
          'Debit Amount',
          'Credit Amount',
          'Running Balance',
        ],
        [
          '3/8/2026',
          '3/8/2026',
          'IB2026 ZOL-224046 ',
          5802,
          0,
          '5 573',
          '1 005 573.00',
        ],
        [
          '3/8/2026',
          '3/8/2026',
          'MPOS/Purchase',
          5952,
          0,
          158,
          '1 005 731.00',
          null,
          'MPOS',
        ],
        [
          '31-08-2026',
          '31-08-2026',
          'Charges',
          5954,
          1.58,
          0,
          '1 005 729.42',
          null,
          75420,
        ],
      ])
    );
    expect(p.amountColumn).toBe(NET_AMOUNT_COLUMN);
    expect(p.idColumn).toBe('Ref. No.');
    expect(p.zolidColumn).toBe(ZOL_ID_COLUMN);
    expect(p.fileCurrency).toBe('ZWG');
    expect(p.rows.map((r) => r['Transaction Date'])).toEqual([
      '2026-08-03',
      '2026-08-03',
      '2026-08-31',
    ]);
    expect(p.rows.map((r) => r[NET_AMOUNT_COLUMN])).toEqual([5573, 158, -1.58]);
    expect(p.rows.map((r) => r[ZOL_ID_COLUMN])).toEqual([
      '224046',
      null,
      '75420',
    ]);
    expect(p.totalAmount).toBe(5729.42);
    expect(p.cleaning?.balanceBreaks).toBe(0);
  });

  it('reads credits from a "Credits" column, not "Transaction Description"', async () => {
    const p = await parseExtractFile(
      workbookFile('CBZ ZWG AUGUST.xlsx', [
        [
          'Posting Date',
          'Value Date',
          'Transaction Description',
          'Cheque or Ref Number',
          'Debits',
          'Credits',
          'Balance',
        ],
        ['1/8/2026', '1/8/2026', 'PAYMENT', '660FBPM1', null, 60, 1060],
        ['1/8/2026', '1/8/2026', 'SERVICE CHARGE', '047LFFA1', 10, null, 1050],
      ])
    );
    expect(p.totalAmount).toBe(50);
  });

  it('reads a StanChart statement with no header row and wrapped narratives', async () => {
    const p = await parseExtractFile(
      workbookFile('STANCHART ZWG AUGUST.xlsx', [
        ['Account Statement for Ac. 0100000000001'],
        ['for the period'],
        ['2026-08-01 to 2026-08-31'],
        [],
        ['ACME 1996 PRIVATE'],
        ['SOME OFFICE PARK,Currency:ZWG'],
        [],
        [
          '8/3/2026',
          'INCOMING RTGS TRANSFER UserRef-000036347989',
          '8/3/2026',
          '701MSIN1',
          null,
          5633,
          105633,
        ],
        [null, '/LOM/2/RRF/000036347989/BKB/SCBLZWH'],
        [null, '//XXXX/BKP/SBICZWHXXXX J DOE ZOL 57573    '],
        [
          '8/3/2026',
          'MAINTENANCE FEE',
          '8/3/2026',
          '701CAMC1',
          500,
          null,
          105133,
        ],
      ])
    );
    expect(p.dateColumn).toBe('Value Date');
    expect(p.fileCurrency).toBe('ZWG');
    expect(p.rowCount).toBe(2);
    expect(p.cleaning?.joinedLines).toBe(2);
    expect(p.rows[0][ZOL_ID_COLUMN]).toBe('57573');
    expect(p.totalAmount).toBe(5133);
  });

  it('drops opening-balance and footer lines and flags a balance break', async () => {
    const p = await parseExtractFile(
      workbookFile('TN BANK AUGUST.xlsx', [
        ['TN Bank Statement'],
        ['Currency', 'ZWG'],
        [
          'Value Date',
          'Post Date',
          'Reference',
          'Narrative',
          'Debit',
          'Credit',
          'Balance',
        ],
        [null, null, null, 'Balance at Period Start', null, null, 1000],
        ['3/8/2026', '3/8/2026', 'FT1', 'IB IFT', 0, 100, 1100],
        // 50 is missing between these two lines
        ['4/8/2026', '4/8/2026', 'FT2', 'IB IFT', 0, 100, 1250],
        [],
        [null, null, null, null, null, null, null, -19562.06],
      ])
    );
    expect(p.rowCount).toBe(2);
    expect(p.fileCurrency).toBe('ZWG');
    expect(p.cleaning?.removed).toEqual({
      'Opening/closing balance or total line': 1,
      'Line with no date and no amount': 1,
    });
    expect(p.cleaning?.balanceBreaks).toBe(1);
  });

  it('takes Prism ZOL IDs from BillingCustomerKey', async () => {
    const p = await parseExtractFile(
      workbookFile('Payment Aug 2026.xlsx', [
        [
          'JournalKey',
          'CashKey',
          'PostDate',
          'accountcode',
          'description',
          'Type',
          'BillingCustomerKey',
          'CustomerName',
          'CurrencyCode',
          'Description',
          'DebitAmount',
          'CreditAmount',
          'Amount',
        ],
        [
          1,
          16650650,
          '2026-08-23',
          'P2511',
          'Ecocash Merchant Payment',
          'P',
          510400,
          'J Doe',
          'usd',
          'top up',
          2,
          0,
          -2,
        ],
      ])
    );
    expect(p.zolidColumn).toBe('BillingCustomerKey');
    expect(p.cashKeyColumn).toBe('CashKey');
    expect(p.dateColumn).toBe('PostDate');
    expect(p.amountColumn).toBe('Amount');
    expect(p.currencies).toEqual(['USD']);
    expect(day(coerceDate(p.rows[0].PostDate))).toBe('2026-08-23');
  });
});
