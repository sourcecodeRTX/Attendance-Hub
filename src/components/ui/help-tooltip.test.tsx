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

describe('HELP_TOOLTIPS text consistency', () => {
  it('correctly describes section creation workflow (selecting branch, then specialisation)', async () => {
    const { HELP_TOOLTIPS } = await import('./help-tooltip');
    expect(HELP_TOOLTIPS.sectionCreate).toBe(
      'Create a new section by entering a name, selecting a branch, and optionally choosing a specialisation within that branch.'
    );
    expect(HELP_TOOLTIPS.sectionCreate).not.toContain('automatically determined from the specialisation');
  });

  it('correctly defines administrative role responsibilities', async () => {
    const { HELP_TOOLTIPS } = await import('./help-tooltip');
    expect(HELP_TOOLTIPS.superAdmin).toContain('Super Admin');
    expect(HELP_TOOLTIPS.admin).toContain('Department Admin');
    expect(HELP_TOOLTIPS.primaryTeacher).toContain('Primary Teacher');
    expect(HELP_TOOLTIPS.regularTeacher).toContain('Regular Teacher');
  });
});

