import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button (component smoke test under jsdom)', () => {
  it('renders its children', () => {
    render(<Button>Save attendance</Button>);
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeInTheDocument();
  });

  it('fires the onClick handler when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Mark present</Button>);
    await user.click(screen.getByRole('button', { name: 'Mark present' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire clicks when the disabled prop is set', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Locked
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Locked' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
