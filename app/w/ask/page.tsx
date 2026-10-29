import { Screen } from '@/src/components/worker/Screen';
import { AskChat } from '@/src/components/worker/AskChat';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { getLocale, requireWorkerContext } from '@/src/server/services/workerViews';

export default async function AskPage() {
  const [, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;

  return (
    <Screen
      title={t(locale, 'ask.title')}
      speakText={t(locale, 'ask.intro')}
      backLabel={t(locale, 'common.back')}
      transitionName="tile-ask"
    >
      <AskChat />
    </Screen>
  );
}
