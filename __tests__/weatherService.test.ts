import { MemoryWeatherCache, buildForecastUrl, fetchWeatherBundle, parseOpenMeteoForecast } from '../src/services/weatherService';
import { WeatherDataError } from '../src/types/weather';
import { LONDON } from './fixtures';

function series(length: number, value: number): number[] {
  return Array.from({ length }, () => value);
}

function payload(overrides: Record<string, unknown> = {}) {
  const hours = 16;
  return {
    timezone: 'Europe/London',
    utc_offset_seconds: 0,
    current: {
      time: '2026-10-23T08:00',
      temperature_2m: 11.2,
      apparent_temperature: 9.5,
      precipitation: 0.4,
      rain: 0.4,
      showers: 0,
      weather_code: 61,
      wind_speed_10m: 18,
    },
    hourly: {
      time: Array.from({ length: hours }, (_, index) => `2026-10-23T${String(index).padStart(2, '0')}:00`),
      temperature_2m: series(hours, 12),
      precipitation_probability: series(hours, 20),
      precipitation: series(hours, 0),
      rain: series(hours, 0),
      showers: series(hours, 0),
      weather_code: series(hours, 2),
    },
    daily: {
      time: ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'],
      weather_code: series(7, 3),
      temperature_2m_max: series(7, 15),
      temperature_2m_min: series(7, 8),
      precipitation_sum: series(7, 0.2),
      precipitation_probability_max: series(7, 30),
    },
    ...overrides,
  };
}

describe('Open-Meteo weather service', () => {
  test('the forecast URL asks for live current weather and hourly plus daily fields', () => {
    const url = new URL(buildForecastUrl(LONDON));
    expect(`${url.origin}${url.pathname}`).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('current')).toBe(
      'temperature_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m',
    );
    expect(url.searchParams.get('hourly')).toBe(
      'temperature_2m,precipitation_probability,precipitation,rain,showers,weather_code',
    );
    expect(url.searchParams.get('daily')).toBe(
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    );
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('latitude')).toBe(String(LONDON.latitude));
  });

  test('parses live observations separately from forecast points', () => {
    const bundle = parseOpenMeteoForecast(payload(), LONDON, new Date('2026-10-23T08:05:00.000Z'));
    expect(bundle.provider).toBe('open-meteo');
    expect(bundle.current.isLiveObservation).toBe(true);
    expect(bundle.current.isRainingNow).toBe(true);
    expect(bundle.current.temperatureC).toBe(11.2);
    expect(bundle.current.currentPrecipitationMm).toBe(0.4);
    expect(bundle.current.currentRainProbabilityPct).toBe(20);
    expect(bundle.hourly.every((point) => point.isForecast === true)).toBe(true);
    expect(bundle.daily.every((point) => point.isForecast === true)).toBe(true);
    expect(bundle.hourly[8]?.hourLabel).toBe('08:00');
    expect(bundle.daily[0]?.dayLabel).toBe('Today');
    expect(bundle.modelConfidence).toBe('high');
  });

  test('skips null hourly slots but rejects a payload with no usable hours', () => {
    const body = payload();
    const hourly = body.hourly as { precipitation_probability: (number | null)[] };
    hourly.precipitation_probability[1] = null;
    const bundle = parseOpenMeteoForecast(body, LONDON, new Date('2026-10-23T08:05:00.000Z'));
    expect(bundle.hourly).toHaveLength(15);

    expect(() => parseOpenMeteoForecast({ timezone: 'UTC' }, LONDON)).toThrow(WeatherDataError);
    const broken = payload();
    (broken.hourly as { time: string[] }).time = ['2026-10-23T00:00'];
    expect(() => parseOpenMeteoForecast(broken, LONDON)).toThrow(/lengths do not match/);
    const badTemp = payload();
    (badTemp.current as { temperature_2m: unknown }).temperature_2m = 'mild';
    expect(() => parseOpenMeteoForecast(badTemp, LONDON)).toThrow(WeatherDataError);
  });

  test('uses the offline cache when the network fails and writes it after success', async () => {
    const cached = parseOpenMeteoForecast(payload(), LONDON, new Date('2026-10-23T06:00:00.000Z'));
    const cache = new MemoryWeatherCache(cached);
    const failed = await fetchWeatherBundle(LONDON, {
      cache,
      fetchImpl: jest.fn(async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    });
    expect(failed.fromCache).toBe(true);
    expect(failed.bundle?.fetchedAtIso).toBe(cached.fetchedAtIso);
    expect(failed.error).toMatch(/offline/);

    const empty = new MemoryWeatherCache();
    const missed = await fetchWeatherBundle(LONDON, {
      cache: empty,
      fetchImpl: jest.fn(async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    });
    expect(missed.bundle).toBeNull();
    expect(missed.fromCache).toBe(false);

    const fresh = new MemoryWeatherCache();
    const response = {
      ok: true,
      status: 200,
      json: async () => payload(),
    } as Response;
    const saved = await fetchWeatherBundle(LONDON, {
      cache: fresh,
      now: () => new Date('2026-10-23T09:00:00.000Z'),
      fetchImpl: jest.fn(async () => response) as unknown as typeof fetch,
    });
    expect(saved.fromCache).toBe(false);
    expect(saved.bundle?.provider).toBe('open-meteo');
    expect(fresh.snapshot()?.fetchedAtIso).toBe('2026-10-23T09:00:00.000Z');
    expect(saved.bundle?.current.isLiveObservation).toBe(true);
    expect(saved.bundle?.hourly[0]?.isForecast).toBe(true);
  });

  test('a malformed payload falls back to cache', async () => {
    const cached = parseOpenMeteoForecast(payload(), LONDON, new Date('2026-10-23T06:00:00.000Z'));
    const cache = new MemoryWeatherCache(cached);
    const response = {
      ok: true,
      status: 200,
      json: async () => ({ current: { temperature_2m: 10 } }),
    } as Response;
    const result = await fetchWeatherBundle(LONDON, {
      cache,
      fetchImpl: jest.fn(async () => response) as unknown as typeof fetch,
    });
    expect(result.fromCache).toBe(true);
    expect(result.bundle?.current.isLiveObservation).toBe(true);
    expect(result.error).toBeTruthy();
  });

  test('does not reuse a cache for a different place', async () => {
    const cached = parseOpenMeteoForecast(payload(), LONDON, new Date('2026-10-23T06:00:00.000Z'));
    const cache = new MemoryWeatherCache(cached);
    const result = await fetchWeatherBundle(
      { ...LONDON, name: 'Manchester', latitude: 53.48, longitude: -2.24 },
      {
        cache,
        fetchImpl: jest.fn(async () => {
          throw new Error('offline');
        }) as unknown as typeof fetch,
      },
    );
    expect(result.bundle).toBeNull();
    expect(result.fromCache).toBe(false);
  });
});
