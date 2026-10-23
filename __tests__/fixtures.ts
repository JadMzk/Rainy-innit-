import { addHours } from '../src/engine/clock';
import { intensityFromMm } from '../src/services/weatherCodes';
import { DEFAULT_NOTIFICATION_CONFIG, DEFAULT_PREFERENCES } from '../src/config/defaults';
import type { NotificationEngineInput, NotificationHistoryEntry, ScheduledNotificationRecord } from '../src/types/notifications';
import type { CurrentObservation, DailyForecastPoint, HourlyForecastPoint, WeatherBundle } from '../src/types/weather';

export const NOW = '2026-10-23T07:00:00.000Z';

export const LONDON = {
  name: 'London',
  region: 'England',
  country: 'United Kingdom',
  latitude: 51.5074,
  longitude: -0.1278,
};

export function hour(offsetHours: number, pop: number, mm: number, fromIso = NOW): HourlyForecastPoint {
  const timeIso = addHours(fromIso, offsetHours);
  const code = mm >= 4 ? 65 : mm >= 0.5 ? 63 : mm >= 0.1 ? 51 : 1;
  return {
    timeIso,
    hourLabel: timeIso.slice(11, 16),
    temperatureC: 12,
    precipitationProbabilityPct: pop,
    precipitationMm: mm,
    rainMm: mm,
    showersMm: 0,
    weatherCode: code,
    conditionLabel: mm >= 0.1 ? 'Rain' : 'Mainly clear',
    intensityLevel: intensityFromMm(mm),
    isForecast: true,
  };
}

const dryCurrent: CurrentObservation = {
  timestamp: NOW,
  temperatureC: 12,
  apparentTemperatureC: 11,
  weatherCode: 1,
  conditionLabel: 'Mainly clear',
  isRainingNow: false,
  currentPrecipitationMm: 0,
  currentRainProbabilityPct: 5,
  windSpeedKmh: 12,
  isLiveObservation: true,
};

const daily: DailyForecastPoint = {
  dateIso: '2026-10-23',
  dayLabel: 'Today',
  weatherCode: 2,
  conditionLabel: 'Partly cloudy',
  tempMinC: 8,
  tempMaxC: 15,
  maxPrecipitationProbabilityPct: 20,
  totalPrecipitationMm: 0,
  isForecast: true,
};

export function makeBundle(overrides: Partial<WeatherBundle> = {}): WeatherBundle {
  const hourly = overrides.hourly ?? [hour(0, 5, 0), hour(1, 5, 0), hour(3, 5, 0)];
  return {
    location: LONDON,
    fetchedAtIso: NOW,
    provider: 'open-meteo',
    timezone: 'UTC',
    utcOffsetSeconds: 0,
    modelConfidence: 'high',
    current: dryCurrent,
    hourly,
    daily: [daily],
    ...overrides,
  };
}

export function engineInput(overrides: Partial<NotificationEngineInput> = {}): NotificationEngineInput {
  return {
    weather: makeBundle(),
    preferences: { ...DEFAULT_PREFERENCES, homeLocation: LONDON },
    config: { ...DEFAULT_NOTIFICATION_CONFIG },
    history: [],
    scheduled: [],
    nowIso: NOW,
    dryRun: false,
    ...overrides,
  };
}

export function historyEntry(partial: Partial<NotificationHistoryEntry> & Pick<NotificationHistoryEntry, 'eventSignature' | 'sentAtIso'>): NotificationHistoryEntry {
  return {
    id: partial.id ?? `hist-${partial.sentAtIso}`,
    action: partial.action ?? 'NOTIFY_NOW',
    title: 'Rainy innit',
    body: 'Take your umbrella.',
    ...partial,
  };
}

export function scheduled(partial: Partial<ScheduledNotificationRecord> & Pick<ScheduledNotificationRecord, 'id' | 'eventSignature'>): ScheduledNotificationRecord {
  return {
    scheduledForIso: '2026-10-23T14:15:00.000Z',
    peakProbabilityPct: 80,
    title: 'Rainy innit',
    body: 'Take your umbrella.',
    createdAtIso: NOW,
    ...partial,
  };
}
