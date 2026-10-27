import { TopBar } from '@/src/components/ui/TopBar';
import { FeedbackForm } from '@/src/components/worker/FeedbackForm';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { getLocale, requireWorkerContext } from '@/src/server/services/workerViews';

export default async function FeedbackPage() {
  const [, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={t(locale, 'feedback.title')}
        speakText={t(locale, 'feedback.speak')}
        backLabel={t(locale, 'common.back')}
        transitionName="tile-feedback"
      />
      <FeedbackForm />
    </div>
  );
}
