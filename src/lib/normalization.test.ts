import { describe, it, expect } from 'vitest';
import { normalizeExtract } from './normalization';
import type { StoredExtract } from '@/lib/data-sources-context';

describe('normalizeExtract', () => {
  it('should normalize an extract with all columns present', () => {
    const extract: StoredExtract = {
      id: 'file-1',
      fileName: 'test.csv',
      source: 'bank',
      sizeBytes: 123,
      uploadedAt: new Date().toISOString(),
      headers: ['Amount', 'Date', 'Currency', 'ID'],
      rowCount: 2,
      amountColumn: 'Amount',
      dateColumn: 'Date',
      currencyColumn: 'Currency',
      idColumn: 'ID',
      totalAmount: 50.25,
      dateRange: {
        start: new Date('2023-01-15').toISOString(),
        end: new Date('2023-01-16').toISOString(),
      },
      currencies: ['USD', 'EUR'],
      rows: [
        { Amount: '100.50', Date: '2023-01-15', Currency: 'USD', ID: 'txn_1' },
        { Amount: '-50.25', Date: '2023-01-16', Currency: 'EUR', ID: 'txn_2' },
      ],
    };
    const normalized = normalizeExtract(extract);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({
      key: 'file-1:0',
      source: 'bank',
      fileId: 'file-1',
      fileName: 'test.csv',
      rowIndex: 0,
      date: new Date('2023-01-15'),
      amount: 100.5,
      absAmount: 100.5,
      currency: 'USD',
      reference: 'txn_1',
      zolid: '',
      cashKey: '',
      raw: {
        Amount: '100.50',
        Date: '2023-01-15',
        Currency: 'USD',
        ID: 'txn_1',
      },
    });
    expect(normalized[1]).toEqual({
      key: 'file-1:1',
      source: 'bank',
      fileId: 'file-1',
      fileName: 'test.csv',
      rowIndex: 1,
      date: new Date('2023-01-16'),
      amount: -50.25,
      absAmount: 50.25,
      currency: 'EUR',
      reference: 'txn_2',
      zolid: '',
      cashKey: '',
      raw: {
        Amount: '-50.25',
        Date: '2023-01-16',
        Currency: 'EUR',
        ID: 'txn_2',
      },
    });
  });

  it('should handle missing optional columns', () => {
    const extract: StoredExtract = {
      id: 'file-2',
      fileName: 'test.csv',
      source: 'dynamics',
      sizeBytes: 45,
      uploadedAt: new Date().toISOString(),
      headers: ['Amount', 'Date'],
      rowCount: 1,
      amountColumn: 'Amount',
      dateColumn: 'Date',
      currencyColumn: null,
      idColumn: null,
      totalAmount: 200,
      dateRange: {
        start: new Date('2023-02-01').toISOString(),
        end: new Date('2023-02-01').toISOString(),
      },
      currencies: [],
      rows: [{ Amount: '200', Date: '2023-02-01' }],
    };
    const normalized = normalizeExtract(extract);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual({
      key: 'file-2:0',
      source: 'dynamics',
      fileId: 'file-2',
      fileName: 'test.csv',
      rowIndex: 0,
      date: new Date('2023-02-01'),
      amount: 200,
      absAmount: 200,
      currency: null,
      reference: '',
      zolid: '',
      cashKey: '',
      raw: { Amount: '200', Date: '2023-02-01' },
    });
  });

  it('should handle null and undefined values in rows', () => {
    const extract: StoredExtract = {
      id: 'file-3',
      fileName: 'test.csv',
      source: 'prism',
      sizeBytes: 90,
      uploadedAt: new Date().toISOString(),
      headers: ['Amount', 'Date', 'Currency', 'ID'],
      rowCount: 2,
      amountColumn: 'Amount',
      dateColumn: 'Date',
      currencyColumn: 'Currency',
      idColumn: 'ID',
      totalAmount: 100,
      dateRange: {
        start: new Date('2023-03-01').toISOString(),
        end: new Date('2023-03-01').toISOString(),
      },
      currencies: ['USD'],
      rows: [
        { Amount: null, Date: null, Currency: 'USD', ID: 'txn_3' },
        { Amount: '100', Date: '2023-03-01', Currency: null, ID: null },
      ],
    };
    const normalized = normalizeExtract(extract);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({
      key: 'file-3:0',
      source: 'prism',
      fileId: 'file-3',
      fileName: 'test.csv',
      rowIndex: 0,
      date: null,
      amount: null,
      absAmount: 0,
      currency: 'USD',
      reference: 'txn_3',
      zolid: '',
      cashKey: '',
      raw: { Amount: null, Date: null, Currency: 'USD', ID: 'txn_3' },
    });
    expect(normalized[1]).toEqual({
      key: 'file-3:1',
      source: 'prism',
      fileId: 'file-3',
      fileName: 'test.csv',
      rowIndex: 1,
      date: new Date('2023-03-01'),
      amount: 100,
      absAmount: 100,
      currency: null,
      reference: '',
      zolid: '',
      cashKey: '',
      raw: { Amount: '100', Date: '2023-03-01', Currency: null, ID: null },
    });
  });
});
