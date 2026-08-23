import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HelpTooltip } from '@/components/ui/help-tooltip';

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('HelpTooltip keyboard access (a11y)', () => {
  it('reveals the tooltip content when the trigger receives keyboard focus and hides on blur', async () => {
    const user = userEvent.setup();
    render(<HelpTooltip content="Primary Teacher definition" />);

    const trigger = screen.getByRole('button', { name: 'Help' });
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Primary Teacher definition'
    );
    expect(trigger).toHaveAttribute('aria-describedby');

    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes the tooltip with Escape while focus stays on the trigger', async () => {
    const user = userEvent.setup();
    render(<HelpTooltip content="CR definition" />);

    const trigger = screen.getByRole('button', { name: 'Help' });
    await user.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('associates each trigger with its own tooltip content id when focused in sequence', async () => {
    const user = userEvent.setup();
    render(
      <>
        <HelpTooltip content="First help" />
        <HelpTooltip content="Second help" />
      </>
    );

    const triggers = screen.getAllByRole('button', { name: 'Help' });

    await user.tab();
    let tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('First help');
    const firstId = tooltip.id;
    expect(triggers[0].getAttribute('aria-describedby')).toBe(firstId);

    await user.tab();
    tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Second help');
    const secondId = tooltip.id;
    expect(triggers[1].getAttribute('aria-describedby')).toBe(secondId);
    expect(secondId).not.toBe(firstId);
  });
});
