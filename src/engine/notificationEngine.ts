import type {
  DeliveryPlan,
  NotificationAction,
  NotificationEngineInput,
  NotificationEvaluationResult,
  NotificationHistoryEntry,
  ScheduledNotificationRecord,
} from '../types/notifications';
import type { ForecastBundle } from '../types/weather';
import {
  addMinutes,
  hourLabelFromIso,
  isQuietHour,
  nextDepartureUtcIso,
  parseUtcMs,
  rainEventSignature,
  sameLocalDay,
  utcToLocalParts,
} from './clock';
import { assessUmbrella } from './umbrellaDecision';

const DELIVERY_ACTIONS = new Set<NotificationAction>([
  'NOTIFY_NOW',
  'SCHEDULE_BEFORE_RAIN',
  'SCHEDULE_BEFORE_DEPARTURE',
]);

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function maxPopForSignature(weather: ForecastBundle, signature: string, dedupMinutes: number): number | null {
  const offset = finite(weather.utcOffsetSeconds, 0);
  let peak: number | null = null;
  for (const hour of weather.hourly) {
    const hourSignature = rainEventSignature(hour.timeIso, offset, dedupMinutes);
    if (hourSignature !== signature) continue;
    peak = peak === null ? hour.precipitationProbabilityPct : Math.max(peak, hour.precipitationProbabilityPct);
  }
  return peak;
}

function idsToCancel(
  weather: ForecastBundle,
  scheduled: ScheduledNotificationRecord[],
  cancelBelow: number,
  dedupMinutes: number,
  trace: string[],
): string[] {
  const ids: string[] = [];
  for (const item of scheduled) {
    const peak = maxPopForSignature(weather, item.eventSignature, dedupMinutes);
    const dropped = peak === null || peak < cancelBelow;
    if (dropped) {
      ids.push(item.id);
      trace.push(
        peak === null
          ? `Scheduled ${item.id} (${item.eventSignature}) has no hours left in that bucket. Marked for cancellation.`
          : `Scheduled ${item.id} (${item.eventSignature}) now peaks at ${Math.round(peak)}%, under the cancel line of ${cancelBelow}%. Marked for cancellation.`,
      );
    } else {
      trace.push(
        `Scheduled ${item.id} (${item.eventSignature}) still peaks at ${Math.round(peak ?? 0)}%, so it stays.`,
      );
    }
  }
  return ids;
}

function isDuplicate(
  signature: string,
  history: NotificationHistoryEntry[],
  scheduled: ScheduledNotificationRecord[],
  cancelling: Set<string>,
  nowMs: number,
  windowMs: number,
): boolean {
  for (const entry of history) {
    if (entry.eventSignature !== signature) continue;
    if (!DELIVERY_ACTIONS.has(entry.action)) continue;
    const sent = parseUtcMs(entry.sentAtIso);
    if (nowMs >= sent && nowMs - sent < windowMs) return true;
  }
  for (const item of scheduled) {
    if (cancelling.has(item.id)) continue;
    if (item.eventSignature !== signature) continue;
    if (parseUtcMs(item.scheduledForIso) >= nowMs) return true;
  }
  return false;
}

function countTowardCap(
  history: NotificationHistoryEntry[],
  scheduled: ScheduledNotificationRecord[],
  cancelling: Set<string>,
  nowIso: string,
  offset: number,
): number {
  let count = 0;
  for (const entry of history) {
    if (!DELIVERY_ACTIONS.has(entry.action)) continue;
    if (sameLocalDay(entry.sentAtIso, nowIso, offset)) count += 1;
  }
  for (const item of scheduled) {
    if (cancelling.has(item.id)) continue;
    if (sameLocalDay(item.scheduledForIso, nowIso, offset)) count += 1;
  }
  return count;
}

function lastDeliveryMs(history: NotificationHistoryEntry[]): number | null {
  let latest: number | null = null;
  for (const entry of history) {
    if (!DELIVERY_ACTIONS.has(entry.action)) continue;
    const sent = parseUtcMs(entry.sentAtIso);
    if (latest === null || sent > latest) latest = sent;
  }
  return latest;
}

