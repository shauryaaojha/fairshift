import Link from 'next/link';
import { HardHatIcon } from '@/src/components/icons';
import { ButtonLink } from '@/src/components/ui/Button';
import { Stamp } from '@/src/components/ui/Stamp';
import { ShiftClock } from '@/src/components/worker/ShiftClock';
import { SPEECH_LANG, t, type Locale } from '@/src/i18n';
import type { MusterDay, TodoItem } from '@/src/server/services/workerViews';

/**
 * Today as a paper shift ticket: the site, the date, and either the way in or the time on site so
 * far. The tear line separates what is recorded from what the worker can do next.
 */
export function ShiftTicket({
  locale,
  site,
  today,
  since,
  renderedAt,
  dayHours,
}: {
  locale: Locale;
  site: string;
  today: string;
  /** Check-in time (ISO) of the open shift, or null when not on site. */
  since: { iso: string; clock: string; shiftId: string } | null;
  renderedAt: number;
  dayHours: number;
}) {
  return (
    <section className="ticket" aria-label={t(locale, 'home.today')}>
      <div className="ticket-head">
        <HardHatIcon size={20} />
        <span className="min-w-0 flex-1 truncate">{site}</span>
        <span className="text-mono">{today}</span>
      </div>
      <div className="ticket-body">
        {since ? (
          <ShiftClock
            since={since.iso}
            renderedAt={renderedAt}
            dayHours={dayHours}
            aside={
              <Stamp variant="ink" id={since.shiftId} animate={false}>
                {t(locale, 'home.checkedInStamp', { time: since.clock })}
              </Stamp>
            }
          />
        ) : (
          <p className="text-h2">{t(locale, 'home.notCheckedIn')}</p>
        )}
      </div>
      <div className="ticket-tear" aria-hidden="true" />
      <div className="ticket-foot">
        {since ? (
          <ButtonLink href="/w/checkin" variant="secondary" fullWidth>
            {t(locale, 'home.goToCheckout')}
          </ButtonLink>
        ) : (
          <ButtonLink href="/w/checkin" fullWidth>
            {t(locale, 'home.checkInAt', { site: site.split(',')[0] })}
          </ButtonLink>
        )}
      </div>
    </section>
  );
}

/** The last seven days as a muster-roll row: a filled cell with the hours for each day on site. */
export function MusterStrip({
  locale,
  days,
  totalHours,
  overtimeHours,
}: {
  locale: Locale;
  days: MusterDay[];
  totalHours: number;
  overtimeHours: number;
}) {
  const weekday = new Intl.DateTimeFormat(SPEECH_LANG[locale], {
    weekday: 'short',
    timeZone: 'UTC',
  });
  return (
    <section className="surface-card flex flex-col gap-3 p-4" aria-labelledby="muster-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="muster-title" className="text-h2">
          {t(locale, 'home.week')}
        </h2>
        <Link href="/w/hours" className="link text-small font-semibold">
          {t(locale, 'home.weekLink')}
        </Link>
      </div>
      <ol className="muster">
        {days.map((d) => {
          const day = weekday.format(new Date(`${d.date}T00:00:00Z`));
          return (
            <li
              key={d.date}
              className={`muster-day${d.present ? ' is-present' : ''}${d.today ? ' is-today' : ''}`}
              aria-label={
                d.present
                  ? t(locale, 'home.dayPresent', { day, hours: d.hours })
                  : t(locale, 'home.dayAbsent', { day })
              }
            >
              <span className="muster-wd" aria-hidden="true">
                {day}
              </span>
              <span className="muster-cell" aria-hidden="true">
                {d.present ? d.hours : '–'}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-small text-muted">
        {t(locale, 'home.weekTotal', { hours: totalHours, overtime: overtimeHours })}
      </p>
    </section>
  );
}

const TODO_TEXT = {
  letter_ready: 'todo.letterReady',
  pay_answered: 'todo.payAnswered',
  hazard_fixed: 'todo.hazardFixed',
  wages_overdue: 'todo.wagesOverdue',
} as const;

/** Things that wait on the worker's answer. Urgent ones (late wages, a letter) are marked red. */
export function TodoList({
  locale,
  items,
  monthName,
}: {
  locale: Locale;
  items: TodoItem[];
  monthName: (period: string) => string;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="todo-title" className="flex flex-col gap-2">
      <h2 id="todo-title" className="text-h2">
        {t(locale, 'home.todo')}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const urgent = item.kind === 'letter_ready' || item.kind === 'wages_overdue';
          const text = t(
            locale,
            TODO_TEXT[item.kind],
            item.kind === 'wages_overdue' ? { month: monthName(item.period) } : undefined,
          );
          return (
            <li key={`${item.kind}:${item.href}`}>
              <Link href={item.href} className={`todo${urgent ? ' is-urgent' : ''}`}>
                <span className="todo-mark" aria-hidden="true" />
                <span className="min-w-0 flex-1">{text}</span>
                <span className="todo-go" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
