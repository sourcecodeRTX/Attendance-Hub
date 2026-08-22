import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';

/**
 * Mirrors the header-mapping logic currently inlined in
 * src/app/(dashboard)/students/page.tsx handleFileParse, so the harness has a
 * real CSV-parsing behavior to pin before the Phase 8 import-robustness work.
 */
function mapCsvRows(csvText: string): { rollNumber: string; fullName: string }[] {
  const results = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const parsed: { rollNumber: string; fullName: string }[] = [];
  for (const row of results.data) {
    const rollNumber =
      row['roll_number'] || row['Roll Number'] || row['rollNumber'] || '';
    const fullName =
      row['full_name'] || row['Full Name'] || row['fullName'] || row['name'] || row['Name'] || '';
    if (rollNumber.trim() && fullName.trim()) {
      parsed.push({ rollNumber: rollNumber.trim(), fullName: fullName.trim() });
    }
  }
  return parsed;
}

describe('students CSV import mapping', () => {
  it('maps snake_case headers', () => {
    const rows = mapCsvRows('roll_number,full_name\n001,Ada Lovelace\n');
    expect(rows).toEqual([{ rollNumber: '001', fullName: 'Ada Lovelace' }]);
  });

  it('maps Title Case headers', () => {
    const rows = mapCsvRows('Roll Number,Full Name\n002,Grace Hopper\n');
    expect(rows).toEqual([{ rollNumber: '002', fullName: 'Grace Hopper' }]);
  });

  it('maps camelCase headers', () => {
    const rows = mapCsvRows('rollNumber,fullName\n003,Alan Turing\n');
    expect(rows).toEqual([{ rollNumber: '003', fullName: 'Alan Turing' }]);
  });

  it('skips rows missing either required field', () => {
    const csv = [
      'roll_number,full_name',
      ',No Roll Here',
      '004,Complete Row',
      '005,',
    ].join('\n');
    expect(mapCsvRows(csv)).toEqual([{ rollNumber: '004', fullName: 'Complete Row' }]);
  });

  it('skips blank lines via skipEmptyLines', () => {
    const rows = mapCsvRows('roll_number,full_name\n\n006,Katherine Johnson\n\n');
    expect(rows).toEqual([{ rollNumber: '006', fullName: 'Katherine Johnson' }]);
  });

  it('trims surrounding whitespace from values', () => {
    const rows = mapCsvRows('roll_number,full_name\n" 007 ","  Mary Jackson  "\n');
    expect(rows).toEqual([{ rollNumber: '007', fullName: 'Mary Jackson' }]);
  });

  it('returns nothing for a file with unrecognized headers only', () => {
    expect(mapCsvRows('foo,bar\nbaz,qux\n')).toEqual([]);
  });
});
