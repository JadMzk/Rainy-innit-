import { rainEventSignature } from '../src/engine/clock';
import { evaluateNotification, planDelivery } from '../src/engine/notificationEngine';
import { hour, engineInput, historyEntry, makeBundle, NOW, scheduled } from './fixtures';

const rainLater = () => makeBundle({ hourly: [hour(0, 5, 0), hour(8, 86, 4.2), hour(9, 70, 1.5)] });

describe('notification engine', () => {
  test('schedules a lead time before rain when it misses the commute', () => {
    const result = evaluateNotification(engineInput({ weather: rainLater() }));
    expect(result.action).toBe('SCHEDULE_BEFORE_RAIN');
    expect(result.shouldNotify).toBe(true);
    expect(result.scheduledForIso).toBe('2026-10-23T14:15:00.000Z');
    expect(result.eventSignature).toBe('2026-10-23|rain-3');
    expect(result.title).toBe('Rainy innit');
    expect(result.body).toContain('Take your umbrella');
    expect(result.debugTrace.length).toBeGreaterThan(3);
    expect(result.explanation.length).toBeGreaterThan(10);
  });

  test('schedules before departure when rain meets the commute', () => {
    const nowIso = '2026-10-23T06:30:00.000Z';
    const result = evaluateNotification(
      engineInput({
        nowIso,
        weather: makeBundle({
          fetchedAtIso: nowIso,
          hourly: [hour(0, 5, 0, nowIso), hour(2, 80, 1.6, nowIso)],
          current: {
            timestamp: nowIso,
            temperatureC: 11,
            apparentTemperatureC: 10,
            weatherCode: 2,
            conditionLabel: 'Partly cloudy',
            isRainingNow: false,
            currentPrecipitationMm: 0,
            currentRainProbabilityPct: 10,
            windSpeedKmh: 8,
            isLiveObservation: true,
          },
        }),
      }),
    );
    expect(result.umbrellaDecision.state).toBe('TAKE_UMBRELLA');
    expect(result.action).toBe('SCHEDULE_BEFORE_DEPARTURE');
    expect(result.scheduledForIso).toBe('2026-10-23T07:15:00.000Z');
  });

  test('notifies immediately when the lead time has already passed', () => {
    const nowIso = '2026-10-23T07:40:00.000Z';
    const result = evaluateNotification(
      engineInput({
        nowIso,
        weather: makeBundle({
          fetchedAtIso: nowIso,
          hourly: [hour(0, 10, 0, '2026-10-23T07:00:00.000Z'), hour(1, 84, 2, '2026-10-23T07:00:00.000Z')],
        }),
      }),
    );
    expect(result.action).toBe('NOTIFY_NOW');
    expect(result.shouldNotify).toBe(true);
    expect(result.scheduledForIso).toBe(nowIso);
  });

  test('dry forecasts do not notify', () => {
    const result = evaluateNotification(engineInput());
    expect(result.action).toBe('NO_RAIN_EXPECTED');
    expect(result.shouldNotify).toBe(false);
    expect(result.shouldCancelExisting).toBe(false);
  });

  test('an uncertain forecast holds', () => {
    const result = evaluateNotification(
      engineInput({ weather: makeBundle({ hourly: [hour(2, 48, 1.2)] }) }),
    );
    expect(result.action).toBe('UNCERTAIN_HOLD');
    expect(result.shouldNotify).toBe(false);
  });

  test('a dropped forecast cancels the queued alert', () => {
    const signature = rainEventSignature('2026-10-23T15:00:00.000Z', 0, 240);
    const result = evaluateNotification(
      engineInput({
        weather: makeBundle({ hourly: [hour(0, 8, 0), hour(8, 10, 0)] }),
        scheduled: [scheduled({ id: 'sched-1', eventSignature: signature, peakProbabilityPct: 80 })],
      }),
    );
    expect(result.shouldCancelExisting).toBe(true);
    expect(result.cancellationIds).toEqual(['sched-1']);
    expect(result.action).toBe('CANCEL_SUPERSEDED');
    expect(result.shouldNotify).toBe(false);
  });

  test('a forecast that only falls into the uncertain band does not cancel', () => {
    const signature = rainEventSignature('2026-10-23T09:00:00.000Z', 0, 240);
    const result = evaluateNotification(
      engineInput({
        weather: makeBundle({ hourly: [hour(2, 48, 1.2)] }),
        scheduled: [scheduled({ id: 'sched-keep', eventSignature: signature })],
      }),
    );
    expect(result.action).toBe('UNCERTAIN_HOLD');
    expect(result.shouldCancelExisting).toBe(false);
    expect(result.cancellationIds).toEqual([]);
  });

  test('duplicate rain windows are suppressed', () => {
    const signature = '2026-10-23|rain-3';
    const result = evaluateNotification(
      engineInput({
        weather: rainLater(),
        history: [historyEntry({ eventSignature: signature, sentAtIso: '2026-10-23T06:40:00.000Z' })],
      }),
    );
    expect(result.action).toBe('SUPPRESSED_DUPLICATE');
    expect(result.shouldNotify).toBe(false);
  });

  test('an already queued signature is also a duplicate', () => {
    const result = evaluateNotification(
      engineInput({
        weather: rainLater(),
        scheduled: [scheduled({ id: 'already', eventSignature: '2026-10-23|rain-3', scheduledForIso: '2026-10-23T14:15:00.000Z' })],
      }),
    );
    expect(result.action).toBe('SUPPRESSED_DUPLICATE');
  });

  test('the daily cap is enforced from config and preferences', () => {
    const result = evaluateNotification(
      engineInput({
        weather: rainLater(),
        history: [
          historyEntry({ id: 'a', eventSignature: '2026-10-23|rain-0', sentAtIso: '2026-10-23T01:00:00.000Z' }),
          historyEntry({ id: 'b', eventSignature: '2026-10-23|rain-1', sentAtIso: '2026-10-23T02:00:00.000Z' }),
        ],
      }),
    );
    expect(result.action).toBe('SUPPRESSED_DAILY_CAP');
    expect(result.shouldNotify).toBe(false);
  });

  test('cooldown suppresses a different rain window', () => {
    const result = evaluateNotification(
      engineInput({
        weather: rainLater(),
        preferences: {
          ...engineInput().preferences,
          maxDailyNotifications: 2,
        },
        config: { ...engineInput().config, maxNotificationsPerDay: 5 },
        history: [historyEntry({ eventSignature: '2026-10-23|rain-0', sentAtIso: '2026-10-23T06:00:00.000Z' })],
      }),
    );
    expect(result.action).toBe('SUPPRESSED_COOLDOWN');
  });

  test('quiet hours suppress an immediate alert', () => {
    const nowIso = '2026-10-23T23:30:00.000Z';
    const result = evaluateNotification(
      engineInput({
        nowIso,
        weather: makeBundle({
          fetchedAtIso: nowIso,
          hourly: [hour(0, 20, 0, nowIso)],
          current: {
            timestamp: nowIso,
            temperatureC: 10,
            apparentTemperatureC: 9,
            weatherCode: 63,
            conditionLabel: 'Rain',
            isRainingNow: true,
            currentPrecipitationMm: 1.8,
            currentRainProbabilityPct: 80,
            windSpeedKmh: 16,
            isLiveObservation: true,
          },
        }),
      }),
    );
    expect(result.umbrellaDecision.state).toBe('TAKE_UMBRELLA');
    expect(result.action).toBe('SUPPRESSED_QUIET_HOURS');
    expect(result.shouldNotify).toBe(false);
  });

  test('dry run reports the send but does not plan delivery', () => {
    const result = evaluateNotification(engineInput({ weather: rainLater(), dryRun: true }));
    expect(result.dryRun).toBe(true);
    expect(result.shouldNotify).toBe(true);
    expect(result.action).toBe('SCHEDULE_BEFORE_RAIN');
    expect(planDelivery(result)).toEqual({ kind: 'none', cancelIds: [], recordHistory: false });
  });

  test('a real schedule plans delivery and a cancellation plans a cancel', () => {
    const scheduledResult = evaluateNotification(engineInput({ weather: rainLater() }));
    const plan = planDelivery(scheduledResult);
    expect(plan.kind).toBe('schedule');
    expect(plan.fireAtIso).toBe('2026-10-23T14:15:00.000Z');
    expect(plan.recordHistory).toBe(true);

    const cancelResult = evaluateNotification(
      engineInput({
        scheduled: [scheduled({ id: 'gone', eventSignature: '2026-10-23|rain-1' })],
      }),
    );
    expect(planDelivery(cancelResult).kind).toBe('cancel');
    expect(planDelivery(cancelResult).cancelIds).toEqual(['gone']);
  });

  test('switched-off notifications suppress and clear the queue', () => {
    const result = evaluateNotification(
      engineInput({
        weather: rainLater(),
        preferences: { ...engineInput().preferences, enabled: false },
        scheduled: [scheduled({ id: 'pending', eventSignature: '2026-10-23|rain-3' })],
      }),
    );
    expect(result.action).toBe('SUPPRESSED_DISABLED');
    expect(result.shouldNotify).toBe(false);
    expect(result.shouldCancelExisting).toBe(true);
    expect(result.cancellationIds).toEqual(['pending']);
  });

  test('debug trace names the config fields it used', () => {
    const result = evaluateNotification(engineInput({ weather: rainLater() }));
    const trace = result.debugTrace.join('\n');
    expect(trace).toContain('probThresholdStandardPct');
    expect(trace).toContain('config.lookaheadHours');
    expect(trace).toContain('rain-3');
  });
});
