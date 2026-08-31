import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 21: CI Foundation Invariants', () => {
  const rootDir = process.cwd();
  const ciWorkflowPath = resolve(rootDir, '.github', 'workflows', 'ci.yml');

  it('verifies .github/workflows/ci.yml exists', () => {
    expect(existsSync(ciWorkflowPath)).toBe(true);
  });

  it('verifies CI workflow triggers on push and pull_request to main', () => {
    const content = readFileSync(ciWorkflowPath, 'utf-8');

    // Trigger on push to main
    expect(content).toMatch(/push:\s*\n\s*branches:\s*\n\s*-\s*main/);

    // Trigger on pull_request to main
    expect(content).toMatch(/pull_request:\s*\n\s*branches:\s*\n\s*-\s*main/);

    // Support workflow_dispatch for manual runs
    expect(content).toMatch(/workflow_dispatch:/);
  });

  it('verifies CI workflow concurrency and read-only permissions', () => {
    const content = readFileSync(ciWorkflowPath, 'utf-8');

    expect(content).toContain('concurrency:');
    expect(content).toContain('cancel-in-progress: ${{ github.event_name == \'pull_request\' }}');
    expect(content).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });

  it('verifies pinned actions and runtime configurations (Node.js 20, pnpm 10)', () => {
    const content = readFileSync(ciWorkflowPath, 'utf-8');

    // Pinned actions
    expect(content).toContain('uses: actions/checkout@v4');
    expect(content).toContain('uses: pnpm/action-setup@v4');
    expect(content).toContain('uses: actions/setup-node@v4');

    // Runtime setup
    expect(content).toMatch(/version:\s*10/);
    expect(content).toMatch(/node-version:\s*20/);
    expect(content).toMatch(/cache:\s*['"]pnpm['"]/);
  });

  it('verifies required verification pipeline gates are executed in order', () => {
    const content = readFileSync(ciWorkflowPath, 'utf-8');

    // Deterministic frozen-lockfile installation
    expect(content).toContain('pnpm install --frozen-lockfile');

    // Dependency audit gate
    expect(content).toMatch(/pnpm audit\s+--audit-level=critical/);

    // Full verification gates
    expect(content).toContain('pnpm run lint');
    expect(content).toContain('pnpm run typecheck');
    expect(content).toContain('pnpm run test');
    expect(content).toContain('pnpm run build');

    // Verification gate order check
    const installIndex = content.indexOf('pnpm install --frozen-lockfile');
    const auditIndex = content.indexOf('pnpm audit');
    const lintIndex = content.indexOf('pnpm run lint');
    const typecheckIndex = content.indexOf('pnpm run typecheck');
    const testIndex = content.indexOf('pnpm run test');
    const buildIndex = content.indexOf('pnpm run build');

    expect(installIndex).toBeGreaterThan(-1);
    expect(auditIndex).toBeGreaterThan(installIndex);
    expect(lintIndex).toBeGreaterThan(auditIndex);
    expect(typecheckIndex).toBeGreaterThan(lintIndex);
    expect(testIndex).toBeGreaterThan(typecheckIndex);
    expect(buildIndex).toBeGreaterThan(testIndex);
  });

  it('verifies build environment variables are defined for headless CI compilation', () => {
    const content = readFileSync(ciWorkflowPath, 'utf-8');

    expect(content).toContain('NEXT_PUBLIC_SUPABASE_URL:');
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY:');
    expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY:');
    expect(content).toContain('NEXT_PUBLIC_APP_URL:');
  });
});
