import type { ForecastBundle, LocationCoords, UmbrellaDecision } from './weather';

/**
 * Every numeric threshold the engine consults lives here.
 * The engine reads these fields. It does not embed the numbers itself.
 */
export interface NotificationEngineConfig {
  probThresholdStandardPct: number;
  probThresholdSensitivePct: number;
  probThresholdRelaxedPct: number;
  uncertaintyBandMinPct: number;
  uncertaintyBandMaxPct: number;
  minPrecipitationMmPerHr: number;
  lightRainIgnoreThresholdMm: number;
  leadTimeMinutes: number;
  lookaheadHours: number;
  maxNotificationsPerDay: number;
  cooldownMinutes: number;
  deduplicationWindowMinutes: number;
  cancelDropBelowProbabilityPct: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface UserNotificationPreferences {
  enabled: boolean;
  usualDepartureTime: string;
  leadTimeMinutes: number;
  rainSensitivity: 'low' | 'medium' | 'high';
  ignoreLightDrizzle: boolean;
  maxDailyNotifications: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  homeLocation?: LocationCoords;
  destinationLocation?: LocationCoords;
}

export type NotificationAction =
  | 'NOTIFY_NOW'
  | 'SCHEDULE_BEFORE_RAIN'
  | 'SCHEDULE_BEFORE_DEPARTURE'
  | 'CANCEL_SUPERSEDED'
  | 'SUPPRESSED_QUIET_HOURS'
  | 'SUPPRESSED_COOLDOWN'
  | 'SUPPRESSED_DAILY_CAP'
  | 'SUPPRESSED_DUPLICATE'
  | 'SUPPRESSED_DISABLED'
  | 'NO_RAIN_EXPECTED'
  | 'UNCERTAIN_HOLD';

export interface NotificationEvaluationResult {
  shouldNotify: boolean;
  shouldCancelExisting: boolean;
  cancellationIds: string[];
  action: NotificationAction;
  scheduledForIso?: string;
  title?: string;
  body?: string;
  eventSignature?: string;
  dryRun: boolean;
  explanation: string;
  debugTrace: string[];
  umbrellaDecision: UmbrellaDecision;
}

export interface NotificationHistoryEntry {
  id: string;
  sentAtIso: string;
  eventSignature: string;
  action: NotificationAction;
  title: string;
  body: string;
}

export interface ScheduledNotificationRecord {
  id: string;
  eventSignature: string;
  scheduledForIso: string;
  peakProbabilityPct: number;
  title: string;
  body: string;
  createdAtIso: string;
}

export interface NotificationEngineInput {
  weather: ForecastBundle;
  preferences: UserNotificationPreferences;
  config: NotificationEngineConfig;
  history: NotificationHistoryEntry[];
  scheduled: ScheduledNotificationRecord[];
  /** UTC timestamp injected by the caller so the engine stays deterministic. */
  nowIso: string;
  dryRun: boolean;
}

export interface DeliveryPlan {
  kind: 'present' | 'schedule' | 'cancel' | 'none';
  title?: string;
  body?: string;
  fireAtIso?: string;
  eventSignature?: string;
  cancelIds: string[];
  recordHistory: boolean;
}
