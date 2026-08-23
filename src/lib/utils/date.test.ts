import { describe, expect, it } from 'vitest';
import { getLocalDateString } from '@/lib/utils/date';

describe('getLocalDateString (F-011)', () => {
  it('formats a local date with zero-padded month and day', () => {
    // Constructed via local-time components — no UTC conversion anywhere.
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('handles year-end and double-digit months/days', () => {
    expect(getLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(getLocalDateString(new Date(2026, 9, 17))).toBe('2026-10-17');
  });

  it('matches the device-local calendar date, not the UTC one', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(getLocalDateString()).toBe(expected);
  });
});
