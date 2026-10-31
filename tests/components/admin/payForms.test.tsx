import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/actions', () => ({
  answerPayQueryAction: vi.fn(),
  schedulePayRulesAction: vi.fn(),
}));

import { PayAnswerForm, PayRulesForm, type RuleField } from '@/src/components/admin/PayForms';
import { answerPayQueryAction, schedulePayRulesAction } from '@/app/admin/actions';

const FIELDS: RuleField[] = [
  {
    key: 'dailyHoursLimit',
    label: 'Overtime after (hours a day)',
    min: 4,
    max: 8,
    step: 0.5,
    law: 'OSH Code 2020, s. 25',
  },
  {
    key: 'weeklyHoursLimit',
    label: 'Overtime after (hours a week)',
    min: 24,
    max: 48,
    step: 1,
    law: 'OSH Code 2020, s. 25',
  },
  {
    key: 'otMultiplier',
    label: 'Overtime rate (times normal pay)',
    min: 2,
    max: 3,
    step: 0.25,
    law: 'Code on Wages 2019, s. 14',
  },
];
const CURRENT = { dailyHoursLimit: 8, weeklyHoursLimit: 48, otMultiplier: 2 };

beforeEach(() => {
  vi.mocked(answerPayQueryAction).mockReset();
  vi.mocked(schedulePayRulesAction).mockReset();
});

describe('PayAnswerForm', () => {
  it('posts the query id and shows the result inline', async () => {
    vi.mocked(answerPayQueryAction).mockResolvedValue({ ok: true, message: 'Answer sent.' });
    render(<PayAnswerForm id="payq-1" payslipNet={18640} />);
    expect(screen.getByLabelText(/Corrected take-home pay/)).toHaveAttribute(
      'placeholder',
      '18640',
    );
    fireEvent.change(screen.getByLabelText('Your answer to the worker'), {
      target: { value: 'Overtime for both Sundays is added.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send answer' }));
    });
    const sent = vi.mocked(answerPayQueryAction).mock.calls[0][1];
    expect(sent.get('id')).toBe('payq-1');
    expect(sent.get('text')).toBe('Overtime for both Sundays is added.');
    expect(screen.getByRole('status')).toHaveTextContent('Answer sent.');
  });

  it('shows the server’s reason when the answer is refused', async () => {
    vi.mocked(answerPayQueryAction).mockResolvedValue({ ok: false, error: 'Too short.' });
    render(<PayAnswerForm id="payq-1" payslipNet={100} />);
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Send answer' }).closest('form')!);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Too short.');
  });
});

describe('PayRulesForm', () => {
  it('bounds every rule by the law and offers only free Mondays', () => {
    render(
      <PayRulesForm fields={FIELDS} current={CURRENT} startDates={['2026-11-09', '2026-11-16']} />,
    );
    const rate = screen.getByLabelText('Overtime rate (times normal pay)');
    expect(rate).toHaveAttribute('min', '2');
    expect(rate).toHaveValue(2);
    expect(rate).toHaveAccessibleDescription(/Code on Wages 2019/);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '2026-11-09',
      '2026-11-16',
    ]);
  });

  it('submits the change and shows the confirmation', async () => {
    vi.mocked(schedulePayRulesAction).mockResolvedValue({
      ok: true,
      message: 'Scheduled from Monday 2026-11-09.',
    });
    render(<PayRulesForm fields={FIELDS} current={CURRENT} startDates={['2026-11-09']} />);
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: 'Agreed at the meeting' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Schedule the change' }));
    });
    const sent = vi.mocked(schedulePayRulesAction).mock.calls[0][1];
    expect(Object.fromEntries(sent)).toMatchObject({
      dailyHoursLimit: '8',
      otMultiplier: '2',
      effectiveFrom: '2026-11-09',
      reason: 'Agreed at the meeting',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Scheduled from Monday 2026-11-09.');
  });

  it('says when every Monday is taken', () => {
    render(<PayRulesForm fields={FIELDS} current={CURRENT} startDates={[]} />);
    expect(screen.getByText(/already has a change scheduled/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
