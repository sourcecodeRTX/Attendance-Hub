import { describe, it, expect } from 'vitest';
import { isAllowedCsvFile, parseStudentsCsv, MAX_CSV_FILE_BYTES } from './csv-import';

function csv(lines: string[]): string {
  return lines.join('\n');
}

describe('isAllowedCsvFile', () => {
  it('rejects non-csv extensions with a clear message', () => {
    const file = new File(['x'], 'students.xlsx');
    const result = isAllowedCsvFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/\.csv/i);
  });

  it('accepts .csv case-insensitively when under the size cap', () => {
    expect(isAllowedCsvFile(new File(['a,b'], 'roster.CSV')).ok).toBe(true);
  });

  it('rejects oversized files at MAX_CSV_FILE_BYTES', () => {
    const file = new File([new ArrayBuffer(10)], 'big.csv');
    Object.defineProperty(file, 'size', { value: MAX_CSV_FILE_BYTES + 1 });
    const result = isAllowedCsvFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/i);
  });
});

describe('parseStudentsCsv', () => {
  it('parses snake_case headers', () => {
    const result = parseStudentsCsv(csv(['roll_number,full_name', '1,Alice', '2,Bob']));
    expect(result).toEqual({ ok: true, students: [{ rollNumber: '1', fullName: 'Alice' }, { rollNumber: '2', fullName: 'Bob' }], skippedCount: 0 });
  });

  it('parses TitleCase and camelCase header aliases including name/Name', () => {
    for (const header of ['Roll Number,Full Name', 'rollNumber,fullName', 'roll_number,name', 'Roll Number,Name']) {
      const result = parseStudentsCsv(csv([header, '7,Grace']));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.students).toEqual([{ rollNumber: '7', fullName: 'Grace' }]);
    }
  });

  it('rejects files missing a required column and lists found headers', () => {
    const result = parseStudentsCsv(csv(['roll_number,email', '1,a@b.c']));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/roll_number, ?email/);
  });

  it('rejects headerless/empty input listing no headers', () => {
    const result = parseStudentsCsv('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('(none)');
  });

  it('trims whitespace around values', () => {
    const result = parseStudentsCsv(csv(['roll_number,full_name', '  3 ,  Hina  ']));
    expect(result).toEqual({ ok: true, students: [{ rollNumber: '3', fullName: 'Hina' }], skippedCount: 0 });
  });

  it('skips rows missing either field and reports the skipped count', () => {
    const result = parseStudentsCsv(
      csv(['roll_number,full_name', ',NoName', '5,', '', '6,Ok'])
    );
    expect(result).toEqual({ ok: true, students: [{ rollNumber: '6', fullName: 'Ok' }], skippedCount: 2 });
  });

  it('reports whitespace-only fields as invalid rows', () => {
    const result = parseStudentsCsv(csv(['roll_number,full_name', '"  ","  "', '9,Zed']));
    expect(result).toEqual({ ok: true, students: [{ rollNumber: '9', fullName: 'Zed' }], skippedCount: 1 });
  });

  it('rejects in-file duplicate roll numbers naming them', () => {
    const result = parseStudentsCsv(
      csv(['roll_number,full_name', '10,First', '10,Second'])
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Duplicate roll numbers');
    if (!result.ok) expect(result.error).toContain('10');
  });

  it('detects duplicates after trimming and lists up to five then a count suffix', () => {
    const dupes = ['21', '22', '23', '24', '25', '26'];
    const lines = ['roll_number,full_name', ...dupes.flatMap((d) => [` ${d} ,Name${d}`, `${d},Dup${d}`])];
    const result = parseStudentsCsv(csv(lines));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const d of dupes.slice(0, 5)) expect(result.error).toContain(d);
      expect(result.error).toContain('+1 more');
      expect(result.error).not.toContain('26,');
    }
  });

  it('returns an error for a file of only invalid rows', () => {
    const result = parseStudentsCsv(csv(['roll_number,full_name', ',', ',']));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/No valid rows/);
  });

  it('handles quoted names containing commas and formula-like content without treating them as structure', () => {
    const result = parseStudentsCsv(csv(['roll_number,full_name', '12,"Surname, Equal=Sign"', '13,+Plus']));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.students[0].fullName).toBe('Surname, Equal=Sign');
      expect(result.students[1].fullName).toBe('+Plus');
    }
  });

  it('handles unicode names', () => {
    const result = parseStudentsCsv(csv(['roll_number,full_name', '14,李明', '15,مرحبا']));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.students.map((s) => s.fullName)).toEqual(['李明', 'مرحبا']);
  });

  it('handles headers with leading and trailing whitespace', () => {
    const result = parseStudentsCsv(csv(['  roll_number  ,  full_name  ', '101,John Doe']));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.students).toEqual([{ rollNumber: '101', fullName: 'John Doe' }]);
    }
  });
});
