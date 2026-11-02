import { describe, it, expect } from 'vitest';
import { validateRow } from './extract-parser';
import type { ExtractRow } from './extract-parser';

describe('validateRow', () => {
  it('should return no errors for a valid row', () => {
    const row: ExtractRow = { Amount: '100.50', Date: '2023-01-15' };
    const errors = validateRow(row, 'Amount', 'Date');
    expect(errors).toHaveLength(0);
  });

  it('should return an error for an invalid amount', () => {
    const row: ExtractRow = { Amount: 'invalid', Date: '2023-01-15' };
    const errors = validateRow(row, 'Amount', 'Date');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Invalid amount in column "Amount"');
  });

  it('should return an error for an invalid date', () => {
    const row: ExtractRow = { Amount: '100.50', Date: 'invalid' };
    const errors = validateRow(row, 'Amount', 'Date');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Invalid date in column "Date"');
  });

  it('should return multiple errors for multiple invalid fields', () => {
    const row: ExtractRow = { Amount: 'invalid', Date: 'invalid' };
    const errors = validateRow(row, 'Amount', 'Date');
    expect(errors).toHaveLength(2);
  });

  it('should handle missing columns gracefully', () => {
    const row: ExtractRow = { Amount: '100.50' };
    const errors = validateRow(row, 'Amount', 'Date');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Invalid date in column "Date"');
  });
});
