import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogRetentionWarning, isSaturday } from '@/components/shared/LogRetentionWarning';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LogRetentionWarning (Phase 19 UX Polish)', () => {
  it('identifies Saturday correctly with isSaturday helper', () => {
    // 2026-08-29 was a Saturday (getDay() === 6)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T10:00:00Z'));
    expect(isSaturday()).toBe(true);

    // 2026-08-30 was a Sunday (getDay() === 0)
    vi.setSystemTime(new Date('2026-08-30T10:00:00Z'));
    expect(isSaturday()).toBe(false);

    // 2026-08-31 was a Monday (getDay() === 1)
    vi.setSystemTime(new Date('2026-08-31T10:00:00Z'));
    expect(isSaturday()).toBe(false);
  });

  it('renders the retention alert with download buttons and triggers callbacks', async () => {
    const user = userEvent.setup();
    const onDownloadCSV = vi.fn();
    const onDownloadJSON = vi.fn();

    render(
      <LogRetentionWarning
        onDownloadCSV={onDownloadCSV}
        onDownloadJSON={onDownloadJSON}
        isDownloading={false}
      />
    );

    expect(screen.getByText(/Weekly Log Cleanup Scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/automatically deleted tomorrow evening/i)).toBeInTheDocument();

    const csvButton = screen.getByRole('button', { name: /Download CSV/i });
    const jsonButton = screen.getByRole('button', { name: /Download JSON/i });

    expect(csvButton).toBeEnabled();
    expect(jsonButton).toBeEnabled();

    await user.click(csvButton);
    expect(onDownloadCSV).toHaveBeenCalledTimes(1);

    await user.click(jsonButton);
    expect(onDownloadJSON).toHaveBeenCalledTimes(1);
  });

  it('disables download buttons while isDownloading is true', () => {
    render(
      <LogRetentionWarning
        onDownloadCSV={vi.fn()}
        onDownloadJSON={vi.fn()}
        isDownloading={true}
      />
    );

    expect(screen.getByRole('button', { name: /Download CSV/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Download JSON/i })).toBeDisabled();
  });
});
