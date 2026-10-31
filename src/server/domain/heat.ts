/**
 * Heat stress from air temperature and humidity. The heat index is the US National Weather
 * Service formula (Rothfusz regression with its low- and high-humidity adjustments), and the
 * bands are the NWS ones: Caution from 80 °F (26.7 °C), Extreme caution from 90 °F (32.2 °C),
 * Danger from 103 °F (39.4 °C), Extreme danger from 125 °F (51.7 °C). Pure.
 */

export type HeatLevel = 'none' | 'caution' | 'extreme_caution' | 'danger' | 'extreme_danger';

export interface HeatReading {
  temperatureC: number;
  humidityPct: number;
  heatIndexC: number;
  level: HeatLevel;
}

const toF = (c: number) => (c * 9) / 5 + 32;
const toC = (f: number) => ((f - 32) * 5) / 9;

/** Heat index ("feels like") in °C. */
export function heatIndexC(temperatureC: number, humidityPct: number): number {
  const T = toF(temperatureC);
  const R = Math.min(100, Math.max(0, humidityPct));

  // NWS: use the simple formula first, and the full regression only from 80 °F.
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + R * 0.094);
  if ((simple + T) / 2 < 80) return round1(toC(simple));

  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;
  if (R < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (R > 85 && T >= 80 && T <= 87) {
    hi += ((R - 85) / 10) * ((87 - T) / 5);
  }
  return round1(toC(hi));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function heatLevel(indexC: number): HeatLevel {
  if (indexC >= 51.7) return 'extreme_danger';
  if (indexC >= 39.4) return 'danger';
  if (indexC >= 32.2) return 'extreme_caution';
  if (indexC >= 26.7) return 'caution';
  return 'none';
}

export function assessHeat(temperatureC: number, humidityPct: number): HeatReading {
  const index = heatIndexC(temperatureC, humidityPct);
  return { temperatureC, humidityPct, heatIndexC: index, level: heatLevel(index) };
}

/** Bands where the site should change how it works, not just remind people to drink water. */
export function heatNeedsAction(level: HeatLevel): boolean {
  return level === 'danger' || level === 'extreme_danger';
}
