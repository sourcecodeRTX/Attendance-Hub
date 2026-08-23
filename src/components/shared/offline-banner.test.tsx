import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from '@/components/shared/offline-banner';
import { useUIStore } from '@/lib/stores/ui-store';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

afterEach(() => {
  cleanup();
  useUIStore.setState({ isOffline: false });
  // restore jsdom default
  Object.defineProperty(window.navigator, 'onLine', {
    value: true,
    configurable: true,
  });
});

describe('OfflineBanner live-region semantics', () => {
  it('renders nothing while online', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    useUIStore.setState({ isOffline: false });
    render(<OfflineBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('exposes the offline notice as a status live region when offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    useUIStore.setState({ isOffline: true });
    render(<OfflineBanner />);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('You are offline');
  });
});
