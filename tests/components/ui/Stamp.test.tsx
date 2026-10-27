import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stamp, stampRotation } from '@/src/components/ui/Stamp';

describe('Stamp', () => {
  it('is a status element with its text', () => {
    render(
      <Stamp variant="cleared" id="p1" announce>
        PAID
      </Stamp>,
    );
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('PAID');
    expect(el).toHaveAttribute('data-variant', 'cleared');
    expect(el.className).toContain('stamp-cleared');
  });

  it('is a plain span, not a live region, by default', () => {
    const { container } = render(<Stamp id="p2">PAID</Stamp>);
    expect(screen.queryByRole('status')).toBeNull();
    const el = container.firstElementChild as HTMLElement;
    expect(el).not.toHaveAttribute('role');
    expect(el).not.toHaveAttribute('aria-live');
    expect(el).toHaveTextContent('PAID');
  });

  it('announce adds role=status and aria-live=polite', () => {
    render(<Stamp announce>LOGGED</Stamp>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('derives a stable rotation between -4 and +3 degrees from the id', () => {
    expect(stampRotation('shift-1')).toBe(stampRotation('shift-1'));
    for (const id of ['a', 'shift-22', 'hazard-9', 'x'.repeat(40), '']) {
      const r = stampRotation(id);
      expect(r).toBeGreaterThanOrEqual(-4);
      expect(r).toBeLessThanOrEqual(3);
    }
    expect(stampRotation('a')).not.toBe(stampRotation('hazard-9'));
  });

  it('applies the rotation as a CSS variable and the landing animation class', () => {
    render(
      <Stamp id="abc" announce>
        CHECKED IN 08:02
      </Stamp>,
    );
    const el = screen.getByRole('status');
    expect(el.style.getPropertyValue('--stamp-rotation')).toBe(
      `${stampRotation('abc').toFixed(1)}deg`,
    );
    expect(el.className).toContain('stamp-animate');
  });

  it('can skip the animation and show a sub line', () => {
    render(
      <Stamp animate={false} announce sub="Anonymous">
        RECEIVED
      </Stamp>,
    );
    const el = screen.getByRole('status');
    expect(el.className).not.toContain('stamp-animate');
    expect(el).toHaveTextContent('Anonymous');
  });
});
