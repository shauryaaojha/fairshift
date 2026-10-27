import { GlobeIcon } from '@/src/components/icons';
import { ReadAloud } from '@/src/components/ui/ReadAloud';
import { LOCALES, NATIVE_NAME, t, type Locale } from '@/src/i18n';
import { setLanguageAction } from '@/app/w/actions';
import { SpeakName } from './SpeakName';

/**
 * Three huge native-script buttons. Each is a real form button, so the
 * choice works even before JavaScript loads. The speaker says the name aloud.
 */
export function LanguageGate({ current, next }: { current: Locale; next: string }) {
  // The gate is trilingual by design: nobody has chosen a language yet.
  const prompt = LOCALES.map((l) => t(l, 'lang.title')).join('. ');
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 text-ink">
          <GlobeIcon size={32} />
        </span>
        <h1 className="text-h1 min-w-0 flex-1">
          {LOCALES.map((l) => (
            <span key={l} lang={l} className="block">
              {t(l, 'lang.title')}
            </span>
          ))}
        </h1>
        <ReadAloud text={t(current, 'lang.prompt')} />
      </div>
      <span className="sr-only">{prompt}</span>
      <ul className="flex flex-col gap-3">
        {LOCALES.map((l) => (
          <li key={l} className="flex items-stretch gap-3">
            <form action={setLanguageAction} className="flex-1">
              <input type="hidden" name="locale" value={l} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                lang={l}
                aria-current={l === current ? 'true' : undefined}
                className={
                  'min-h-16 w-full rounded-[10px] border-2 px-4 text-start text-2xl font-semibold leading-snug ' +
                  (l === current
                    ? 'border-ink bg-ink text-white'
                    : 'border-graphite bg-card text-graphite')
                }
              >
                {NATIVE_NAME[l]}
              </button>
            </form>
            <SpeakName locale={l} text={NATIVE_NAME[l]} label={t(l, 'lang.hear')} />
          </li>
        ))}
      </ul>
    </div>
  );
}
