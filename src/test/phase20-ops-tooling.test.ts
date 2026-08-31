import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 20: Ops and Tooling Invariants', () => {
  const rootDir = process.cwd();

  it('verifies package.json does not contain unused heavy or cli dependencies in dependencies', () => {
    const pkgJsonPath = resolve(rootDir, 'package.json');
    expect(existsSync(pkgJsonPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};

    // F-028: unused heavy dependencies removed
    expect(deps['xlsx']).toBeUndefined();
    expect(deps['@google/generative-ai']).toBeUndefined();
    expect(deps['shadcn']).toBeUndefined();
    expect(devDeps['xlsx']).toBeUndefined();
    expect(devDeps['@google/generative-ai']).toBeUndefined();
  });

  it('verifies package.json includes standard lifecycle scripts including typecheck', () => {
    const pkgJsonPath = resolve(rootDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    expect(scripts['dev']).toBeDefined();
    expect(scripts['build']).toBeDefined();
    expect(scripts['start']).toBeDefined();
    expect(scripts['lint']).toBeDefined();
    expect(scripts['typecheck']).toBe('tsc --noEmit');
    expect(scripts['test']).toBe('vitest run');
  });

  it('verifies tsconfig.json strictness and casing configuration', () => {
    const tsconfigPath = resolve(rootDir, 'tsconfig.json');
    expect(existsSync(tsconfigPath)).toBe(true);
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
    const compilerOptions = tsconfig.compilerOptions || {};

    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.forceConsistentCasingInFileNames).toBe(true);
    expect(compilerOptions.noEmit).toBe(true);
  });

  it('verifies .eslintrc.json configures no-unused-vars as error', () => {
    const eslintrcPath = resolve(rootDir, '.eslintrc.json');
    expect(existsSync(eslintrcPath)).toBe(true);
    const eslintrc = JSON.parse(readFileSync(eslintrcPath, 'utf-8'));
    const rules = eslintrc.rules || {};

    expect(rules['@typescript-eslint/no-unused-vars']).toBeDefined();
    expect(rules['@typescript-eslint/no-unused-vars'][0]).toBe('error');
  });
});
