import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(process.cwd(), 'src', 'app', 'globals.css');
const css = readFileSync(cssPath, 'utf8');

function getReducedMotionBlock(): string | null {
  const match = css.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/,
  );
  return match ? match[0] : null;
}

describe('prefers-reduced-motion support (globals.css)', () => {
  it('declares a prefers-reduced-motion: reduce block', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('collapses animation durations and repetition inside that block', () => {
    const block = getReducedMotionBlock();
    expect(block).not.toBeNull();
    expect(block!).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block!).toMatch(/animation-iteration-count:\s*1/);
  });

  it('collapses transition durations inside that block', () => {
    const block = getReducedMotionBlock();
    expect(block).not.toBeNull();
    expect(block!).toMatch(/transition-duration:\s*0\.01ms/);
  });

  it('disables smooth scrolling for reduced motion', () => {
    const block = getReducedMotionBlock();
    expect(block).not.toBeNull();
    expect(block!).toMatch(/scroll-behavior:\s*auto/);
  });
});