export function evaluateNotification(input: NotificationEngineInput): NotificationEvaluationResult {
  const trace: string[] = [];
  const assessment = assessUmbrella(input.weather, input.preferences, input.config, input.nowIso);
  trace.push(...assessment.trace);
  const decision = assessment.decision;
  const offset = Number.isFinite(input.weather.utcOffsetSeconds) ? input.weather.utcOffsetSeconds : 0;
  const nowMs = parseUtcMs(input.nowIso);
  const local = utcToLocalParts(input.nowIso, offset);
  trace.push(
    `Clock ${input.nowIso} is ${local.date} ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')} local (offset ${offset}s).`,
  );
  if (input.dryRun) trace.push('Dry run is on. The result describes what would happen and must not be sent.');

  const base = {
    dryRun: input.dryRun,
    umbrellaDecision: decision,
  };

  if (!input.preferences.enabled) {
    const cancellationIds = input.scheduled.map((item) => item.id);
    trace.push('Notifications are switched off.');
    if (cancellationIds.length) {
      trace.push(`Clearing ${cancellationIds.length} pending alert(s) because alerts are off.`);
    }
    return {
      ...base,
      shouldNotify: false,
      shouldCancelExisting: cancellationIds.length > 0,
      cancellationIds,
      action: 'SUPPRESSED_DISABLED',
      explanation: cancellationIds.length
        ? 'Notifications are switched off. Pending umbrella alerts will be cleared.'
        : 'Notifications are switched off, so nothing will be sent.',
      debugTrace: trace,
    };
  }

  const cancelBelow = input.config.cancelDropBelowProbabilityPct;
  const cancellationIds = idsToCancel(
    input.weather,
    input.scheduled,
    cancelBelow,
    input.config.deduplicationWindowMinutes,
    trace,
  );
  const cancelling = new Set(cancellationIds);

  const finish = (
    action: NotificationAction,
    shouldNotify: boolean,
    explanation: string,
    extra: Partial<NotificationEvaluationResult> = {},
  ): NotificationEvaluationResult => {
    trace.push(`Action ${action}. shouldNotify=${shouldNotify}.`);
    return {
      ...base,
      shouldNotify,
      shouldCancelExisting: cancellationIds.length > 0,
      cancellationIds,
      action,
      explanation,
      debugTrace: trace,
      ...extra,
    };
  };

  if (decision.state !== 'TAKE_UMBRELLA') {
    if (cancellationIds.length > 0) {
      return finish(
        'CANCEL_SUPERSEDED',
        false,
        decision.state === 'FORECAST_UNCERTAIN'
          ? 'The forecast no longer supports the alert that was queued, and what remains is too uncertain to send a new one.'
          : 'The rain signal has dropped below the cancel line, so the queued alert should be dropped. No new alert is needed.',
      );
    }
    if (decision.state === 'FORECAST_UNCERTAIN') {
      return finish(
        'UNCERTAIN_HOLD',
        false,
        'The forecast is in the uncertain band. Holding off rather than nudging you for a maybe.',
      );
    }
    return finish('NO_RAIN_EXPECTED', false, 'No actionable rain in the lookahead, so no alert.');
  }

  const window = decision.nextRainWindow;
  const startIso = window?.startTimeIso ?? input.nowIso;
  const signature = rainEventSignature(startIso, offset, input.config.deduplicationWindowMinutes);
  trace.push(`Rain-event signature ${signature} (date + ${input.config.deduplicationWindowMinutes} min bucket).`);

  const lead = finite(input.preferences.leadTimeMinutes, input.config.leadTimeMinutes);
  const rainingNow = window?.startLabel === 'now';
  const beforeRainIso = addMinutes(startIso, -lead);
  const beforeRainMs = parseUtcMs(beforeRainIso);
  const departureIso = nextDepartureUtcIso(input.nowIso, input.preferences.usualDepartureTime, offset);
  const beforeDepartureIso = addMinutes(departureIso, -lead);
  const beforeDepartureMs = parseUtcMs(beforeDepartureIso);
  const lookaheadMs = input.config.lookaheadHours * 60 * 60_000;
  const rainMs = parseUtcMs(startIso);
  const departureMs = parseUtcMs(departureIso);
  const affectsDeparture =
    !rainingNow &&
    departureMs - nowMs <= lookaheadMs &&
    rainMs >= departureMs - 60 * 60_000 &&
    rainMs <= departureMs + 2 * 60 * 60_000;

  trace.push(
    `Lead time ${lead} min from preferences. Rain start ${startIso}. Departure ${departureIso} (${affectsDeparture ? 'rain meets the commute' : 'rain is outside the commute window'}).`,
  );

  let timingAction: 'NOTIFY_NOW' | 'SCHEDULE_BEFORE_RAIN' | 'SCHEDULE_BEFORE_DEPARTURE';
  let whenIso: string;
  if (rainingNow || beforeRainMs <= nowMs) {
    timingAction = 'NOTIFY_NOW';
    whenIso = input.nowIso;
    trace.push('Rain has started or the lead time has already passed, so the alert is immediate.');
  } else if (affectsDeparture && beforeDepartureMs > nowMs && beforeDepartureMs <= beforeRainMs) {
    timingAction = 'SCHEDULE_BEFORE_DEPARTURE';
    whenIso = beforeDepartureIso;
    trace.push(
      `Scheduling ${lead} min before departure (${hourLabelFromIso(beforeDepartureIso, offset)}), which is earlier than the rain lead time.`,
    );
  } else {
    timingAction = 'SCHEDULE_BEFORE_RAIN';
    whenIso = beforeRainIso;
    trace.push(`Scheduling ${lead} min before the rain window (${hourLabelFromIso(beforeRainIso, offset)}).`);
  }

  const title = 'Rainy innit';
  const body = decision.headline;

  const windowMs = input.config.deduplicationWindowMinutes * 60_000;
  if (isDuplicate(signature, input.history, input.scheduled, cancelling, nowMs, windowMs)) {
    trace.push('The same rain window was already sent or is already queued inside the dedupe window.');
    return finish('SUPPRESSED_DUPLICATE', false, 'Already covered this rain window. No second nudge.', {
      eventSignature: signature,
      scheduledForIso: whenIso,
      title,
      body,
    });
  }

  const cap = Math.min(
    finite(input.preferences.maxDailyNotifications, input.config.maxNotificationsPerDay),
    input.config.maxNotificationsPerDay,
  );
  const used = countTowardCap(input.history, input.scheduled, cancelling, input.nowIso, offset);
  trace.push(`Daily cap is ${cap} (the lower of the preference and config.maxNotificationsPerDay). Used today: ${used}.`);
  if (used >= cap) {
    return finish(
      'SUPPRESSED_DAILY_CAP',
      false,
      `Already used ${used} of ${cap} umbrella alerts today.`,
      { eventSignature: signature, title, body },
    );
  }

  const cooldownMs = input.config.cooldownMinutes * 60_000;
  const lastMs = lastDeliveryMs(input.history);
  if (lastMs !== null && nowMs - lastMs < cooldownMs) {
    const minsAgo = Math.round((nowMs - lastMs) / 60_000);
    trace.push(`Last alert was ${minsAgo} min ago. Cooldown is ${input.config.cooldownMinutes} min.`);
    return finish(
      'SUPPRESSED_COOLDOWN',
      false,
      `An alert went out ${minsAgo} minutes ago. Cooling off for ${input.config.cooldownMinutes} minutes.`,
      { eventSignature: signature, title, body },
    );
  }

  const quietStart = input.preferences.quietHoursStart || input.config.quietHoursStart;
  const quietEnd = input.preferences.quietHoursEnd || input.config.quietHoursEnd;
  const fireLocal = utcToLocalParts(whenIso, offset);
  if (isQuietHour(fireLocal.minutesOfDay, quietStart, quietEnd)) {
    trace.push(
      `Fire time ${fireLocal.date} ${String(fireLocal.hour).padStart(2, '0')}:${String(fireLocal.minute).padStart(2, '0')} sits in quiet hours ${quietStart}–${quietEnd}.`,
    );
    return finish(
      'SUPPRESSED_QUIET_HOURS',
      false,
      `That alert would land in quiet hours (${quietStart}–${quietEnd}), so it stays quiet.`,
      { eventSignature: signature, scheduledForIso: whenIso, title, body },
    );
  }

  const whenLabel = timingAction === 'NOTIFY_NOW' ? 'now' : hourLabelFromIso(whenIso, offset);
  return finish(timingAction, true, `${decision.headline} Alert ${timingAction === 'NOTIFY_NOW' ? 'goes now' : `set for ${whenLabel}`}.`, {
    scheduledForIso: whenIso,
    title,
    body,
    eventSignature: signature,
  });
}

