import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 25 — Closing Report & Effort Invariants', () => {
  const rootDir = process.cwd();
  const fixLogPath = path.join(rootDir, 'ATTENDANCE_HUB_FIX_LOG.md');
  const auditFindingsPath = path.join(rootDir, 'ATTENDANCE_HUB_AUDIT_FINDINGS.md');
  const protocolPath = path.join(rootDir, 'ATTENDANCE_HUB_PARANOID_FIX_PROTOCOL.md');
  const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
  const packageJsonPath = path.join(rootDir, 'package.json');

  it('verifies all 3 core effort governance files exist', () => {
    expect(fs.existsSync(fixLogPath)).toBe(true);
    expect(fs.existsSync(auditFindingsPath)).toBe(true);
    expect(fs.existsSync(protocolPath)).toBe(true);
  });

  it('verifies all 31 findings (F-001 through F-031) are present in the audit and addressed in the fix log', () => {
    const auditContent = fs.readFileSync(auditFindingsPath, 'utf8');
    const fixLogContent = fs.readFileSync(fixLogPath, 'utf8');

    for (let i = 1; i <= 31; i++) {
      const findingId = `F-${String(i).padStart(3, '0')}`;
      expect(auditContent).toContain(findingId);
      expect(fixLogContent).toContain(findingId);
    }
  });

  it('verifies all 26 phases (Phase 0 to Phase 25) are tracked in the Progress Tracker', () => {
    const fixLogContent = fs.readFileSync(fixLogPath, 'utf8');
    for (let phase = 0; phase <= 25; phase++) {
      const phaseRowPattern = new RegExp(`\\|\\s*${phase}\\s*\\|`);
      expect(phaseRowPattern.test(fixLogContent)).toBe(true);
    }
  });

  it('verifies all 23 database migrations exist in sequential order', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    expect(files.length).toBe(23);

    for (let i = 1; i <= 23; i++) {
      const prefix = String(i).padStart(3, '0');
      const hasMigration = files.some(f => f.startsWith(prefix));
      expect(hasMigration).toBe(true);
    }
  });

  it('verifies continuous integration pipeline exists and runs all quality gates', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('pnpm audit');
    expect(workflow).toContain('pnpm run lint');
    expect(workflow).toContain('pnpm run typecheck');
    expect(workflow).toContain('pnpm run test');
    expect(workflow).toContain('pnpm run build');
  });

  it('verifies heavy unused dependencies remain purged', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    expect(allDeps['xlsx']).toBeUndefined();
    expect(allDeps['@google/generative-ai']).toBeUndefined();
    expect(allDeps['shadcn']).toBeUndefined();
  });
});
