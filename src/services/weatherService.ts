import { dayLabelFor, hourLabelFromIso, utcToLocalParts } from '../engine/clock';
import type { LocationCoords, WeatherBundle } from '../types/weather';
import { WeatherDataError } from '../types/weather';
import {
  conditionLabel,
  intensityFromMm,
  isRainingFromObservation,
} from './weatherCodes';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherCache {
  read(): Promise<WeatherBundle | null>;
  write(bundle: WeatherBundle): Promise<void>;
}

export interface WeatherFetchResult {
  bundle: WeatherBundle | null;
  fromCache: boolean;
  error: string | null;
}

export interface FetchWeatherOptions {
  fetchImpl?: typeof fetch;
  cache?: WeatherCache;
  now?: () => Date;
  timeoutMs?: number;
}

export function buildForecastUrl(location: LocationCoords): string {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current:
      'temperature_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,precipitation,rain,showers,weather_code',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
    timeformat: 'iso8601',
  });
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WeatherDataError(`${label} is missing or not an object`);
  }
  return value as Record<string, unknown>;
}

function num(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WeatherDataError(`Missing or invalid number for ${field}`);
  }
  return value;
}

function maybeNum(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function str(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WeatherDataError(`Missing text for ${field}`);
  }
  return value;
}

function series(block: Record<string, unknown>, key: string): unknown[] {
  const value = block[key];
  if (!Array.isArray(value)) {
    throw new WeatherDataError(`Forecast series "${key}" is missing`);
  }
  return value;
}

function sameLength(length: number, rows: unknown[][], label: string): void {
  for (const row of rows) {
    if (row.length !== length) {
      throw new WeatherDataError(`${label} series lengths do not match`);
    }
  }
}

/**
 * Map an Open-Meteo forecast payload into a bundle.
 * Current fields are tagged as a live observation. Hourly and daily points
 * are tagged as forecast. Probability on the observation is copied from the
 * matching forecast hour because the current endpoint has no PoP variable.
 */
