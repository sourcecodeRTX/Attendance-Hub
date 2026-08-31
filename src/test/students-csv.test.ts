import { describe, expect, it } from 'vitest';
import { parseStudentsCsv } from '@/lib/utils/csv-import';

describe('students CSV import mapping (production parseStudentsCsv)', () => {
  it('maps snake_case headers', () => {
    const result = parseStudentsCsv('roll_number,full_name\n001,Ada Lovelace\n');
    expect(result).toEqual({
      ok: true,
      students: [{ rollNumber: '001', fullName: 'Ada Lovelace' }],
      skippedCount: 0,
    });
  });

  it('maps Title Case headers', () => {
    const result = parseStudentsCsv('Roll Number,Full Name\n002,Grace Hopper\n');
    expect(result).toEqual({
      ok: true,
      students: [{ rollNumber: '002', fullName: 'Grace Hopper' }],
      skippedCount: 0,
    });
  });

  it('maps camelCase headers', () => {
    const result = parseStudentsCsv('rollNumber,fullName\n003,Alan Turing\n');
    expect(result).toEqual({
      ok: true,
      students: [{ rollNumber: '003', fullName: 'Alan Turing' }],
      skippedCount: 0,
    });
  });

  it('skips rows missing either required field and reports skipped count', () => {
    const csv = [
      'roll_number,full_name',
      ',No Roll Here',
      '004,Complete Row',
      '005,',
    ].join('\n');
    const result = parseStudentsCsv(csv);
    expect(result).toEqual({
      ok: true,
      students: [{ rollNumber: '004', fullName: 'Complete Row' }],
      skippedCount: 2,
    });
  });

  it('skips blank lines via skipEmptyLines without counting them as skipped rows', () => {
    const result = parseStudentsCsv('roll_number,full_name\n\n006,Katherine Johnson\n\n');
    expect(result).toEqual({
      ok: true,
      students: [{ rollNumber: '006', fullName: 'Katherine Johnson' }],
      skippedCount: 0,
    });
  });

  it('trims surrounding whitespace from values', () => {
    const result = parseStudentsCsv('roll_number,full_name\n" 007 ","  Mary Jackson  "\n');
    expect(result).toEqual({
      ok: true,
      students: [{ rollNumber: '007', fullName: 'Mary Jackson' }],
      skippedCount: 0,
    });
  });

  it('rejects files with unrecognized headers and returns actionable error message', () => {
    const result = parseStudentsCsv('foo,bar\nbaz,qux\n');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Missing required column/i);
      expect(result.error).toMatch(/foo, ?bar/i);
    }
  });

  it('rejects files with duplicate roll numbers', () => {
    const result = parseStudentsCsv('roll_number,full_name\n008,Student A\n008,Student B\n');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Duplicate roll numbers');
      expect(result.error).toContain('008');
    }
  });
});
