import { addHours, dayLabelFor, hourLabelFromIso, utcToLocalParts } from '../engine/clock';
import type { LocationCoords, SimulatedWeatherBundle } from '../types/weather';
import { conditionLabel, intensityFromMm } from './weatherCodes';
import { assertObservationForecastSeparation } from './weatherService';

/**
 * QA-only simulated forecasts for the notification debugger.
 * These are labelled `provider: 'simulation'` and must never be shown as
 * the live Open-Meteo observation on the home screen.
 */
export type SimulationScenario =
  | 'heavy_rain_soon'
  | 'light_drizzle'
  | 'uncertain_mid'
  | 'bone_dry'
  | 'currently_raining'
  | 'shower_in_two_hours'
  | 'imminent_rain'
  | 'rain_cleared';

export const SIMULATION_SCENARIOS: { id: SimulationScenario; label: string; blurb: string }[] = [
  { id: 'heavy_rain_soon', label: 'Heavy rain in 2 hours', blurb: 'Proper soaking, high chance.' },
  { id: 'light_drizzle', label: 'Light drizzle', blurb: 'Under 0.5 mm/h. The ignore-drizzle switch matters.' },
  { id: 'uncertain_mid', label: 'Uncertain, mid chance', blurb: 'Around 48%. Inside the dodgy band.' },
  { id: 'bone_dry', label: 'Bone dry', blurb: 'A quiet sky.' },
  { id: 'currently_raining', label: 'Raining now', blurb: 'Live-style observation already wet.' },
  { id: 'shower_in_two_hours', label: 'Shower in two hours', blurb: 'Useful against a morning departure.' },
  { id: 'imminent_rain', label: 'Rain within the hour', blurb: 'Lead time has usually already passed.' },
  { id: 'rain_cleared', label: 'Rain cleared', blurb: 'Future hours gone dry. Use it to test cancellation.' },
];

const LONDON: LocationCoords = {
  name: 'London',
  region: 'England',
  country: 'United Kingdom',
  latitude: 51.5074,
  longitude: -0.1278,
};

interface HourSeed {
  pop: number;
  mm: number;
  code?: number;
  temp?: number;
}

export interface SimulationOptions {
  nowIso?: string;
  location?: LocationCoords;
  utcOffsetSeconds?: number;
}

export function createSimulatedRainForecast(
  scenario: SimulationScenario,
  options: SimulationOptions = {},
): SimulatedWeatherBundle {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const location = options.location ?? LONDON;
  const utcOffsetSeconds = options.utcOffsetSeconds ?? 0;
  const seeds = seedsFor(scenario);
  const currentSeed = seeds.current;

  const hourly = seeds.hours.map((seed, index) => {
    const timeIso = addHours(floorToHour(nowIso), index);
    const mm = seed.mm;
    const code = seed.code ?? codeFor(mm);
    return {
      timeIso,
      hourLabel: hourLabelFromIso(timeIso, utcOffsetSeconds),
      temperatureC: seed.temp ?? 13,
      precipitationProbabilityPct: seed.pop,
      precipitationMm: mm,
      rainMm: mm,
      showersMm: 0,
      weatherCode: code,
      conditionLabel: conditionLabel(code),
      intensityLevel: intensityFromMm(mm),
      isForecast: true as const,
    };
  });

  const today = utcToLocalParts(nowIso, utcOffsetSeconds).date;
  const daily = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const date = new Date(Date.parse(`${today}T00:00:00.000Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    const wet = offset === 0 && scenario !== 'bone_dry' && scenario !== 'rain_cleared';
    const code = wet ? 63 : 2;
    return {
      dateIso: date,
      dayLabel: dayLabelFor(date, today),
      weatherCode: code,
      conditionLabel: conditionLabel(code),
      tempMinC: 8,
      tempMaxC: 15,
      maxPrecipitationProbabilityPct: wet ? 80 : 15,
      totalPrecipitationMm: wet ? 4 : 0,
      isForecast: true as const,
    };
  });

  const currentCode = currentSeed.code ?? codeFor(currentSeed.mm);
  const bundle: SimulatedWeatherBundle = {
    provider: 'simulation',
    simulationScenario: scenario,
    simulationLabel: `SIMULATED — not a live forecast (${scenario.replace(/_/g, ' ')})`,
    location,
    fetchedAtIso: nowIso,
    timezone: 'UTC',
    utcOffsetSeconds,
    modelConfidence: 'high',
    current: {
      timestamp: nowIso,
      temperatureC: currentSeed.temp ?? 13,
      apparentTemperatureC: (currentSeed.temp ?? 13) - 1,
      weatherCode: currentCode,
      conditionLabel: conditionLabel(currentCode),
      isRainingNow: scenario === 'currently_raining',
      currentPrecipitationMm: currentSeed.mm,
      currentRainProbabilityPct: currentSeed.pop,
      windSpeedKmh: 14,
      isLiveObservation: true,
    },
    hourly,
    daily,
  };
  assertObservationForecastSeparation(bundle);
  return bundle;
}

function floorToHour(iso: string): string {
  const date = new Date(iso);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function codeFor(mm: number): number {
  if (mm >= 4) return 65;
  if (mm >= 0.5) return 63;
  if (mm >= 0.1) return 51;
  return 1;
}

function blankHours(pop: number, mm: number): HourSeed[] {
  return Array.from({ length: 24 }, () => ({ pop, mm }));
}

function paint(hours: HourSeed[], start: number, end: number, seed: HourSeed): void {
  for (let index = start; index <= end && index < hours.length; index += 1) {
    hours[index] = seed;
  }
}

function seedsFor(scenario: SimulationScenario): { current: HourSeed; hours: HourSeed[] } {
  const hours = blankHours(8, 0);
  const dry = { pop: 5, mm: 0, code: 1, temp: 14 };
  switch (scenario) {
    case 'heavy_rain_soon': {
      paint(hours, 2, 4, { pop: 88, mm: 6, code: 65, temp: 12 });
      return { current: dry, hours };
    }
    case 'light_drizzle': {
      paint(hours, 1, 5, { pop: 78, mm: 0.3, code: 51, temp: 12 });
      return { current: { pop: 40, mm: 0, code: 2, temp: 12 }, hours };
    }
    case 'uncertain_mid': {
      paint(hours, 2, 4, { pop: 48, mm: 1.2, code: 61, temp: 13 });
      return { current: dry, hours };
    }
    case 'bone_dry': {
      return { current: dry, hours: blankHours(6, 0) };
    }
    case 'currently_raining': {
      paint(hours, 0, 2, { pop: 82, mm: 2.2, code: 63, temp: 11 });
      return { current: { pop: 82, mm: 2.2, code: 63, temp: 11 }, hours };
    }
    case 'shower_in_two_hours': {
      paint(hours, 2, 3, { pop: 80, mm: 1.6, code: 63, temp: 12 });
      return { current: dry, hours };
    }
    case 'imminent_rain': {
      paint(hours, 1, 2, { pop: 86, mm: 2.4, code: 63, temp: 12 });
      return { current: { pop: 55, mm: 0, code: 3, temp: 12 }, hours };
    }
    case 'rain_cleared': {
      return { current: { pop: 10, mm: 0, code: 2, temp: 13 }, hours: blankHours(8, 0) };
    }
    default: {
      const never: never = scenario;
      throw new Error(`Unknown simulation scenario ${String(never)}`);
    }
  }
}