export function parseOpenMeteoForecast(
  payload: unknown,
  location: LocationCoords,
  fetchedAt: Date = new Date(),
): WeatherBundle {
  const root = asRecord(payload, 'Forecast payload');
  const current = asRecord(root.current, 'Current observation');
  const hourly = asRecord(root.hourly, 'Hourly forecast');
  const daily = asRecord(root.daily, 'Daily forecast');

  const timezone = typeof root.timezone === 'string' && root.timezone.length > 0 ? root.timezone : 'UTC';
  const utcOffsetSeconds = num(root.utc_offset_seconds, 'utc_offset_seconds');

  const times = series(hourly, 'time');
  const temps = series(hourly, 'temperature_2m');
  const pops = series(hourly, 'precipitation_probability');
  const precips = series(hourly, 'precipitation');
  const rains = series(hourly, 'rain');
  const showers = series(hourly, 'showers');
  const codes = series(hourly, 'weather_code');
  sameLength(times.length, [temps, pops, precips, rains, showers, codes], 'Hourly');
  if (times.length === 0) {
    throw new WeatherDataError('Hourly forecast contained no hours');
  }

  const hourlyPoints = [];
  for (let index = 0; index < times.length; index += 1) {
    const timeRaw = times[index];
    const pop = maybeNum(pops[index]);
    const temp = maybeNum(temps[index]);
    const precip = maybeNum(precips[index]);
    const rain = maybeNum(rains[index]);
    const shower = maybeNum(showers[index]);
    const code = maybeNum(codes[index]);
    if (
      typeof timeRaw !== 'string' ||
      pop === null ||
      temp === null ||
      precip === null ||
      rain === null ||
      shower === null ||
      code === null
    ) {
      continue;
    }
    const timeIso = localOpenMeteoTimeToUtc(timeRaw, utcOffsetSeconds);
    hourlyPoints.push({
      timeIso,
      hourLabel: hourLabelFromIso(timeIso, utcOffsetSeconds),
      temperatureC: temp,
      precipitationProbabilityPct: pop,
      precipitationMm: precip,
      rainMm: rain,
      showersMm: shower,
      weatherCode: code,
      conditionLabel: conditionLabel(code),
      intensityLevel: intensityFromMm(Math.max(precip, rain + shower)),
      isForecast: true as const,
    });
  }
  if (hourlyPoints.length === 0) {
    throw new WeatherDataError('Hourly forecast had no usable hours');
  }

  const currentTime = localOpenMeteoTimeToUtc(str(current.time, 'current.time'), utcOffsetSeconds);
  const weatherCode = num(current.weather_code, 'current.weather_code');
  const precipitation = num(current.precipitation, 'current.precipitation');
  const rain = num(current.rain, 'current.rain');
  const shower = num(current.showers, 'current.showers');
  const matching = nearestHour(hourlyPoints, currentTime);

  const dailyTimes = series(daily, 'time');
  const dailyCodes = series(daily, 'weather_code');
  const dailyMax = series(daily, 'temperature_2m_max');
  const dailyMin = series(daily, 'temperature_2m_min');
  const dailySum = series(daily, 'precipitation_sum');
  const dailyPop = series(daily, 'precipitation_probability_max');
  sameLength(dailyTimes.length, [dailyCodes, dailyMax, dailyMin, dailySum, dailyPop], 'Daily');
  if (dailyTimes.length === 0) {
    throw new WeatherDataError('Daily forecast contained no days');
  }

  const today = utcToLocalParts(fetchedAt.toISOString(), utcOffsetSeconds).date;
  const dailyPoints = [];
  for (let index = 0; index < dailyTimes.length; index += 1) {
    const dateRaw = dailyTimes[index];
    const code = maybeNum(dailyCodes[index]);
    const maxT = maybeNum(dailyMax[index]);
    const minT = maybeNum(dailyMin[index]);
    const sum = maybeNum(dailySum[index]);
    const pop = maybeNum(dailyPop[index]);
    if (typeof dateRaw !== 'string' || code === null || maxT === null || minT === null || sum === null || pop === null) {
      continue;
    }
    const dateIso = dateRaw.slice(0, 10);
    dailyPoints.push({
      dateIso,
      dayLabel: dayLabelFor(dateIso, today),
      weatherCode: code,
      conditionLabel: conditionLabel(code),
      tempMinC: minT,
      tempMaxC: maxT,
      maxPrecipitationProbabilityPct: pop,
      totalPrecipitationMm: sum,
      isForecast: true as const,
    });
  }
  if (dailyPoints.length === 0) {
    throw new WeatherDataError('Daily forecast had no usable days');
  }

  const bundle: WeatherBundle = {
    location,
    fetchedAtIso: fetchedAt.toISOString(),
    provider: 'open-meteo',
    timezone,
    utcOffsetSeconds,
    modelConfidence: deriveModelConfidence(hourlyPoints),
    current: {
      timestamp: currentTime,
      temperatureC: num(current.temperature_2m, 'current.temperature_2m'),
      apparentTemperatureC: num(current.apparent_temperature, 'current.apparent_temperature'),
      weatherCode,
      conditionLabel: conditionLabel(weatherCode),
      isRainingNow: isRainingFromObservation(weatherCode, precipitation, rain, shower),
      currentPrecipitationMm: precipitation,
      currentRainProbabilityPct: matching?.precipitationProbabilityPct ?? 0,
      windSpeedKmh: num(current.wind_speed_10m, 'current.wind_speed_10m'),
      isLiveObservation: true,
    },
    hourly: hourlyPoints,
    daily: dailyPoints,
  };
  assertObservationForecastSeparation(bundle);
  return bundle;
}

export function localOpenMeteoTimeToUtc(localIso: string, utcOffsetSeconds: number): string {
  const normalised = localIso.length === 16 ? `${localIso}:00` : localIso;
  const asUtc = Date.parse(`${normalised.replace(/Z$/, '')}Z`);
  if (Number.isNaN(asUtc)) {
    throw new WeatherDataError(`Unparseable Open-Meteo time "${localIso}"`);
  }
  return new Date(asUtc - utcOffsetSeconds * 1000).toISOString();
}

