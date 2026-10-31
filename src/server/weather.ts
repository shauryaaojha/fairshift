/**
 * Current temperature and humidity at a site from Open-Meteo (free, no key), turned into a heat
 * reading. Cached per site for 30 minutes, given 3 seconds, and on any failure it returns null so
 * the heat card simply does not show: the weather is advice, never a reason for a page to fail.
 */

import { z } from 'zod';
import { assessHeat, type HeatReading } from './domain/heat';

const CACHE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 3000;
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

const responseSchema = z.object({
  current: z.object({
    temperature_2m: z.number().min(-60).max(70),
    relative_humidity_2m: z.number().min(0).max(100),
  }),
});

type Fetch = typeof fetch;
let fetchImpl: Fetch | undefined;
const cache = new Map<string, { at: number; reading: HeatReading | null }>();

/** Tests swap the network for a stub; `undefined` restores the real fetch. Clears the cache. */
export function setWeatherFetchForTests(f: Fetch | undefined): void {
  fetchImpl = f;
  cache.clear();
}

export async function getSiteHeat(site: {
  id: string;
  lat: number;
  lng: number;
}): Promise<HeatReading | null> {
  if (process.env.WEATHER_DISABLED === '1') return null;
  const hit = cache.get(site.id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.reading;

  const url = `${ENDPOINT}?latitude=${site.lat}&longitude=${site.lng}&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FKolkata`;
  let reading: HeatReading | null = null;
  try {
    const res = await (fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { current } = responseSchema.parse(await res.json());
    reading = assessHeat(current.temperature_2m, current.relative_humidity_2m);
  } catch (err) {
    console.warn(
      `[FairShift] weather unavailable for ${site.id}:`,
      err instanceof Error ? err.message : err,
    );
  }
  // A failure is cached too, so a weather outage costs one slow request per half hour, not one
  // per page view.
  cache.set(site.id, { at: Date.now(), reading });
  return reading;
}
