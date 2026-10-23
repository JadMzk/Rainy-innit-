import { DEFAULT_NOTIFICATION_CONFIG, DEFAULT_PREFERENCES } from '../src/config/defaults';
import { evaluateUmbrellaDecision } from '../src/engine/umbrellaDecision';
import type { NotificationEngineConfig, UserNotificationPreferences } from '../src/types/notifications';
import { hour, makeBundle, NOW } from './fixtures';

function decide(
  hourly: ReturnType<typeof hour>[],
  prefs: Partial<UserNotificationPreferences> = {},
  config: Partial<NotificationEngineConfig> = {},
  bundlePatch: Parameters<typeof makeBundle>[0] = {},
  nowIso = NOW,
) {
  return evaluateUmbrellaDecision(
    makeBundle({ hourly, ...bundlePatch }),
    { ...DEFAULT_PREFERENCES, ...prefs },
    { ...DEFAULT_NOTIFICATION_CONFIG, ...config },
    nowIso,
  );
}

describe('umbrella decision', () => {
  test('heavy rain above the standard threshold says take the umbrella', () => {
    const decision = decide([hour(0, 10, 0), hour(2, 88, 6), hour(3, 70, 2)]);
    expect(decision.state).toBe('TAKE_UMBRELLA');
    expect(decision.headline).toBe(
      'Take your umbrella. Rain is expected around 09:00, with a 88% probability of precipitation.',
    );
    expect(decision.britishSubtext).toBe('Proper chucking it down soon.');
    expect(decision.nextRainWindow?.intensity).toBe('heavy');
    expect(decision.nextRainWindow?.peakProbabilityPct).toBe(88);
  });

  test('a dry forecast needs no umbrella', () => {
    const decision = decide([hour(0, 8, 0), hour(4, 12, 0), hour(8, 5, 0)]);
    expect(decision.state).toBe('NO_UMBRELLA_NEEDED');
    expect(decision.headline).toBe("You're probably fine without an umbrella today.");
    expect(decision.britishSubtext).toBe('Bone dry, mate.');
    expect(decision.nextRainWindow).toBeUndefined();
  });

  test('35% to 59% with meaningful rain is uncertain for medium sensitivity', () => {
    const lowEdge = decide([hour(2, 35, 1.2)]);
    const highEdge = decide([hour(2, 59, 1.2)]);
    const below = decide([hour(2, 34, 1.2)]);
    expect(lowEdge.state).toBe('FORECAST_UNCERTAIN');
    expect(highEdge.state).toBe('FORECAST_UNCERTAIN');
    expect(highEdge.headline).toBe('The forecast is uncertain. Check again before leaving.');
    expect(highEdge.britishSubtext).toBe("Bit dodgy — skies can't make their mind up.");
    expect(below.state).toBe('NO_UMBRELLA_NEEDED');
  });

  test('60% is enough to take it, and the threshold is read from config', () => {
    expect(decide([hour(2, 60, 1.1)]).state).toBe('TAKE_UMBRELLA');
    const raised = decide([hour(2, 85, 2)], {}, { probThresholdStandardPct: 90 });
    expect(raised.state).toBe('FORECAST_UNCERTAIN');
    const lowered = decide([hour(2, 15, 1)], {}, { probThresholdStandardPct: 10, uncertaintyBandMinPct: 5 });
    expect(lowered.state).toBe('TAKE_UMBRELLA');
  });

  test('sensitivity moves the threshold', () => {
    const hours = [hour(2, 45, 1.4)];
    expect(decide(hours, { rainSensitivity: 'high' }).state).toBe('TAKE_UMBRELLA');
    expect(decide(hours, { rainSensitivity: 'medium' }).state).toBe('FORECAST_UNCERTAIN');
    expect(decide(hours, { rainSensitivity: 'low' }).state).toBe('FORECAST_UNCERTAIN');
    expect(decide([hour(2, 80, 2)], { rainSensitivity: 'low' }).state).toBe('TAKE_UMBRELLA');
    expect(decide([hour(2, 70, 2)], { rainSensitivity: 'low' }).state).toBe('FORECAST_UNCERTAIN');
  });

  test('light drizzle is ignored only when the user asks', () => {
    const hours = [hour(1, 80, 0.3), hour(2, 75, 0.2)];
    const ignored = decide(hours, { ignoreLightDrizzle: true });
    const counted = decide(hours, { ignoreLightDrizzle: false });
    expect(ignored.state).toBe('NO_UMBRELLA_NEEDED');
    expect(ignored.britishSubtext).toMatch(/drizzle/i);
    expect(counted.state).toBe('TAKE_UMBRELLA');
    expect(counted.nextRainWindow?.intensity).toBe('light');
  });

  test('heavy rain is not treated as drizzle', () => {
    const decision = decide([hour(2, 92, 8)], { ignoreLightDrizzle: true, rainSensitivity: 'low' });
    expect(decision.state).toBe('TAKE_UMBRELLA');
    expect(decision.britishSubtext).toBe('Proper chucking it down soon.');
  });

  test('a fresh live observation of rain beats a dry hourly forecast', () => {
    const decision = decide([hour(1, 10, 0), hour(2, 10, 0)], {}, {}, {
      current: {
        timestamp: NOW,
        temperatureC: 11,
        apparentTemperatureC: 10,
        weatherCode: 63,
        conditionLabel: 'Rain',
        isRainingNow: true,
        currentPrecipitationMm: 1.6,
        currentRainProbabilityPct: 77,
        windSpeedKmh: 20,
        isLiveObservation: true,
      },
    });
    expect(decision.state).toBe('TAKE_UMBRELLA');
    expect(decision.headline).toContain('around now');
    expect(decision.reason).toMatch(/live observation/i);
    expect(decision.nextRainWindow?.startLabel).toBe('now');
  });

  test('a stale observation and an empty lookahead stay uncertain', () => {
    const old = '2026-10-20T07:00:00.000Z';
    const decision = decide([hour(0, 90, 5, old)], {}, {}, {
      fetchedAtIso: old,
      current: {
        timestamp: old,
        temperatureC: 11,
        apparentTemperatureC: 10,
        weatherCode: 65,
        conditionLabel: 'Heavy rain',
        isRainingNow: true,
        currentPrecipitationMm: 6,
        currentRainProbabilityPct: 90,
        windSpeedKmh: 20,
        isLiveObservation: true,
      },
    });
    expect(decision.state).toBe('FORECAST_UNCERTAIN');
    expect(decision.confidence).toBe('low');
  });

  test('high probability with a trace amount is uncertain rather than a confident no', () => {
    const decision = decide([hour(2, 85, 0)]);
    expect(decision.state).toBe('FORECAST_UNCERTAIN');
  });
});
