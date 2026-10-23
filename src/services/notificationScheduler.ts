import { Platform } from 'react-native';

import { evaluateNotification, planDelivery } from '../engine/notificationEngine';
import type {
  NotificationEngineInput,
  NotificationEvaluationResult,
  ScheduledNotificationRecord,
} from '../types/notifications';
import type { SimulationScenario } from './simulationPresets';
import { createSimulatedRainForecast } from './simulationPresets';

export type DeliveryMode = 'native' | 'web' | 'in-app' | 'dry-run';

export interface DeliveredNotification {
  id: string;
  mode: DeliveryMode;
  title: string;
  body: string;
}

type ToastListener = (message: string) => void;
let toastListener: ToastListener | null = null;
const webTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setNotificationToastListener(listener: ToastListener | null): void {
  toastListener = listener;
}

function announce(title: string, body: string): void {
  toastListener?.(`${title} — ${body}`);
}

async function loadNativeNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

let handlerReady = false;

async function prepareNative(): Promise<typeof import('expo-notifications') | null> {
  const Notifications = await loadNativeNotifications();
  if (!Notifications) return null;
  if (!handlerReady) {
    handlerReady = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rain-alerts', {
        name: 'Umbrella alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }
  return Notifications;
}

export async function ensureNotificationPermissions(): Promise<{ granted: boolean }> {
  if (Platform.OS === 'web') {
    if (typeof globalThis.Notification !== 'function') return { granted: false };
    if (Notification.permission === 'granted') return { granted: true };
    if (Notification.permission === 'denied') return { granted: false };
    const result = await Notification.requestPermission();
    return { granted: result === 'granted' };
  }
  const Notifications = await prepareNative();
  if (!Notifications) return { granted: false };
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return { granted: true };
  const requested = await Notifications.requestPermissionsAsync();
  return { granted: requested.granted };
}

function webNotification(title: string, body: string): void {
  if (typeof globalThis.Notification !== 'function') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export async function presentNotification(title: string, body: string): Promise<DeliveredNotification> {
  announce(title, body);
  const Notifications = await prepareNative();
  if (Notifications) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { source: 'rainy-innit' } },
      trigger: null,
    });
    return { id, mode: 'native', title, body };
  }
  webNotification(title, body);
  const id = `web-${Date.now()}`;
  return { id, mode: Platform.OS === 'web' ? 'web' : 'in-app', title, body };
}

export async function scheduleNotification(
  title: string,
  body: string,
  fireAtIso: string,
  signature: string,
): Promise<DeliveredNotification> {
  const when = new Date(fireAtIso);
  const Notifications = await prepareNative();
  if (Notifications) {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { signature } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: Platform.OS === 'android' ? 'rain-alerts' : undefined,
      },
    });
    return { id, mode: 'native', title, body };
  }
  const id = `web-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const delay = when.getTime() - Date.now();
  if (delay > 0 && delay < 6 * 60 * 60_000) {
    const timer = setTimeout(() => {
      webTimers.delete(id);
      announce(title, body);
      webNotification(title, body);
    }, delay);
    webTimers.set(id, timer);
  }
  return { id, mode: Platform.OS === 'web' ? 'web' : 'in-app', title, body };
}

export async function cancelNotifications(ids: string[]): Promise<void> {
  for (const id of ids) {
    const timer = webTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      webTimers.delete(id);
    }
  }
  const Notifications = await prepareNative();
  if (!Notifications) return;
  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Already gone, or a web id the native module does not know.
      }
    }),
  );
}

export async function triggerTestNotification(): Promise<DeliveredNotification> {
  await ensureNotificationPermissions();
  return presentNotification(
    'Rainy innit',
    'Test nudge. If you can read this, alerts are wired up.',
  );
}

export async function deliverEvaluation(
  result: NotificationEvaluationResult,
): Promise<{ mode: DeliveryMode; notificationId?: string }> {
  const plan = planDelivery(result);
  if (plan.cancelIds.length) {
    await cancelNotifications(plan.cancelIds);
  }
  if (plan.kind === 'none' || !plan.title || !plan.body) {
    return { mode: result.dryRun ? 'dry-run' : 'in-app' };
  }
  if (plan.kind === 'present') {
    const delivered = await presentNotification(plan.title, plan.body);
    return { mode: delivered.mode, notificationId: delivered.id };
  }
  if (plan.kind === 'schedule' && plan.fireAtIso) {
    const delivered = await scheduleNotification(
      plan.title,
      plan.body,
      plan.fireAtIso,
      plan.eventSignature ?? 'rain',
    );
    return { mode: delivered.mode, notificationId: delivered.id };
  }
  return { mode: 'in-app' };
}

export interface SimulationRunInput extends Omit<NotificationEngineInput, 'weather' | 'nowIso'> {
  scenario: SimulationScenario;
  nowIso?: string;
}

/**
 * Runs a clearly labelled simulated forecast through the engine and, unless
 * dry-run is set, through the same delivery path as a real alert.
 */
export async function triggerSimulatedRainForecast(
  input: SimulationRunInput,
): Promise<{ result: NotificationEvaluationResult; mode: DeliveryMode; notificationId?: string }> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const weather = createSimulatedRainForecast(input.scenario, { nowIso });
  const result = evaluateNotification({
    weather,
    preferences: input.preferences,
    config: input.config,
    history: input.history,
    scheduled: input.scheduled,
    nowIso,
    dryRun: input.dryRun,
  });
  const delivery = await deliverEvaluation(result);
  return { result, mode: delivery.mode, notificationId: delivery.notificationId };
}

export function scheduledRecordFromDelivery(
  result: NotificationEvaluationResult,
  id: string,
  createdAtIso: string,
): ScheduledNotificationRecord | null {
  if (!result.shouldNotify || result.dryRun || !result.eventSignature || !result.scheduledForIso) return null;
  if (result.action !== 'SCHEDULE_BEFORE_RAIN' && result.action !== 'SCHEDULE_BEFORE_DEPARTURE') return null;
  return {
    id,
    eventSignature: result.eventSignature,
    scheduledForIso: result.scheduledForIso,
    peakProbabilityPct: result.umbrellaDecision.nextRainWindow?.peakProbabilityPct ?? 0,
    title: result.title ?? 'Rainy innit',
    body: result.body ?? result.umbrellaDecision.headline,
    createdAtIso,
  };
}
