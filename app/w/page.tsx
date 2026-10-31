import Link from 'next/link';
import { BadgeIcon, ConeIcon, ScalesIcon, SpeechLockIcon } from '@/src/components/icons';
import { Tile } from '@/src/components/ui/Tile';
import { FatigueCards } from '@/src/components/worker/FatigueCards';
import { HeatCard } from '@/src/components/worker/HeatCard';
import { MusterStrip, ShiftTicket, TodoList } from '@/src/components/worker/HomeBoard';
import { getSiteHeat } from '@/src/server/weather';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  describeFatigue,
  formatClock,
  formatDay,
  formatMonth,
  getLocale,
  loadHome,
  loadHomeBoard,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { LogoutButton } from '@/src/components/worker/LogoutButton';
import { InstallButton } from '@/src/components/pwa/InstallButton';

export default async function WorkerHomePage() {
  const [ctx, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const { worker, site } = ctx;
  const now = new Date();
  const [{ activeShift, fatigueFlags }, board, heat] = await Promise.all([
    loadHome(worker.id),
    loadHomeBoard(worker, now),
    getSiteHeat(site),
  ]);

  const firstName = worker.name.split(' ')[0];
  const today = formatDay(now.toISOString(), locale, true);
  const onSiteSince = activeShift ? formatClock(activeShift.checkIn) : null;
  const status = onSiteSince
    ? t(locale, 'home.onSite', { time: onSiteSince })
    : t(locale, 'home.notCheckedIn');
  const notes = describeFatigue(fatigueFlags, locale).slice(0, 2);

  return (
    <Screen
      title={t(locale, 'home.greeting', { name: firstName })}
      speakText={t(locale, 'home.speak', { name: firstName, date: today, status })}
      backLabel={t(locale, 'common.back')}
      backHref={null}
    >
      <ShiftTicket
        locale={locale}
        site={site.name}
        today={today}
        since={
          activeShift && onSiteSince
            ? { iso: activeShift.checkIn, clock: onSiteSince, shiftId: activeShift.id }
            : null
        }
        renderedAt={now.getTime()}
        dayHours={board.dayHours}
      />

      <TodoList
        locale={locale}
        items={board.todo}
        monthName={(period) => formatMonth(period, locale)}
      />
      <HeatCard heat={heat} locale={locale} />
      <FatigueCards title={t(locale, 'home.fatigueTitle')} notes={notes} />

      <MusterStrip
        locale={locale}
        days={board.days}
        totalHours={board.totalHours}
        overtimeHours={board.overtimeHours}
      />

      <nav aria-labelledby="more-title" className="flex flex-col gap-2">
        <h2 id="more-title" className="text-h2">
          {t(locale, 'home.more')}
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          <li>
            <Tile
              href="/w/hazard"
              label={t(locale, 'tile.hazard')}
              icon={<ConeIcon size={28} />}
              tone="danger"
              transitionName="tile-hazard"
            />
          </li>
          <li>
            <Tile
              href="/w/feedback"
              label={t(locale, 'tile.feedback')}
              icon={<SpeechLockIcon size={28} />}
              transitionName="tile-feedback"
            />
          </li>
          <li>
            <Tile
              href="/w/rights"
              label={t(locale, 'tile.rights')}
              icon={<ScalesIcon size={28} />}
              transitionName="tile-rights"
            />
          </li>
          <li>
            <Tile
              href="/w/skills"
              label={t(locale, 'tile.skills')}
              icon={<BadgeIcon size={28} />}
              transitionName="tile-skills"
            />
          </li>
        </ul>
      </nav>

      <InstallButton label={t(locale, 'home.install')} iosHint={t(locale, 'home.installIos')} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/w/login?lang=1"
          className="inline-flex min-h-12 items-center text-label font-semibold text-ink underline underline-offset-4"
        >
          {t(locale, 'home.language')}
        </Link>
        <LogoutButton label={t(locale, 'home.logout')} />
      </div>
    </Screen>
  );
}
