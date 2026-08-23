import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

const MIGRATION_023 = '023_attendance_period_unique.sql';
let sql = '';

beforeAll(() => {
  sql = readMigration(MIGRATION_023);
});

describe('migration 023 — structural integrity', () => {
  it('exists as an append-only continuation past migration 022', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    expect(files).toContain(MIGRATION_023);
    const highestPrior = files.filter((f) => /^\d{3}_/.test(f) && f < MIGRATION_023).pop();
    expect(highestPrior).toBe('022_attendance_session_revision.sql');
  });
});

describe('F-016 — UNIQUE(subject_id, date, period_number) on attendance_sessions', () => {
  it('adds a unique constraint covering exactly subject_id, date and period_number', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.attendance_sessions\s+ADD CONSTRAINT attendance_sessions_subject_date_period_unique\s+UNIQUE \(subject_id, date, period_number\);/
    );
  });

  it('documents the no-duplicates precondition for existing data', () => {
    expect(sql).toMatch(/Precondition/i);
  });

  it('does not modify the revision column or trigger from migration 022', () => {
    expect(sql).not.toMatch(/revision/);
    expect(sql).not.toMatch(/CREATE TRIGGER/);
  });
});
