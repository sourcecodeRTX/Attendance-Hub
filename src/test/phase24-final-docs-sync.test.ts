import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 24: Final Docs and README Synchronization Invariants', () => {
  const rootDir = process.cwd();
  const readmePath = resolve(rootDir, 'README.md');
  const licensePath = resolve(rootDir, 'LICENSE');
  const protocolPath = resolve(rootDir, 'ATTENDANCE_HUB_PARANOID_FIX_PROTOCOL.md');
  const fixLogPath = resolve(rootDir, 'ATTENDANCE_HUB_FIX_LOG.md');
  const auditPath = resolve(rootDir, 'ATTENDANCE_HUB_AUDIT_FINDINGS.md');

  it('verifies all essential documentation files exist in repo root', () => {
    expect(existsSync(readmePath)).toBe(true);
    expect(existsSync(licensePath)).toBe(true);
    expect(existsSync(protocolPath)).toBe(true);
    expect(existsSync(fixLogPath)).toBe(true);
    expect(existsSync(auditPath)).toBe(true);
  });

  it('verifies README.md contains accurate branding and project identity', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('Attendance Hub');
    expect(content).not.toContain('ATT Tracker');
    expect(content).toContain('MIT License');
  });

  it('verifies README.md does not contain removed or deprecated dependencies', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).not.toContain('SheetJS');
    expect(content).not.toContain('xlsx');
    expect(content).not.toContain('@google/generative-ai');
    expect(content).not.toContain('AI-powered');
    expect(content).not.toContain('predictions');
    expect(content).not.toContain('Shadcn UI');
  });

  it('verifies README.md accurately documents all active tech stack technologies and libraries', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('Next.js 14');
    expect(content).toContain('React 18');
    expect(content).toContain('TypeScript');
    expect(content).toContain('Tailwind CSS');
    expect(content).toContain('Supabase');
    expect(content).toContain('Zustand');
    expect(content).toContain('Dexie.js');
    expect(content).toContain('Base UI');
    expect(content).toContain('React Hook Form');
    expect(content).toContain('Zod');
    expect(content).toContain('Papaparse');
    expect(content).toContain('@react-pdf/renderer');
    expect(content).toContain('JSZip');
    expect(content).toContain('Vitest');
  });

  it('verifies README.md accurately documents all required and optional environment variables', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(content).toContain('NEXT_PUBLIC_APP_URL');
    expect(content).toContain('never'); // server-only never client exposed
  });

  it('verifies README.md documents all 5 user roles and access control model', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('Super Admin');
    expect(content).toContain('Department Admin');
    expect(content).toContain('Primary Teacher');
    expect(content).toContain('Regular Teacher');
    expect(content).toContain('Course Representative');
  });

  it('verifies README.md documents database migrations and setup (001 through 023)', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('supabase/migrations');
    expect(content).toContain('001_initial_schema.sql');
    expect(content).toContain('023_attendance_period_unique.sql');
  });

  it('verifies README.md documents test scripts, quality gates and CI workflow', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('pnpm test');
    expect(content).toContain('pnpm run lint');
    expect(content).toContain('pnpm run typecheck');
    expect(content).toContain('pnpm run build');
    expect(content).toContain('.github/workflows/ci.yml');
  });

  it('verifies LICENSE file contains valid MIT copyright statement', () => {
    const content = readFileSync(licensePath, 'utf-8');
    expect(content).toContain('MIT License');
    expect(content).toContain('Attendance Hub Contributors');
  });
});
