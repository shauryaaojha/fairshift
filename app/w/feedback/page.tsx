import { TopBar } from '@/src/components/ui/TopBar';
import { FeedbackForm } from '@/src/components/worker/FeedbackForm';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { ButtonLink } from '@/src/components/ui/Button';
import { workerService } from '@/src/server/services/workerService';
import { getLocale, requireWorkerContext } from '@/src/server/services/workerViews';

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ comment?: string }>;
}) {
  const [ctx, cookieLocale, { comment }] = await Promise.all([
    requireWorkerContext(),
    getLocale(),
    searchParams,
  ]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const answered = await workerService.hasGivenFeedback(ctx.worker.id);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={t(locale, 'feedback.title')}
        speakText={t(locale, 'feedback.speak')}
        backLabel={t(locale, 'common.back')}
        transitionName="tile-feedback"
      />
      {answered ? (
        <div className="flex flex-1 flex-col gap-4">
          <p className="text-body">{t(locale, 'feedback.already')}</p>
          <ButtonLink href="/w">{t(locale, 'common.home')}</ButtonLink>
        </div>
      ) : (
        <FeedbackForm initialComment={typeof comment === 'string' ? comment : undefined} />
      )}
    </div>
  );
}
