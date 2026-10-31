import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/app/w/actions', () => ({
  raisePayQueryAction: vi.fn(),
  payQueryVerdictAction: vi.fn(),
}));

import { I18nProvider } from '@/src/i18n/client';
import { en } from '@/src/i18n/en';
import { ta } from '@/src/i18n/ta';
import { PayQueryForm } from '@/src/components/worker/PayQueryForm';
import { PayVerdict } from '@/src/components/worker/PayVerdict';
import { payQueryVerdictAction, raisePayQueryAction } from '@/app/w/actions';

function renderIn(ui: React.ReactElement, locale: 'en' | 'ta' = 'en') {
  return render(
    <I18nProvider locale={locale} messages={locale === 'en' ? en : ta}>
      {ui}
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.mocked(raisePayQueryAction).mockReset();
  vi.mocked(payQueryVerdictAction).mockReset();
  push.mockReset();
  refresh.mockReset();
});

describe('PayQueryForm', () => {
  it('starts from the pay check’s amount and sends the chosen reason', async () => {
    vi.mocked(raisePayQueryAction).mockResolvedValue({ ok: true, id: 'payq-9', already: false });
    renderIn(<PayQueryForm initialReason="short_pay" initialReceived="8000" />);
    expect(screen.getByRole('radio', { name: 'I got less money' })).toBeChecked();
    expect(screen.getByLabelText(/Money you got in hand/)).toHaveValue('8000');

    fireEvent.click(screen.getByRole('radio', { name: 'Overtime not paid' }));
    fireEvent.change(screen.getByLabelText(/Anything else/), {
      target: { value: '  Sunday work missing  ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send to employer' }));
    });
    expect(raisePayQueryAction).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'unpaid_overtime',
        receivedAmount: 8000,
        note: 'Sunday work missing',
        clientId: expect.any(String),
      }),
    );
    expect(push).toHaveBeenCalledWith('/w/pay/query/payq-9');
  });

  it('sends without an amount, but not with an unreadable one', async () => {
    vi.mocked(raisePayQueryAction).mockResolvedValue({ ok: true, id: 'payq-1', already: true });
    renderIn(<PayQueryForm initialReason="late_pay" initialReceived="" />);
    fireEvent.change(screen.getByLabelText(/Money you got in hand/), { target: { value: 'lots' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to employer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Type the amount in numbers');
    expect(raisePayQueryAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Money you got in hand/), { target: { value: '' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send to employer' }));
    });
    expect(raisePayQueryAction).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'late_pay', receivedAmount: null, note: null }),
    );
  });

  it('says so when sending fails', async () => {
    vi.mocked(raisePayQueryAction).mockResolvedValue({
      ok: false,
      code: 'rate_limited',
      reason: 'slow down',
      permanent: false,
      retryable: true,
    });
    renderIn(<PayQueryForm initialReason="short_pay" initialReceived="" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send to employer' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not send');
    expect(push).not.toHaveBeenCalled();
  });

  it('speaks Tamil', () => {
    renderIn(<PayQueryForm initialReason="short_pay" initialReceived="" />, 'ta');
    expect(screen.getByRole('button', { name: ta['payq.send'] })).toBeInTheDocument();
  });
});

describe('PayVerdict', () => {
  it('closes the query on "settled"', async () => {
    vi.mocked(payQueryVerdictAction).mockResolvedValue({ ok: true, reopened: false });
    renderIn(<PayVerdict queryId="payq-1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, it is settled' }));
    });
    expect(payQueryVerdictAction).toHaveBeenCalledWith('payq-1', 'settled');
    expect(screen.getByRole('status')).toHaveTextContent('This query is closed');
    expect(refresh).toHaveBeenCalled();
  });

  it('sends it back on "not yet"', async () => {
    vi.mocked(payQueryVerdictAction).mockResolvedValue({ ok: true, reopened: true });
    renderIn(<PayVerdict queryId="payq-1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'No, not yet' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('within 1 day');
  });

  it('keeps the buttons when the answer fails', async () => {
    vi.mocked(payQueryVerdictAction).mockResolvedValue({
      ok: false,
      code: 'verdict_not_allowed',
      reason: 'no',
      permanent: true,
      retryable: false,
    });
    renderIn(<PayVerdict queryId="payq-1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, it is settled' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not send');
    expect(screen.getByRole('button', { name: 'Yes, it is settled' })).toBeEnabled();
  });
});
