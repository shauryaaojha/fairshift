import { SunIcon } from '@/src/components/icons';
import { ReadAloud } from '@/src/components/ui/ReadAloud';
import { t } from '@/src/i18n';
import type { HeatReading } from '@/src/server/domain/heat';
import type { Locale } from '@/src/shared/types';

/**
 * Heat warning on the worker home, in their language, with read-aloud. The advice follows NDMA's
 * heat-wave dos and don'ts (drink water even if not thirsty; avoid the sun from 12 noon to 3 pm).
 * Shown only from the NWS "Caution" band up.
 */
export function HeatCard({ heat, locale }: { heat: HeatReading | null; locale: Locale }) {
  if (!heat || heat.level === 'none') return null;
  const title = t(locale, `heat.title.${heat.level}`);
  const feels = t(locale, 'heat.feels', {
    c: Math.round(heat.heatIndexC),
    t: Math.round(heat.temperatureC),
    h: Math.round(heat.humidityPct),
  });
  const advice = t(locale, `heat.do.${heat.level}`);
  const signs = t(locale, 'heat.signs');
  return (
    <section
      aria-labelledby="heat-title"
      className="flex gap-3 rounded-[10px] border-2 border-graphite bg-hivis p-4 text-graphite"
    >
      <span className="mt-0.5 shrink-0">
        <SunIcon />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="heat-title" className="text-label font-semibold">
          {title}
        </h2>
        <p className="text-body">{feels}</p>
        <p className="text-body font-semibold">{advice}</p>
        <p className="text-small">{signs}</p>
        <ReadAloud text={`${title}. ${feels} ${advice} ${signs}`} />
      </div>
    </section>
  );
}