function nearestHour<T extends { timeIso: string; precipitationProbabilityPct: number }>(
  hours: T[],
  targetIso: string,
): T | undefined {
  const target = Date.parse(targetIso);
  let best: T | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const hour of hours) {
    const gap = Math.abs(Date.parse(hour.timeIso) - target);
    if (gap < bestGap) {
      best = hour;
      bestGap = gap;
    }
  }
  return bestGap <= 90 * 60_000 ? best : undefined;
}

function deriveModelConfidence(hours: WeatherBundle['hourly']): WeatherBundle['modelConfidence'] {
  if (hours.length < 12) return 'low';
  let disagreements = 0;
  for (const hour of hours) {
    const highChanceTrace = hour.precipitationProbabilityPct >= 70 && hour.precipitationMm < 0.05;
    const wetButUnlikely = hour.precipitationMm >= 1 && hour.precipitationProbabilityPct < 15;
    if (highChanceTrace || wetButUnlikely) disagreements += 1;
  }
  const ratio = disagreements / hours.length;
  if (ratio > 0.25) return 'low';
  if (ratio > 0.1) return 'medium';
  return 'high';
}

export function assertObservationForecastSeparation(bundle: {
  current: { isLiveObservation: true };
  hourly: { isForecast: true }[];
  daily: { isForecast: true }[];
}): void {
  if (bundle.current.isLiveObservation !== true) {
    throw new WeatherDataError('Current weather must be tagged isLiveObservation');
  }
  for (const hour of bundle.hourly) {
    if (hour.isForecast !== true) {
      throw new WeatherDataError('Hourly points must be tagged isForecast');
    }
  }
  for (const day of bundle.daily) {
    if (day.isForecast !== true) {
      throw new WeatherDataError('Daily points must be tagged isForecast');
    }
  }
}

export function isWeatherBundle(value: unknown): value is WeatherBundle {
  if (!value || typeof value !== 'object') return false;
  const bundle = value as Partial<WeatherBundle>;
  if (bundle.provider !== 'open-meteo') return false;
  if (!bundle.current || bundle.current.isLiveObservation !== true) return false;
  if (!Array.isArray(bundle.hourly) || bundle.hourly.length === 0) return false;
  if (!bundle.hourly.every((hour) => hour.isForecast === true)) return false;
  if (!Array.isArray(bundle.daily) || !bundle.daily.every((day) => day.isForecast === true)) return false;
  return true;
}

export class MemoryWeatherCache implements WeatherCache {
  private stored: WeatherBundle | null;

  constructor(initial: WeatherBundle | null = null) {
    this.stored = initial;
  }

  async read(): Promise<WeatherBundle | null> {
    return this.stored;
  }

  async write(bundle: WeatherBundle): Promise<void> {
    this.stored = bundle;
  }

  snapshot(): WeatherBundle | null {
    return this.stored;
  }
}

/**
 * Fetch a live Open-Meteo forecast. On network or payload failure, return the
 * last good bundle from the cache when one exists. Never invents weather.
 */
export async function fetchWeatherBundle(
  location: LocationCoords,
  options: FetchWeatherOptions = {},
): Promise<WeatherFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? 12_000;

  try {
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      throw new WeatherDataError('Location coordinates are not usable');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(buildForecastUrl(location), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new WeatherDataError(`Open-Meteo responded with HTTP ${response.status}`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new WeatherDataError('Open-Meteo response was not valid JSON');
    }
    const bundle = parseOpenMeteoForecast(payload, location, now());
    if (options.cache) {
      await options.cache.write(bundle);
    }
    return { bundle, fromCache: false, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Weather request failed';
    const cached = options.cache ? await safeRead(options.cache) : null;
    if (cached && samePlace(cached.location, location)) {
      return {
        bundle: cached,
        fromCache: true,
        error: message,
      };
    }
    return { bundle: null, fromCache: false, error: message };
  }
}

async function safeRead(cache: WeatherCache): Promise<WeatherBundle | null> {
  try {
    const value = await cache.read();
    return isWeatherBundle(value) ? value : null;
  } catch {
    return null;
  }
}

function samePlace(a: LocationCoords, b: LocationCoords): boolean {
  return Math.abs(a.latitude - b.latitude) < 0.05 && Math.abs(a.longitude - b.longitude) < 0.05;
}
