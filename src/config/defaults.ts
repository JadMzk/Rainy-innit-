import type { NotificationEngineConfig, UserNotificationPreferences } from '../types/notifications';

/** System thresholds. Change these, not the engine. */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationEngineConfig = {
  probThresholdStandardPct: 60,
  probThresholdSensitivePct: 40,
  probThresholdRelaxedPct: 75,
  uncertaintyBandMinPct: 35,
  uncertaintyBandMaxPct: 59,
  minPrecipitationMmPerHr: 0.2,
  lightRainIgnoreThresholdMm: 0.5,
  leadTimeMinutes: 45,
  lookaheadHours: 12,
  maxNotificationsPerDay: 2,
  cooldownMinutes: 180,
  deduplicationWindowMinutes: 240,
  cancelDropBelowProbabilityPct: 25,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

export const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  enabled: true,
  usualDepartureTime: '08:00',
  leadTimeMinutes: 45,
  rainSensitivity: 'medium',
  ignoreLightDrizzle: false,
  maxDailyNotifications: 2,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

export const LEAD_TIME_OPTIONS = [15, 30, 45, 60] as const;

export const STORAGE_KEYS = {
  preferences: 'rainy-innit:preferences',
  onboarded: 'rainy-innit:onboarded',
  weatherCache: 'rainy-innit:weather-cache',
  history: 'rainy-innit:notification-history',
  scheduled: 'rainy-innit:scheduled-notifications',
  activeSlot: 'rainy-innit:active-slot',
} as const;
