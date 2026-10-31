import { ButtonLink } from '@/src/components/ui/Button';
import { Stamp } from '@/src/components/ui/Stamp';
import { ConfirmFix } from '@/src/components/worker/ConfirmFix';
import { HazardTimelineView } from '@/src/components/worker/HazardTimeline';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  formatClock,
  formatDay,
  getLocale,
  hazardTimeline,
  loadHazard,
  requireWorkerContext,
} from '@/src/server/services/workerViews';

export default async function HazardStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx, cookieLocale] = await Promise.all([
    params,
    requireWorkerContext(),
    getLocale(),
  ]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const back = t(locale, 'common.back');
  const hazard = await loadHazard(ctx.worker, id);

  if (!hazard) {
    return (
      <Screen
        title={t(locale, 'hazard.statusTitle')}
        speakText={t(locale, 'hazard.notFound')}
        backLabel={back}
        backHref="/w/hazard"
      >
        <p role="alert" className="text-body">
          {t(locale, 'hazard.notFound')}
        </p>
      </Screen>
    );
  }

  const tl = hazardTimeline(hazard);
  const labels: Record<string, string> = {
    reported: t(locale, 'hazard.status.reported'),
    escalated: t(locale, 'hazard.status.escalated'),
    acknowledged: t(locale, 'hazard.status.acknowledged'),
    resolved: t(locale, 'hazard.status.resolved'),
    reopened: t(locale, 'hazard.status.reopened'),
    confirmed: t(locale, 'hazard.status.confirmed'),
  };
  const askVerdict = tl.closure === 'awaiting_reporter' && hazard.reporterId === ctx.worker.id;
  const times: Partial<Record<string, string>> = {};
  for (const s of tl.steps) {
    if (s.at) times[s.key] = `${formatDay(s.at, locale)} ${formatClock(s.at)}`;
  }

  return (
    <Screen
      title={t(locale, 'hazard.statusTitle')}
      speakText={
        t(locale, 'hazard.statusSpeak', { status: labels[hazard.status] }) +
        (askVerdict ? ' ' + t(locale, 'hazard.verdict.ask') : '')
      }
      backLabel={back}
      backHref="/w/hazard"
      action={
        <ButtonLink href="/w/hazard" variant="secondary" fullWidth className="min-h-14">
          {t(locale, 'hazard.newReport')}
        </ButtonLink>
      }
    >
      <section className="flex flex-col gap-3 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-h2 min-w-0">{hazard.category}</p>
          <Stamp variant={tl.stamp.variant} id={hazard.id}>
            {t(locale, tl.stamp.labelKey)}
          </Stamp>
        </div>
        <p className="text-body">{hazard.description}</p>
        {hazard.anonymous ? (
          <p className="text-small text-muted">{t(locale, 'hazard.anonNote')}</p>
        ) : null}
      </section>
      {askVerdict ? <ConfirmFix hazardId={hazard.id} /> : null}
      <HazardTimelineView steps={tl.steps} labels={labels} times={times} />
    </Screen>
  );
}
