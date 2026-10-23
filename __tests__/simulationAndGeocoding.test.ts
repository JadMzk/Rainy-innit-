import { DEFAULT_NOTIFICATION_CONFIG, DEFAULT_PREFERENCES } from '../src/config/defaults';
import { evaluateNotification } from '../src/engine/notificationEngine';
import { evaluateUmbrellaDecision } from '../src/engine/umbrellaDecision';
import { parseGeocodingResults } from '../src/services/geocoding';
import { createSimulatedRainForecast, SIMULATION_SCENARIOS } from '../src/services/simulationPresets';
import { isWeatherBundle } from '../src/services/weatherService';

const NOW = '2026-10-23T07:00:00.000Z';

describe('simulated forecasts', () => {
  test('every preset is labelled simulation and is not a production bundle', () => {
    for (const scenario of SIMULATION_SCENARIOS) {
      const bundle = createSimulatedRainForecast(scenario.id, { nowIso: NOW, utcOffsetSeconds: 0 });
      expect(bundle.provider).toBe('simulation');
      expect(bundle.simulationLabel).toContain('SIMULATED');
      expect(bundle.simulationScenario).toBe(scenario.id);
      expect(isWeatherBundle(bundle)).toBe(false);
      expect(bundle.current.isLiveObservation).toBe(true);
      expect(bundle.hourly.every((hour) => hour.isForecast)).toBe(true);
      expect(bundle.daily.every((day) => day.isForecast)).toBe(true);
    }
  });

  test('presets drive the umbrella states the debugger needs', () => {
    const prefs = { ...DEFAULT_PREFERENCES };
    const config = { ...DEFAULT_NOTIFICATION_CONFIG };
    const state = (id: Parameters<typeof createSimulatedRainForecast>[0], ignore = false) =>
      evaluateUmbrellaDecision(
        createSimulatedRainForecast(id, { nowIso: NOW }),
        { ...prefs, ignoreLightDrizzle: ignore },
        config,
        NOW,
      ).state;

    expect(state('heavy_rain_soon')).toBe('TAKE_UMBRELLA');
    expect(state('light_drizzle')).toBe('TAKE_UMBRELLA');
    expect(state('light_drizzle', true)).toBe('NO_UMBRELLA_NEEDED');
    expect(state('uncertain_mid')).toBe('FORECAST_UNCERTAIN');
    expect(state('bone_dry')).toBe('NO_UMBRELLA_NEEDED');
    expect(state('currently_raining')).toBe('TAKE_UMBRELLA');
    expect(state('rain_cleared')).toBe('NO_UMBRELLA_NEEDED');
  });

  test('a cleared simulation cancels a previously scheduled alert', () => {
    const weather = createSimulatedRainForecast('rain_cleared', { nowIso: NOW });
    const result = evaluateNotification({
      weather,
      preferences: DEFAULT_PREFERENCES,
      config: DEFAULT_NOTIFICATION_CONFIG,
      history: [],
      scheduled: [
        {
          id: 'queued-rain',
          eventSignature: '2026-10-23|rain-2',
          scheduledForIso: '2026-10-23T12:00:00.000Z',
          peakProbabilityPct: 80,
          title: 'Rainy innit',
          body: 'Take your umbrella.',
          createdAtIso: NOW,
        },
      ],
      nowIso: NOW,
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.shouldCancelExisting).toBe(true);
    expect(result.cancellationIds).toEqual(['queued-rain']);
    expect(result.action).toBe('CANCEL_SUPERSEDED');
    expect(result.shouldNotify).toBe(false);
  });
});

describe('geocoding', () => {
  test('parses Open-Meteo search results and ignores junk rows', () => {
    const places = parseGeocodingResults({
      results: [
        { name: 'York', latitude: 53.96, longitude: -1.08, admin1: 'England', country: 'United Kingdom' },
        { name: 'Broken' },
        null,
      ],
    });
    expect(places).toEqual([
      {
        name: 'York',
        latitude: 53.96,
        longitude: -1.08,
        region: 'England',
        country: 'United Kingdom',
      },
    ]);
    expect(parseGeocodingResults(null)).toEqual([]);
    expect(parseGeocodingResults({ results: 'nope' })).toEqual([]);
  });
});
