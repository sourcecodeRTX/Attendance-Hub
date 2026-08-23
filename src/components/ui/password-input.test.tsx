import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordInput } from '@/components/ui/password-input';

afterEach(cleanup);

function getPasswordInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('#pwd');
  if (!input) throw new Error('password input not found');
  return input as HTMLInputElement;
}

describe('PasswordInput visibility toggle (a11y)', () => {
  it('keeps the show/hide toggle in the tab order and keyboard-operable', async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordInput id="pwd" />);
    expect(getPasswordInput(container)).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle.getAttribute('tabindex')).not.toBe('-1');

    await user.tab();
    expect(getPasswordInput(container)).toHaveFocus();
    await user.tab();
    expect(toggle).toHaveFocus();
  });

  it('toggles input type between password and text on click and updates its label', async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordInput id="pwd" defaultValue="s3cret!" />);

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(getPasswordInput(container)).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(getPasswordInput(container)).toHaveAttribute('type', 'password');
    expect(
      screen.getByRole('button', { name: 'Show password' })
    ).toBeInTheDocument();
  });

  it('toggles via keyboard activation (Enter/Space) once tabbable', async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordInput id="pwd" />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(getPasswordInput(container)).toHaveAttribute('type', 'text');
    await user.keyboard(' ');
    expect(getPasswordInput(container)).toHaveAttribute('type', 'password');
  });
});
