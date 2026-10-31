import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSiteHeat, setWeatherFetchForTests } from '@/src/server/weather';

const site = { id: 'site-1', lat: 13.0, lng: 80.2 };

const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv('WEATHER_DISABLED', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  setWeatherFetchForTests(undefined);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('getSiteHeat', () => {
  it('turns the current weather into a heat reading and caches it per site', async () => {
    const fetch = reply({ current: { temperature_2m: 34, relative_humidity_2m: 70 } });
    setWeatherFetchForTests(fetch as unknown as typeof globalThis.fetch);
    const first = await getSiteHeat(site);
    expect(first).toMatchObject({ temperatureC: 34, humidityPct: 70, level: 'danger' });
    expect(await getSiteHeat(site)).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain('latitude=13&longitude=80.2');
  });

  it('returns null on an HTTP error, a bad body or a network failure, and caches that too', async () => {
    for (const fetch of [
      reply({}, 503),
      reply({ current: { temperature_2m: 'hot' } }),
      vi.fn(async () => {
        throw new Error('timeout');
      }),
    ]) {
      setWeatherFetchForTests(fetch as unknown as typeof globalThis.fetch);
      expect(await getSiteHeat(site)).toBeNull();
      expect(await getSiteHeat(site)).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it('can be switched off', async () => {
    vi.stubEnv('WEATHER_DISABLED', '1');
    const fetch = reply({ current: { temperature_2m: 34, relative_humidity_2m: 70 } });
    setWeatherFetchForTests(fetch as unknown as typeof globalThis.fetch);
    expect(await getSiteHeat(site)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
