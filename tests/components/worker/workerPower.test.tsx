import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/w/actions', () => ({ hazardVerdictAction: vi.fn() }));

import { I18nProvider } from '@/src/i18n/client';
import { en } from '@/src/i18n/en';
import { hi } from '@/src/i18n/hi';
import { ConfirmFix } from '@/src/components/worker/ConfirmFix';
import { PaidCheck } from '@/src/components/worker/PaidCheck';
import { HeatCard } from '@/src/components/worker/HeatCard';
import { HeatBanner } from '@/src/components/admin/HeatBanner';
import { hazardVerdictAction } from '@/app/w/actions';

function renderIn(ui: React.ReactElement, locale: 'en' | 'hi' = 'en') {
  return render(
    <I18nProvider locale={locale} messages={locale === 'en' ? en : hi}>
      {ui}
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.mocked(hazardVerdictAction).mockReset();
  refresh.mockReset();
});

describe('PaidCheck', () => {
  function check(amount: string) {
    fireEvent.change(screen.getByLabelText(/money you got in hand/i), {
      target: { value: amount },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check my pay' }));
  }

  it('says how much less the worker got and points to their rights', () => {
    renderIn(<PaidCheck net={8755} />);
    check('8,000');
    expect(screen.getByText(/You got 755 rupees less/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See your pay rights' })).toHaveAttribute(
      'href',
      '/w/rights',
    );
    // The amount goes to the employer only if the worker follows this link.
    expect(screen.getByRole('link', { name: 'Ask your employer about this' })).toHaveAttribute(
      'href',
      '/w/pay/query?reason=short_pay&received=8000',
    );
  });

  it('confirms a match without the rights link', () => {
    renderIn(<PaidCheck net={8755} />);
    check('8755');
    expect(screen.getByText(/This matches your payslip: 8,755 rupees/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('asks for numbers when the amount cannot be read', () => {
    renderIn(<PaidCheck net={8755} />);
    check('lots');
    expect(screen.getByRole('alert')).toHaveTextContent('Type the amount in numbers');
    expect(screen.getByLabelText(/money you got in hand/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts Devanagari digits in Hindi', () => {
    renderIn(<PaidCheck net={8755} />, 'hi');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '८७५५' } });
    fireEvent.click(screen.getByRole('button', { name: hi['pay.check.button'] }));
    expect(screen.getByText(/मेल खाता है/)).toBeInTheDocument();
  });
});

describe('ConfirmFix', () => {
  it('sends "fixed" and thanks the worker', async () => {
    vi.mocked(hazardVerdictAction).mockResolvedValue({ ok: true, reopened: false });
    renderIn(<ConfirmFix hazardId="hazard-5" />);
    expect(screen.getByRole('heading', { name: /Is it really fixed/ })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, it is fixed' }));
    });
    expect(hazardVerdictAction).toHaveBeenCalledWith('hazard-5', 'fixed');
    expect(screen.getByRole('status')).toHaveTextContent('The report is now closed');
    expect(refresh).toHaveBeenCalled();
  });

  it('reopens on "not fixed"', async () => {
    vi.mocked(hazardVerdictAction).mockResolvedValue({ ok: true, reopened: true });
    renderIn(<ConfirmFix hazardId="hazard-5" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'No, it is still dangerous' }));
    });
    expect(hazardVerdictAction).toHaveBeenCalledWith('hazard-5', 'not_fixed');
    expect(screen.getByRole('status')).toHaveTextContent('gone to the manager');
  });

  it('keeps the buttons and shows an error when saving fails', async () => {
    vi.mocked(hazardVerdictAction).mockResolvedValue({
      ok: false,
      code: 'rate_limited',
      permanent: false,
      retryable: true,
      reason: 'Too many attempts',
    });
    renderIn(<ConfirmFix hazardId="hazard-5" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, it is fixed' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save your answer');
    expect(screen.getByRole('button', { name: 'Yes, it is fixed' })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('heat warnings', () => {
  const danger = { temperatureC: 34, humidityPct: 70, heatIndexC: 41.6, level: 'danger' as const };

  it('the worker card speaks the worker language and stays hidden when it is not hot', () => {
    const { rerender } = renderIn(<HeatCard heat={danger} locale="hi" />, 'hi');
    expect(screen.getByRole('heading', { name: hi['heat.title.danger'] })).toBeInTheDocument();
    expect(screen.getByText(/42°C/)).toBeInTheDocument();
    rerender(<HeatCard heat={{ ...danger, level: 'none' }} locale="hi" />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('the console banner tells the site lead what to change', () => {
    renderIn(<HeatBanner heat={danger} place="Skyline Towers" />);
    expect(
      screen.getByRole('heading', { name: 'Heat at Skyline Towers: Danger' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 noon to 3 pm/)).toBeInTheDocument();
    const { container } = renderIn(<HeatBanner heat={null} place="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
