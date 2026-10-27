import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallButton } from '@/src/components/pwa/InstallButton';

function mockStandalone(standalone: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: standalone,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

describe('InstallButton', () => {
  beforeEach(() => mockStandalone(false));

  it('renders nothing until the browser offers an install prompt', () => {
    const { container } = render(<InstallButton label="Add to home screen" iosHint="hint" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the button after beforeinstallprompt and opens the prompt on click', async () => {
    render(<InstallButton label="Add to home screen" iosHint="hint" />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    const button = screen.getByRole('button', { name: 'Add to home screen' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('stays hidden when the app is already installed', () => {
    mockStandalone(true);
    const { container } = render(<InstallButton label="Add to home screen" iosHint="hint" />);
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    expect(container).toBeEmptyDOMElement();
  });
});
