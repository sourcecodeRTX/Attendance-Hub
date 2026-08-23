import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

const MIGRATION_022 = '022_attendance_session_revision.sql';
let sql = '';

beforeAll(() => {
  sql = readMigration(MIGRATION_022);
});

describe('migration 022 — structural integrity', () => {
  it('exists as an append-only continuation past migration 021', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    expect(files).toContain(MIGRATION_022);
    const highestPrior = files.filter((f) => /^\d{3}_/.test(f) && f < MIGRATION_022).pop();
    expect(highestPrior).toBe('021_rls_escalation_audit_and_scope_fixes.sql');
  });

  it('has balanced dollar-quoted blocks', () => {
    expect(((sql.match(/\$\$/g) ?? []).length) % 2).toBe(0);
  });
});

describe('F-010 — server-maintained revision counter for attendance_sessions', () => {
  it('adds a NOT NULL revision column defaulting to 1 (fills pre-existing rows)', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.attendance_sessions\s+ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;/
    );
  });

  it('installs a BEFORE UPDATE trigger bumping the revision on every update', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_attendance_session_revision\s+BEFORE UPDATE ON public\.attendance_sessions\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.bump_attendance_revision\(\);/
    );
    const bodyStart = sql.indexOf('bump_attendance_revision()');
    expect(bodyStart).toBeGreaterThan(0);
    expect(sql.slice(bodyStart)).toMatch(/NEW\.revision\s*:=\s*OLD\.revision \+ 1;/);
  });

  it('drops any prior trigger of the same name instead of failing on re-apply', () => {
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS trg_attendance_session_revision ON public\.attendance_sessions;/
    );
  });
});
