import Link from 'next/link';
import {
  BadgeIcon,
  ClockCardIcon,
  ConeIcon,
  QrIcon,
  RupeeNoteIcon,
  SpeechLockIcon,
} from '@/src/components/icons';
import { ButtonLink } from '@/src/components/ui/Button';
import { Stamp } from '@/src/components/ui/Stamp';
import { Tile } from '@/src/components/ui/Tile';
import { FatigueCards } from '@/src/components/worker/FatigueCards';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  describeFatigue,
  formatClock,
  formatDay,
  getLocale,
  loadHome,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { LogoutButton } from '@/src/components/worker/LogoutButton';
import { InstallButton } from '@/src/components/pwa/InstallButton';

export default async function WorkerHomePage() {
  const [ctx, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const { worker, site } = ctx;
  const { activeShift, fatigueFlags } = await loadHome(worker.id);

  const firstName = worker.name.split(' ')[0];
  const today = formatDay(new Date().toISOString(), locale, true);
  const onSiteSince = activeShift ? formatClock(activeShift.checkIn) : null;
  const status = onSiteSince
    ? t(locale, 'home.onSite', { time: onSiteSince })
    : t(locale, 'home.notCheckedIn');
  const notes = describeFatigue(fatigueFlags, locale).slice(0, 2);

  const action = activeShift ? (
    <ButtonLink href="/w/checkin" variant="secondary" fullWidth className="min-h-14">
      {t(locale, 'home.goToCheckout')}
    </ButtonLink>
  ) : (
    <ButtonLink href="/w/checkin">
      {t(locale, 'home.checkInAt', { site: site.name.split(',')[0] })}
    </ButtonLink>
  );

  return (
    <Screen
      title={t(locale, 'home.greeting', { name: firstName })}
      speakText={t(locale, 'home.speak', { name: firstName, date: today, status })}
      backLabel={t(locale, 'common.back')}
      backHref={null}
      action={action}
    >
      <section
        aria-label={t(locale, 'home.today')}
        className="flex items-center justify-between gap-4 rounded-[6px] bg-card p-4 shadow-[var(--shadow-paper)]"
      >
        <div className="min-w-0">
          <p className="text-small text-muted">{t(locale, 'home.today')}</p>
          <p className="text-h2">{today}</p>
          <p className="text-body mt-1">{status}</p>
        </div>
        {onSiteSince ? (
          <Stamp variant="ink" id={activeShift?.id} animate={false}>
            {t(locale, 'home.checkedInStamp', { time: onSiteSince })}
          </Stamp>
        ) : null}
      </section>

      <FatigueCards title={t(locale, 'home.fatigueTitle')} notes={notes} />

      <nav aria-label={t(locale, 'home.today')}>
        <ul className="grid grid-cols-2 gap-3">
          <li>
            <Tile
              href="/w/checkin"
              label={t(locale, 'tile.checkin')}
              icon={<QrIcon size={36} />}
              transitionName="tile-checkin"
            />
          </li>
          <li>
            <Tile
              href="/w/pay"
              label={t(locale, 'tile.pay')}
              icon={<RupeeNoteIcon size={36} />}
              transitionName="tile-pay"
            />
          </li>
          <li>
            <Tile
              href="/w/hazard"
              label={t(locale, 'tile.hazard')}
              icon={<ConeIcon size={36} />}
              tone="danger"
              transitionName="tile-hazard"
            />
          </li>
          <li>
            <Tile
              href="/w/feedback"
              label={t(locale, 'tile.feedback')}
              icon={<SpeechLockIcon size={36} />}
              transitionName="tile-feedback"
            />
          </li>
          <li>
            <Tile
              href="/w/hours"
              label={t(locale, 'tile.hours')}
              icon={<ClockCardIcon size={36} />}
              transitionName="tile-hours"
            />
          </li>
          <li>
            <Tile
              href="/w/skills"
              label={t(locale, 'tile.skills')}
              icon={<BadgeIcon size={36} />}
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
