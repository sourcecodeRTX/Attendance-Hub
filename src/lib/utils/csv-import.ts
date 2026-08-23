import Papa from 'papaparse';

export interface StudentCsvRow {
  rollNumber: string;
  fullName: string;
}

export type StudentsCsvResult =
  | { ok: true; students: StudentCsvRow[]; skippedCount: number }
  | { ok: false; error: string };

const ROLL_ALIASES = ['roll_number', 'Roll Number', 'rollNumber'];
const NAME_ALIASES = ['full_name', 'Full Name', 'fullName', 'name', 'Name'];

export const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024;

export function isAllowedCsvFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { ok: false, error: 'Only .csv files are supported. Please re-save your spreadsheet as CSV and try again.' };
  }
  if (file.size > MAX_CSV_FILE_BYTES) {
    return { ok: false, error: `File is too large (max ${MAX_CSV_FILE_BYTES / (1024 * 1024)} MB). Split it into smaller files.` };
  }
  return { ok: true };
}

export function parseStudentsCsv(csvText: string): StudentsCsvResult {
  let parsed: Papa.ParseResult<Record<string, string>>;
  try {
    parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });
  } catch {
    return { ok: false, error: 'Failed to parse file as CSV.' };
  }

  const fields = parsed.meta.fields ?? [];
  if (fields.length === 0) {
    return { ok: false, error: 'Missing required columns "roll_number" and "full_name". Found headers: (none)' };
  }
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return { ok: false, error: 'Failed to parse file as CSV.' };
  }
  const rollKey = ROLL_ALIASES.find((alias) => fields.includes(alias));
  const nameKey = NAME_ALIASES.find((alias) => fields.includes(alias));
  if (!rollKey || !nameKey) {
    return {
      ok: false,
      error: 'Missing required columns "roll_number" and "full_name". Found headers: ' + (fields.length > 0 ? fields.join(', ') : '(none)'),
    };
  }

  const students: StudentCsvRow[] = [];
  const seenRolls = new Set<string>();
  const duplicates = new Set<string>();
  let skippedCount = 0;

  for (const row of parsed.data) {
    const rollNumber = (row[rollKey] ?? '').trim();
    const fullName = (row[nameKey] ?? '').trim();
    if (!rollNumber || !fullName) {
      skippedCount += 1;
      continue;
    }
    if (seenRolls.has(rollNumber)) {
      duplicates.add(rollNumber);
      continue;
    }
    seenRolls.add(rollNumber);
    students.push({ rollNumber, fullName });
  }

  if (duplicates.size > 0) {
    const preview = Array.from(duplicates).slice(0, 5).join(', ');
    const suffix = duplicates.size > 5 ? ` (+${duplicates.size - 5} more)` : '';
    return {
      ok: false,
      error: `Duplicate roll numbers in the file: ${preview}${suffix}. Remove duplicates and try again.`,
    };
  }

  if (students.length === 0) {
    return { ok: false, error: 'No valid rows found. Ensure columns "roll_number" and "full_name" exist.' };
  }

  return { ok: true, students, skippedCount };
}
