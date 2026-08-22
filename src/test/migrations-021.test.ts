import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

function policyBlock(sqlText: string, name: string): string {
  const marker = `CREATE POLICY "${name}"`;
  const start = sqlText.indexOf(marker);
  expect(start, `policy ${name} must exist`).toBeGreaterThanOrEqual(0);
  const end = sqlText.indexOf(';', start);
  expect(end, `policy ${name} statement must be terminated`).toBeGreaterThan(start);
  return sqlText.slice(start, end);
}

function functionBody(sqlText: string, fnName: string): string {
  const start = sqlText.indexOf(`${fnName}()`);
  expect(start, `function ${fnName} must exist`).toBeGreaterThanOrEqual(0);
  const bodyStart = sqlText.indexOf('$$', start);
  const end = sqlText.indexOf('$$;', bodyStart);
  expect(end, `function ${fnName} body must be dollar-terminated`).toBeGreaterThan(bodyStart);
  return sqlText.slice(bodyStart, end + 3);
}

const MIGRATION_021 = '021_rls_escalation_audit_and_scope_fixes.sql';
let sql = '';

beforeAll(() => {
  sql = readMigration(MIGRATION_021);
});

describe('migration 021 — structural integrity', () => {
  it('exists as an append-only continuation past migration 020', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    expect(files).toContain(MIGRATION_021);
    const highestPrior = files.filter((f) => /^\d{3}_/.test(f) && f < MIGRATION_021).pop();
    expect(highestPrior).toBe('020_fix_attendance_rls_for_mixed_roles.sql');
  });

  it('has balanced dollar-quoted blocks', () => {
    expect(((sql.match(/\$\$/g) ?? []).length) % 2).toBe(0);
  });
});

describe('F-004 — users UPDATE self-promotion to super_admin blocked', () => {
  it('drops the blanket update_university_users policy', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "update_university_users" ON public\.users;/);
  });

  it('creates a self-update policy whose WITH CHECK pins role to the pre-update value', () => {
    const block = policyBlock(sql, 'users_self_update');
    expect(block).toMatch(/FOR UPDATE/);
    expect(block).toMatch(/id = \(SELECT auth\.uid\(\)\)/);
    expect(block).toMatch(/role = public\.get_my_role\(\)/);
    expect(block).toMatch(/university_id = public\.get_my_university_id\(\)/);
  });

  it('restricts other-row updates to super_admin/admin only (primary_teacher removed)', () => {
    const block = policyBlock(sql, 'admins_update_university_users');
    expect(block).toMatch(/FOR UPDATE/);
    expect(block).toMatch(/get_my_role\(\) IN \('super_admin', 'admin'\)/);
    expect(block).not.toMatch(/primary_teacher/);
    expect(block).toMatch(/id <> \(SELECT auth\.uid\(\)\)/);
  });

  it('installs a guard trigger blocking super_admin introduction by authenticated callers', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_prevent_super_admin_escalation\s+BEFORE INSERT OR UPDATE OF role ON public\.users/
    );
    const fnBody = functionBody(sql, 'prevent_super_admin_escalation');
    expect(fnBody).toMatch(/NEW\.role = 'super_admin'/);
    expect(fnBody).toMatch(/\(SELECT auth\.uid\(\)\) IS NOT NULL/);
    expect(fnBody).toMatch(/RAISE EXCEPTION/);
    expect(fnBody).toMatch(/ERRCODE = '42501'/);
  });

  it('relies on helpers that exist in the operative migration chain', () => {
    const m008 = readMigration('008_policy_perf_and_fk_indexes.sql');
    for (const helper of ['get_my_university_id', 'get_my_role', 'get_my_department_id']) {
      expect(m008).toMatch(new RegExp(`FUNCTION public\\.${helper}`));
    }
  });

  it('no later migration re-creates the dropped blanket update policy', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files.filter((x) => x >= MIGRATION_021)) {
      expect(readMigration(f)).not.toMatch(/CREATE POLICY "update_university_users"/);
    }
  });
});

describe('F-012 — activity log actor attribution enforced server-side', () => {
  it('rewrites performed_by_* from the verified session profile via BEFORE INSERT trigger', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_enforce_activity_log_actor\s+BEFORE INSERT ON public\.activity_logs/
    );
    const fnBody = functionBody(sql, 'enforce_activity_log_actor');
    expect(fnBody).toMatch(/NEW\.performed_by_id\s*:=\s*v_uid/);
    expect(fnBody).toMatch(/NEW\.performed_by_role\s*:=\s*v_role/);
    expect(fnBody).toMatch(/NEW\.performed_by_name\s*:=\s*v_name/);
    expect(fnBody).toMatch(/IF v_uid IS NULL THEN[\s\S]*?RETURN NEW;/);
    expect(fnBody).toMatch(/FROM public\.users u\s+WHERE u\.id = v_uid/);
  });

  it('pins performed_by_id to the caller in the INSERT policy', () => {
    const block = policyBlock(sql, 'insert_activity_logs');
    expect(block).toMatch(/university_id = public\.get_my_university_id\(\)/);
    expect(block).toMatch(/performed_by_id = \(SELECT auth\.uid\(\)\)/);
  });
});

describe('F-025 — open university bootstrap INSERT policy removed', () => {
  it('drops anyone_can_create_university without re-creating any INSERT path', () => {
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "anyone_can_create_university" ON public\.universities;/
    );
    expect(sql).not.toMatch(/CREATE POLICY[^;]*ON public\.universities/);
  });

  it('no later migration re-creates the open insert policy', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files.filter((x) => x >= MIGRATION_021)) {
      expect(readMigration(f)).not.toMatch(/CREATE POLICY "anyone_can_create_university"/);
    }
  });
});

describe('F-026 — admin reads scoped to their department on students/attendance', () => {
  it.each([
    ['read_accessible_students'],
    ['read_accessible_attendance'],
  ])('recreates %s with a department-scoped admin branch', (policy) => {
    expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS "${policy}" ON public\\.`));
    const block = policyBlock(sql, policy);
    expect(block).toMatch(/get_my_role\(\) = 'super_admin'/);
    expect(block).toMatch(
      /get_my_role\(\) = 'admin'[\s\S]*?department_id = public\.get_my_department_id\(\)/
    );
    expect(block).not.toMatch(/IN \('super_admin', 'admin'\)/);
    expect(block).toMatch(/FROM public\.user_sections WHERE user_id = \(SELECT auth\.uid\(\)\)/);
    expect(block).toMatch(/FROM public\.user_subjects WHERE user_id = \(SELECT auth\.uid\(\)\)/);
    expect(block).toMatch(/university_id = public\.get_my_university_id\(\)/);
  });
});
