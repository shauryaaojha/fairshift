import type { HeatReading } from '@/src/server/domain/heat';

const LABEL: Record<Exclude<HeatReading['level'], 'none'>, string> = {
  caution: 'Caution',
  extreme_caution: 'Extreme caution',
  danger: 'Danger',
  extreme_danger: 'Extreme danger',
};

/**
 * What the site lead should change because of the heat now. Bands are the US National Weather
 * Service heat-index bands; the 12 noon to 3 pm window is NDMA's heat-wave advice.
 */
const ACTION: Record<Exclude<HeatReading['level'], 'none'>, string> = {
  caution: 'Keep drinking water at every work point.',
  extreme_caution: 'Add shaded rest breaks and check water points every hour.',
  danger: 'Move heavy outdoor work out of 12 noon to 3 pm. Shaded rest and water every 20 minutes.',
  extreme_danger: 'Stop heavy work in the sun. Move crews to shade or indoor tasks.',
};

export function HeatBanner({
  heat,
  place,
}: {
  heat: HeatReading | null | undefined;
  place: string;
}) {
  if (!heat || heat.level === 'none') return null;
  return (
    <section className="heat-banner section" data-level={heat.level} aria-labelledby="heat-h">
      <h2 id="heat-h" className="section-title">
        Heat at {place}: {LABEL[heat.level]}
      </h2>
      <p>
        Feels like <span className="mono">{heat.heatIndexC.toFixed(1)} °C</span> (air{' '}
        <span className="mono">{heat.temperatureC.toFixed(1)} °C</span>, humidity{' '}
        <span className="mono">{Math.round(heat.humidityPct)}%</span>). {ACTION[heat.level]}
      </p>
      <p className="text-small muted">
        Live weather from Open-Meteo, heat index and bands from the US National Weather Service.
      </p>
    </section>
  );
}
