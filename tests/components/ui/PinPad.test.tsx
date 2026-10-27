import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PinPad } from '@/src/components/ui/PinPad';

function Harness({
  length = 4,
  masked = false,
  onSubmit,
}: {
  length?: number;
  masked?: boolean;
  onSubmit?: () => void;
}) {
  const [v, setV] = useState('');
  return <PinPad value={v} onChange={setV} length={length} masked={masked} onSubmit={onSubmit} />;
}

describe('PinPad', () => {
  it('has a 3x4 grid: ten digits, delete and a confirm key', () => {
    render(<Harness onSubmit={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(12);
  });

  it('types digits with the on-screen keys and deletes', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Key 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key 2' }));
    expect(screen.getByTestId('pin-display')).toHaveAccessibleName('2 of 4 digits entered');
    fireEvent.click(screen.getByRole('button', { name: 'Delete last digit' }));
    expect(screen.getByTestId('pin-display')).toHaveAccessibleName('1 of 4 digits entered');
  });

  it('accepts physical keys and stops at the length', () => {
    render(<Harness length={4} />);
    for (const k of ['1', '2', '3', '4', '5']) fireEvent.keyDown(window, { key: k });
    expect(screen.getByTestId('pin-display')).toHaveAccessibleName('4 of 4 digits entered');
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(screen.getByTestId('pin-display')).toHaveAccessibleName('3 of 4 digits entered');
  });

  it('masks PIN digits but shows phone digits', () => {
    const { unmount } = render(<Harness masked />);
    fireEvent.keyDown(window, { key: '7' });
    expect(screen.getByTestId('pin-display')).toHaveTextContent('●');
    expect(screen.getByTestId('pin-display')).not.toHaveTextContent('7');
    unmount();
    render(<Harness length={10} />);
    fireEvent.keyDown(window, { key: '7' });
    expect(screen.getByTestId('pin-display')).toHaveTextContent('7');
  });

  it('enables confirm only when full and calls onSubmit', () => {
    const onSubmit = vi.fn();
    render(<Harness length={2} onSubmit={onSubmit} />);
    const ok = screen.getByRole('button', { name: 'Next' });
    expect(ok).toBeDisabled();
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    expect(ok).toBeEnabled();
    fireEvent.click(ok);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('ignores keys typed into inputs', () => {
    render(
      <>
        <input aria-label="note" />
        <Harness />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText('note'), { key: '5' });
    expect(screen.getByTestId('pin-display')).toHaveAccessibleName('0 of 4 digits entered');
  });
});
