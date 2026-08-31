import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({})),
}));

import { sanitizeCsvCell, sanitizeCsvRows } from '@/lib/utils/csv-export';
import { isAllowedCsvFile, parseStudentsCsv, MAX_CSV_FILE_BYTES } from '@/lib/utils/csv-import';
import { mapRemoteToLocal } from '@/lib/db/sync';
import { getLocalDateString } from '@/lib/utils/date';
import {
  studentSchema,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  managedAuthUserSchema,
  managedProfileSchema,
} from '@/lib/utils/validation';
import { isProtectedPath, hasSupabaseAuthCookie } from '@/middleware';

describe('Phase 23: Compressed Re-Audit — Multi-Subsystem Integrity & Regression Suite', () => {
  const rootDir = process.cwd();

  describe('1. Auth, Session Security & Server Action Boundaries', () => {
    it('verifies server-auth.ts revalidates session against auth server via getUser()', () => {
      const serverAuthCode = readFileSync(resolve(rootDir, 'src/lib/supabase/server-auth.ts'), 'utf-8');
      expect(serverAuthCode).toContain('supabase.auth.getUser()');
      expect(serverAuthCode).toContain('requireUniversitySuperAdmin');
      expect(serverAuthCode).toContain('getVerifiedCaller');
    });

    it('verifies privileged user actions enforce strict role hierarchy and input validation', () => {
      const actionsCode = readFileSync(resolve(rootDir, 'src/app/(dashboard)/actions.ts'), 'utf-8');
      expect(actionsCode).toContain('MANAGED_AUTH_CALLER_ROLES');
      expect(actionsCode).toContain('CREATABLE_PROFILE_ROLES');
      expect(actionsCode).toContain('managedAuthUserSchema.safeParse');
      expect(actionsCode).toContain('managedProfileSchema.safeParse');
      expect(actionsCode).toContain('caller.universityId !== input.university_id');
      expect(actionsCode).toContain('Cannot deactivate your own account');
      expect(actionsCode).toContain('resetManagedUserPassword');
    });

    it('verifies backup & wipe actions strictly require super_admin and tenant isolation', () => {
      const backupActionsCode = readFileSync(resolve(rootDir, 'src/app/(dashboard)/backup/actions.ts'), 'utf-8');
      expect(backupActionsCode).toContain('requireUniversitySuperAdmin(universityId)');
      expect(backupActionsCode).toContain('ALLOWED_BULK_COLLECTIONS');
      expect(backupActionsCode).toContain('generateOneTimePassword()');
      expect(backupActionsCode).toContain('.select(\'id, email, staff_id\')');
      expect(backupActionsCode).toContain('.eq(\'university_id\', universityId)');
      expect(backupActionsCode).not.toContain('export async function restoreAuthUsers');
    });

    it('verifies middleware validates exact Supabase auth cookie patterns', () => {
      const mockReq = (cookies: Record<string, string>) => ({
        cookies: {
          getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
        },
      } as any);

      expect(hasSupabaseAuthCookie(mockReq({ 'sb-demo-auth-token': 'xyz' }))).toBe(true);
      expect(hasSupabaseAuthCookie(mockReq({ 'sb-project-auth-token.0': 'chunk' }))).toBe(true);
      expect(hasSupabaseAuthCookie(mockReq({ 'attacker-auth-token': 'fake' }))).toBe(false);
      expect(hasSupabaseAuthCookie(mockReq({ 'custom-auth-token': 'fake' }))).toBe(false);
      expect(hasSupabaseAuthCookie(mockReq({ 'sb-demo-auth-token': '' }))).toBe(false);

      expect(isProtectedPath('/dashboard')).toBe(true);
      expect(isProtectedPath('/attendance')).toBe(true);
      expect(isProtectedPath('/login')).toBe(false);
      expect(isProtectedPath('/register')).toBe(false);
    });
  });

  describe('2. Supabase RLS & Database Security Migrations (021, 022, 023)', () => {
    it('confirms migration 021 prevents super_admin escalation and activity log forgery', () => {
      const mig021 = readFileSync(resolve(rootDir, 'supabase/migrations/021_rls_escalation_audit_and_scope_fixes.sql'), 'utf-8');
      expect(mig021).toContain('DROP POLICY IF EXISTS "update_university_users" ON public.users;');
      expect(mig021).toContain('CREATE OR REPLACE FUNCTION public.prevent_super_admin_escalation()');
      expect(mig021).toContain('CREATE OR REPLACE FUNCTION public.enforce_activity_log_actor()');
      expect(mig021).toContain('DROP POLICY IF EXISTS "anyone_can_create_university" ON public.universities;');
      expect(mig021).toContain('department_id = public.get_my_department_id()');
    });

    it('confirms migration 022 introduces revision counter for monotonic conflict resolution', () => {
      const mig022 = readFileSync(resolve(rootDir, 'supabase/migrations/022_attendance_session_revision.sql'), 'utf-8');
      expect(mig022).toContain('ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1');
      expect(mig022).toContain('CREATE OR REPLACE FUNCTION public.bump_attendance_revision()');
    });

    it('confirms migration 023 adds unique period constraint for duplicate prevention', () => {
      const mig023 = readFileSync(resolve(rootDir, 'supabase/migrations/023_attendance_period_unique.sql'), 'utf-8');
      expect(mig023).toContain('UNIQUE (subject_id, date, period_number)');
      expect(mig023).toContain('attendance_sessions_subject_date_period_unique');
    });
  });

  describe('3. Sync Engine Robustness, Concurrency & Table Mapping', () => {
    it('maps all 11 synchronized tables to local camelCase structures', () => {
      const tables = [
        'departments',
        'branches',
        'specialisations',
        'sections',
        'users',
        'students',
        'subjects',
        'subject_sections',
        'user_sections',
        'user_subjects',
        'attendance_sessions',
      ];

      for (const table of tables) {
        const dummyRow = { id: `test-${table}`, name: 'Sample' };
        const result = mapRemoteToLocal(table, dummyRow);
        expect(result.id).toBe(`test-${table}`);
      }
    });

    it('throws when mapRemoteToLocal receives an unmapped table name', () => {
      expect(() => mapRemoteToLocal('unknown_table', { id: '123' })).toThrow(
        /mapRemoteToLocal: received a row for unmapped table "unknown_table"/
      );
    });

    it('verifies sync.ts implements lease timeouts, exponential backoff, and dead-lettering', () => {
      const syncCode = readFileSync(resolve(rootDir, 'src/lib/db/sync.ts'), 'utf-8');
      expect(syncCode).toContain('CLAIM_TIMEOUT_MS = 5 * 60 * 1000');
      expect(syncCode).toContain('MAX_RETRIES = 5');
      expect(syncCode).toContain('PULL_PAGE_SIZE = 500');
      expect(syncCode).toContain('Math.min(30_000 * Math.pow(2, Math.max(0, retryCount - 1)), 10 * 60_000)');
      expect(syncCode).toContain('errorCode === \'23505\'');
      expect(syncCode).toContain('remoteRevision > baseRevision');
      expect(syncCode).toContain('reconcileDeletes');
    });
  });

  describe('4. Data Integrity, Timezone Handling & Export Neutralization', () => {
    it('produces reliable local date strings without UTC day rollback', () => {
      const date = new Date(2026, 7, 31, 23, 45, 0); // Local Aug 31, 2026
      const formatted = getLocalDateString(date);
      expect(formatted).toBe('2026-08-31');

      // Robust fallback on invalid date input
      const invalidDate = new Date('invalid-date-string');
      expect(getLocalDateString(invalidDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('neutralizes all dangerous formula injection characters in CSV exports', () => {
      const prefixes = ['=', '+', '-', '@', '\t', '\r'];
      for (const p of prefixes) {
        const value = `${p}SUM(A1:A10)`;
        expect(sanitizeCsvCell(value)).toBe(`'${value}`);
      }

      expect(sanitizeCsvCell('Normal Text')).toBe('Normal Text');
      expect(sanitizeCsvCell(123)).toBe('123');
      expect(sanitizeCsvCell(null)).toBe('');
      expect(sanitizeCsvCell(undefined)).toBe('');

      const rows = [
        { name: '=cmd|/c calc', role: '+admin', notes: '@danger', safe: 'ok' },
      ];
      const sanitized = sanitizeCsvRows(rows);
      expect(sanitized[0].name).toBe('\'=cmd|/c calc');
      expect(sanitized[0].role).toBe('\'+admin');
      expect(sanitized[0].notes).toBe('\'@danger');
      expect(sanitized[0].safe).toBe('ok');
    });
  });

  describe('5. CSV Import Validation & Size Guard', () => {
    it('enforces .csv extension and 5MB size limit', () => {
      const fakeValidFile = new File(['roll_number,full_name\n1,Alice'], 'students.csv', { type: 'text/csv' });
      expect(isAllowedCsvFile(fakeValidFile)).toEqual({ ok: true });

      const fakeXlsxFile = new File(['content'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(isAllowedCsvFile(fakeXlsxFile).ok).toBe(false);

      const oversizedFile = new File([new Uint8Array(MAX_CSV_FILE_BYTES + 1)], 'huge.csv', { type: 'text/csv' });
      expect(isAllowedCsvFile(oversizedFile).ok).toBe(false);
    });

    it('rejects duplicate roll numbers and handles trimmed whitespace in headers and cells', () => {
      const csvWithSpaces = '  roll_number  ,  full_name  \n  CS101  ,  John Doe  \n  CS102  ,  Jane Smith  ';
      const result = parseStudentsCsv(csvWithSpaces);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.students).toEqual([
          { rollNumber: 'CS101', fullName: 'John Doe' },
          { rollNumber: 'CS102', fullName: 'Jane Smith' },
        ]);
        expect(result.skippedCount).toBe(0);
      }

      const csvWithDupes = 'roll_number,full_name\nCS101,John\nCS101,Jane';
      const dupeResult = parseStudentsCsv(csvWithDupes);
      expect(dupeResult.ok).toBe(false);
      if (!dupeResult.ok) {
        expect(dupeResult.error).toContain('Duplicate roll numbers in the file: CS101');
      }
    });
  });

  describe('6. Input Validation & Zod Schema Constraints', () => {
    it('validates studentSchema trim and string length constraints', () => {
      expect(studentSchema.safeParse({ rollNumber: 'CS-01', fullName: 'Alice' }).success).toBe(true);
      expect(studentSchema.safeParse({ rollNumber: '   ', fullName: 'Alice' }).success).toBe(false);
      expect(studentSchema.safeParse({ rollNumber: 'CS-01', fullName: '   ' }).success).toBe(false);
      expect(studentSchema.safeParse({ rollNumber: 'a'.repeat(51), fullName: 'Alice' }).success).toBe(false);
      expect(studentSchema.safeParse({ rollNumber: 'CS-01', fullName: 'a'.repeat(101) }).success).toBe(false);
    });

    it('validates managedAuthUserSchema and managedProfileSchema constraints', () => {
      expect(managedAuthUserSchema.safeParse({ email: 'user@test.edu', password: 'ValidPassword123' }).success).toBe(true);
      expect(managedAuthUserSchema.safeParse({ email: 'invalid-email', password: 'ValidPassword123' }).success).toBe(false);
      expect(managedAuthUserSchema.safeParse({ email: 'user@test.edu', password: 'short' }).success).toBe(false);

      expect(managedProfileSchema.safeParse({ full_name: 'Prof. Smith', staff_id: 'ST-101', email: 'smith@test.edu' }).success).toBe(true);
      expect(managedProfileSchema.safeParse({ full_name: '  ', staff_id: 'ST-101', email: 'smith@test.edu' }).success).toBe(false);
    });

    it('validates register, login, and changePassword schemas', () => {
      expect(registerSchema.safeParse({
        fullName: 'Admin User',
        staffId: 'ADMIN-01',
        email: 'admin@uni.edu',
        password: 'Password123!',
        universityName: 'Apex University',
        universityCode: 'APEX-01',
      }).success).toBe(true);

      expect(loginSchema.safeParse({ email: 'admin@uni.edu', password: 'Password123!' }).success).toBe(true);
      expect(changePasswordSchema.safeParse({ newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' }).success).toBe(true);
      expect(changePasswordSchema.safeParse({ newPassword: 'NewPassword123!', confirmPassword: 'MismatchedPassword' }).success).toBe(false);
    });
  });

  describe('7. Ops, Tooling, CI Configuration & Dependency Hygiene', () => {
    it('verifies unused heavy dependencies remain removed from package.json', () => {
      const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'));
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      expect(allDeps['xlsx']).toBeUndefined();
      expect(allDeps['@google/generative-ai']).toBeUndefined();
      expect(allDeps['shadcn']).toBeUndefined();
    });

    it('verifies CI workflow configuration exists with pinned action versions and quality gates', () => {
      const ciPath = resolve(rootDir, '.github/workflows/ci.yml');
      expect(existsSync(ciPath)).toBe(true);
      const ciContent = readFileSync(ciPath, 'utf-8');
      expect(ciContent).toContain('actions/checkout@v4');
      expect(ciContent).toContain('pnpm/action-setup@v4');
      expect(ciContent).toContain('actions/setup-node@v4');
      expect(ciContent).toContain('pnpm audit --audit-level=critical');
      expect(ciContent).toContain('pnpm run lint');
      expect(ciContent).toContain('pnpm run typecheck');
      expect(ciContent).toContain('pnpm run test');
      expect(ciContent).toContain('pnpm run build');
    });

    it('verifies tsconfig has strict casing enabled and eslint config has no-unused-vars as error', () => {
      const tsconfig = JSON.parse(readFileSync(resolve(rootDir, 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions.forceConsistentCasingInFileNames).toBe(true);

      const eslint = JSON.parse(readFileSync(resolve(rootDir, '.eslintrc.json'), 'utf-8'));
      const unusedRule = eslint.rules['@typescript-eslint/no-unused-vars'];
      const severity = Array.isArray(unusedRule) ? unusedRule[0] : unusedRule;
      expect(severity).toBe('error');
    });
  });
});
