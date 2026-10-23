import type { NotificationEngineConfig, UserNotificationPreferences } from '../types/notifications';
import type {
  ForecastBundle,
  HourlyForecastPoint,
  IntensityLevel,
  UmbrellaDecision,
  UmbrellaRecommendationState,
} from '../types/weather';
import { hourLabelFromIso, parseUtcMs } from './clock';
import { intensityFromMm } from '../services/weatherCodes';

export interface UmbrellaAssessment {
  decision: UmbrellaDecision;
  trace: string[];
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function thresholdForSensitivity(
  sensitivity: UserNotificationPreferences['rainSensitivity'],
  config: NotificationEngineConfig,
): { pct: number; source: string } {
  if (sensitivity === 'high') {
    return { pct: config.probThresholdSensitivePct, source: 'probThresholdSensitivePct' };
  }
  if (sensitivity === 'low') {
    return { pct: config.probThresholdRelaxedPct, source: 'probThresholdRelaxedPct' };
  }
  return { pct: config.probThresholdStandardPct, source: 'probThresholdStandardPct' };
}

/**
 * Expected millimetres are an ensemble mean, so a modest total can still be
 * a real shower. The floor removes trace amounts. Drizzle the user asked to
 * ignore is measurable but deliberately not actionable.
 */
export function precipitationMatters(
  mm: number,
  intensity: IntensityLevel,
  ignoreLightDrizzle: boolean,
  config: NotificationEngineConfig,
): { matters: boolean; ignoredDrizzle: boolean } {
  const solid = intensity === 'moderate' || intensity === 'heavy';
  const measurable = mm >= config.minPrecipitationMmPerHr || solid;
  if (!measurable) return { matters: false, ignoredDrizzle: false };
  const drizzle =
    ignoreLightDrizzle &&
    !solid &&
    (intensity === 'light' || mm < config.lightRainIgnoreThresholdMm);
  if (drizzle) return { matters: false, ignoredDrizzle: true };
  return { matters: true, ignoredDrizzle: false };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function subtextForTake(intensity: string, rainingNow: boolean): string {
  if (intensity === 'heavy') {
    return rainingNow ? 'Proper chucking it down.' : 'Proper chucking it down soon.';
  }
  if (intensity === 'moderate') {
    return rainingNow ? "It's properly wet out there." : "You'll want the brolly for this one.";
  }
  return rainingNow ? "It's already wetting the pavement." : 'A bit of rain on the cards.';
}

function confidenceFor(
  state: UmbrellaRecommendationState,
  peakPop: number,
  threshold: number,
  model: ForecastBundle['modelConfidence'],
): UmbrellaDecision['confidence'] {
  if (model === 'low') return 'low';
  if (state === 'FORECAST_UNCERTAIN') return 'medium';
  if (state === 'NO_UMBRELLA_NEEDED') return model === 'high' ? 'high' : 'medium';
  const margin = peakPop - threshold;
  if (margin >= 20 && model === 'high') return 'high';
  if (margin >= 10) return 'medium';
  return 'low';
}

interface ClassifiedHour {
  point: HourlyForecastPoint;
  matters: boolean;
  ignoredDrizzle: boolean;
  take: boolean;
  uncertain: boolean;
  inconsistent: boolean;
}

function classifyHour(
  point: HourlyForecastPoint,
  threshold: number,
  preferences: UserNotificationPreferences,
  config: NotificationEngineConfig,
): ClassifiedHour {
  const amount = Math.max(point.precipitationMm, point.rainMm + point.showersMm);
  const intensity = point.intensityLevel ?? intensityFromMm(amount);
  const { matters, ignoredDrizzle } = precipitationMatters(
    amount,
    intensity,
    preferences.ignoreLightDrizzle,
    config,
  );
  const pop = point.precipitationProbabilityPct;
  const take = pop >= threshold && matters;
  const inconsistent = pop >= threshold && !matters && !ignoredDrizzle;
  const inBand = pop >= config.uncertaintyBandMinPct && pop < threshold;
  const uncertain = !take && (inconsistent || (inBand && matters));
  return { point, matters, ignoredDrizzle, take, uncertain, inconsistent };
}

function groupWindows(hours: ClassifiedHour[]): ClassifiedHour[][] {
  const windows: ClassifiedHour[][] = [];
  let current: ClassifiedHour[] = [];
  for (const hour of hours) {
    const previous = current[current.length - 1];
    if (!previous) {
      current = [hour];
      continue;
    }
    const gap = parseUtcMs(hour.point.timeIso) - parseUtcMs(previous.point.timeIso);
    if (gap <= 90 * 60_000) {
      current.push(hour);
    } else {
      windows.push(current);
      current = [hour];
    }
  }
  if (current.length) windows.push(current);
  return windows;
}

function windowFromHours(
  hours: ClassifiedHour[],
  offset: number,
): NonNullable<UmbrellaDecision['nextRainWindow']> {
  const first = hours[0];
  if (!first) {
    throw new Error('Cannot summarise an empty rain window');
  }
  let peak = 0;
  let expected = 0;
  let intensity: IntensityLevel = 'none';
  const rank: Record<IntensityLevel, number> = { none: 0, light: 1, moderate: 2, heavy: 3 };
  for (const hour of hours) {
    peak = Math.max(peak, hour.point.precipitationProbabilityPct);
    expected += Math.max(hour.point.precipitationMm, hour.point.rainMm + hour.point.showersMm);
    if (rank[hour.point.intensityLevel] > rank[intensity]) intensity = hour.point.intensityLevel;
  }
  return {
    startTimeIso: first.point.timeIso,
    startLabel: first.point.hourLabel || hourLabelFromIso(first.point.timeIso, offset),
    peakProbabilityPct: Math.round(peak),
    expectedMm: round1(expected),
    intensity,
  };
}

export function assessUmbrella(
  weather: ForecastBundle,
  preferences: UserNotificationPreferences,
  config: NotificationEngineConfig,
  nowIso: string,
): UmbrellaAssessment {
  const trace: string[] = [];
  const nowMs = parseUtcMs(nowIso);
  const offset = finite(weather.utcOffsetSeconds, 0);
  const threshold = thresholdForSensitivity(preferences.rainSensitivity, config);
  trace.push(
    `Sensitivity ${preferences.rainSensitivity} uses ${threshold.pct}% (${threshold.source}).`,
  );
  trace.push(
    `Uncertainty band is ${config.uncertaintyBandMinPct}–${config.uncertaintyBandMaxPct}%, ` +
      `minimum expected rain ${config.minPrecipitationMmPerHr} mm/h, ` +
      `drizzle ignore cut ${config.lightRainIgnoreThresholdMm} mm/h ` +
      `(ignore light drizzle: ${preferences.ignoreLightDrizzle ? 'yes' : 'no'}).`,
  );
  trace.push(`Lookahead is ${config.lookaheadHours} hours from config.lookaheadHours.`);

  const startMs = nowMs - 60 * 60_000;
  const endMs = nowMs + config.lookaheadHours * 60 * 60_000;
  const hours = weather.hourly
    .filter((point) => {
      const time = parseUtcMs(point.timeIso);
      return time >= startMs && time <= endMs;
    })
    .sort((a, b) => parseUtcMs(a.timeIso) - parseUtcMs(b.timeIso));

  trace.push(`${hours.length} hourly forecast points fall inside the lookahead.`);

  const classified = hours.map((point) => classifyHour(point, threshold.pct, preferences, config));
  const takeHours = classified.filter(
    (hour) => hour.take && parseUtcMs(hour.point.timeIso) + 60 * 60_000 > nowMs,
  );
  const uncertainHours = classified.filter((hour) => hour.uncertain);
  const ignoredHours = classified.filter((hour) => hour.ignoredDrizzle && hour.point.precipitationProbabilityPct >= threshold.pct);

  const obsAgeMs = nowMs - parseUtcMs(weather.current.timestamp);
  const observationFresh = obsAgeMs >= -5 * 60_000 && obsAgeMs <= 3 * 60 * 60_000;
  const liveAmount = weather.current.currentPrecipitationMm;
  const liveIntensity = intensityFromMm(liveAmount);
  const live = precipitationMatters(liveAmount, liveIntensity, preferences.ignoreLightDrizzle, config);
  const rainingNow = observationFresh && weather.current.isRainingNow && live.matters;

  trace.push(
    observationFresh
      ? `Live observation is fresh (${Math.round(obsAgeMs / 60000)} min old). Raining now: ${weather.current.isRainingNow}. Amount ${liveAmount} mm.`
      : `Live observation is stale (${Math.round(obsAgeMs / 60000)} min old) and will not be treated as rain falling now.`,
  );
  if (weather.current.isLiveObservation !== true) {
    trace.push('Current block was not tagged isLiveObservation. It was ignored as live evidence.');
  }

  let state: UmbrellaRecommendationState;
  let headline: string;
  let britishSubtext: string;
  let reason: string;
  let nextRainWindow: UmbrellaDecision['nextRainWindow'];
  let peakForConfidence = 0;

  if (rainingNow) {
    state = 'TAKE_UMBRELLA';
    const pct = Math.round(weather.current.currentRainProbabilityPct);
    const label = 'now';
    headline =
      pct > 0
        ? `Take your umbrella. Rain is expected around ${label}, with a ${pct}% probability of precipitation.`
        : 'Take your umbrella. Rain is expected around now, with rain already falling.';
    britishSubtext = subtextForTake(liveIntensity, true);
    reason = `A live observation shows ${round1(liveAmount)} mm in the past hour (${weather.current.conditionLabel}). That is separate from the forecast.`;
    peakForConfidence = pct > 0 ? pct : threshold.pct + 25;
    nextRainWindow = {
      startTimeIso: weather.current.timestamp,
      startLabel: 'now',
      peakProbabilityPct: pct > 0 ? pct : 100,
      expectedMm: round1(liveAmount),
      intensity: liveIntensity,
    };
    trace.push('Decision TAKE_UMBRELLA because the live observation shows actionable rain.');
  } else if (takeHours.length > 0) {
    const windows = groupWindows(takeHours);
    const next = windows[0];
    if (!next) {
      throw new Error('Take hours vanished while grouping windows');
    }
    const summary = windowFromHours(next, offset);
    state = 'TAKE_UMBRELLA';
    headline = `Take your umbrella. Rain is expected around ${summary.startLabel}, with a ${summary.peakProbabilityPct}% probability of precipitation.`;
    britishSubtext = subtextForTake(summary.intensity, false);
    reason =
      `The hourly forecast reaches ${summary.peakProbabilityPct}% around ${summary.startLabel}, ` +
      `above your ${threshold.pct}% ${preferences.rainSensitivity} threshold, ` +
      `with about ${summary.expectedMm} mm expected in that window.`;
    nextRainWindow = summary;
    peakForConfidence = summary.peakProbabilityPct;
    trace.push(
      `Decision TAKE_UMBRELLA. Next window ${summary.startLabel}, peak ${summary.peakProbabilityPct}%, ${summary.expectedMm} mm, ${summary.intensity}.`,
    );
  } else if (uncertainHours.length > 0) {
    const windows = groupWindows(uncertainHours);
    const next = windows[0];
    state = 'FORECAST_UNCERTAIN';
    headline = 'The forecast is uncertain. Check again before leaving.';
    britishSubtext = "Bit dodgy — skies can't make their mind up.";
    if (next) {
      const summary = windowFromHours(next, offset);
      nextRainWindow = summary;
      peakForConfidence = summary.peakProbabilityPct;
      const inconsistent = next.some((hour) => hour.inconsistent);
      reason = inconsistent
        ? `Around ${summary.startLabel} the chance is ${summary.peakProbabilityPct}%, but the expected amount is only a trace. The two signals disagree, so this stays a maybe.`
        : `Around ${summary.startLabel} the chance is ${summary.peakProbabilityPct}%, inside the uncertain range and under your ${threshold.pct}% threshold.`;
      trace.push(`Decision FORECAST_UNCERTAIN around ${summary.startLabel} at ${summary.peakProbabilityPct}%.`);
    } else {
      reason = 'The chance of rain sits in the uncertain band, under your threshold.';
      trace.push('Decision FORECAST_UNCERTAIN.');
    }
  } else if (hours.length === 0) {
    state = 'FORECAST_UNCERTAIN';
    headline = 'The forecast is uncertain. Check again before leaving.';
    britishSubtext = "Bit dodgy — skies can't make their mind up.";
    reason = 'There are no hourly forecast points in the lookahead window, so there is nothing reliable to judge.';
    trace.push('Decision FORECAST_UNCERTAIN because the lookahead is empty.');
  } else {
    state = 'NO_UMBRELLA_NEEDED';
    headline = "You're probably fine without an umbrella today.";
    if (ignoredHours.length > 0) {
      britishSubtext = "Only a spot of drizzle, and you've asked us to ignore that.";
      reason = `Rain chances are no higher than light drizzle under ${config.lightRainIgnoreThresholdMm} mm/h, and ignore-light-drizzle is on.`;
      trace.push('Decision NO_UMBRELLA_NEEDED. Qualifying rain was only drizzle and the preference ignores it.');
    } else {
      britishSubtext = 'Bone dry, mate.';
      const peak = hours.reduce((max, hour) => Math.max(max, hour.precipitationProbabilityPct), 0);
      peakForConfidence = peak;
      reason = `Nothing in the next ${config.lookaheadHours} hours reaches your ${threshold.pct}% threshold with enough rain to matter. Peak chance is ${Math.round(peak)}%.`;
      trace.push(`Decision NO_UMBRELLA_NEEDED. Peak chance in lookahead is ${Math.round(peak)}%.`);
    }
  }

  let confidence = confidenceFor(state, peakForConfidence, threshold.pct, weather.modelConfidence);
  const ageHours = (nowMs - parseUtcMs(weather.fetchedAtIso)) / 3_600_000;
  if (ageHours > 6) {
    confidence = 'low';
    trace.push(`Bundle is ${ageHours.toFixed(1)} hours old. Confidence capped at low.`);
  } else if (ageHours > 3 && confidence === 'high') {
    confidence = 'medium';
    trace.push(`Bundle is ${ageHours.toFixed(1)} hours old. Confidence eased from high to medium.`);
  }
  trace.push(`Model confidence on the bundle is ${weather.modelConfidence}. Decision confidence is ${confidence}.`);

  const decision: UmbrellaDecision = {
    state,
    headline,
    britishSubtext,
    reason,
    nextRainWindow,
    confidence,
    evaluatedAtIso: nowIso,
  };
  return { decision, trace };
}

export function evaluateUmbrellaDecision(
  weather: ForecastBundle,
  preferences: UserNotificationPreferences,
  config: NotificationEngineConfig,
  nowIso: string,
): UmbrellaDecision {
  return assessUmbrella(weather, preferences, config, nowIso).decision;
}
