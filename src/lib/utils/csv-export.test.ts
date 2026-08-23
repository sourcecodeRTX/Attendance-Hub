import { describe, it, expect } from 'vitest';
import { sanitizeCsvCell, sanitizeCsvRows } from './csv-export';

describe('sanitizeCsvCell', () => {
  it.each(['=cmd()', '+SUM(A1)', '-1', '@x', '\tTabbed', '\rCR'])(
    'escapes formula-prefixed cell %j',
    (cell) => {
      expect(sanitizeCsvCell(cell)).toBe(`'${cell}`);
    }
  );

  it('leaves ordinary text untouched', () => {
    expect(sanitizeCsvCell('Aisha Rahman')).toBe('Aisha Rahman');
  });

  it('leaves empty string untouched', () => {
    expect(sanitizeCsvCell('')).toBe('');
  });

  it('preserves unicode and RTL names', () => {
    expect(sanitizeCsvCell('李明')).toBe('李明');
    expect(sanitizeCsvCell('مرحبا')).toBe('مرحبا');
  });

  it('does not treat a mid-string hyphen as a formula prefix', () => {
    expect(sanitizeCsvCell('roll - section A')).toBe('roll - section A');
  });

  it('stringifies non-string values without escaping plain numbers', () => {
    expect(sanitizeCsvCell(42)).toBe('42');
  });
});

describe('sanitizeCsvRows', () => {
  it('escapes every risky cell while preserving keys and safe cells', () => {
    const rows = [
      { Name: '=HYPERLINK("http://evil")', Target: 'Bob', Count: '5' },
      { Name: 'Carol', Target: '@admin', Details: '' },
    ];
    expect(sanitizeCsvRows(rows)).toEqual([
      { Name: "'=HYPERLINK(\"http://evil\")", Target: 'Bob', Count: '5' },
      { Name: 'Carol', Target: "'@admin", Details: '' },
    ]);
  });

  it('returns an empty array unchanged', () => {
    expect(sanitizeCsvRows([])).toEqual([]);
  });

  it('produces unparse-safe CSV where no cell executes as a formula', async () => {
    const Papa = (await import('papaparse')).default;
    const csv = Papa.unparse(sanitizeCsvRows([{ A: '=1+1', B: 'ok' }]));
    expect(csv).toContain("'=1+1");
  });
});
