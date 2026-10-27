import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/src/components/ui/Button';

describe('Button', () => {
  it('renders a full-width 56 px primary button by default', () => {
    render(<Button>Hear my payslip</Button>);
    const b = screen.getByRole('button', { name: 'Hear my payslip' });
    expect(b).toHaveAttribute('type', 'button');
    expect(b.className).toContain('w-full');
    expect(b.className).toContain('min-h-14');
    expect(b.className).toContain('bg-ink');
  });

  it('danger uses hi-vis with a graphite outline and graphite text', () => {
    render(<Button variant="danger">Send danger report</Button>);
    const b = screen.getByRole('button');
    expect(b.className).toContain('bg-hivis');
    expect(b.className).toContain('border-graphite');
    expect(b.className).toContain('text-graphite');
    expect(b.className).not.toContain('text-white');
  });

  it('secondary is at least 48 px tall', () => {
    render(<Button variant="secondary">Use GPS</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-12');
  });

  it('fires onClick and respects disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