export function planDelivery(result: NotificationEvaluationResult): DeliveryPlan {
  if (result.dryRun) {
    return { kind: 'none', cancelIds: [], recordHistory: false };
  }
  const cancelIds = result.shouldCancelExisting ? result.cancellationIds : [];
  if (
    result.shouldNotify &&
    result.title &&
    result.body &&
    result.action === 'NOTIFY_NOW'
  ) {
    return {
      kind: 'present',
      title: result.title,
      body: result.body,
      fireAtIso: result.scheduledForIso,
      eventSignature: result.eventSignature,
      cancelIds,
      recordHistory: true,
    };
  }
  if (
    result.shouldNotify &&
    result.title &&
    result.body &&
    result.scheduledForIso &&
    (result.action === 'SCHEDULE_BEFORE_RAIN' || result.action === 'SCHEDULE_BEFORE_DEPARTURE')
  ) {
    return {
      kind: 'schedule',
      title: result.title,
      body: result.body,
      fireAtIso: result.scheduledForIso,
      eventSignature: result.eventSignature,
      cancelIds,
      recordHistory: true,
    };
  }
  if (cancelIds.length > 0) {
    return { kind: 'cancel', cancelIds, recordHistory: false };
  }
  return { kind: 'none', cancelIds: [], recordHistory: false };
}
