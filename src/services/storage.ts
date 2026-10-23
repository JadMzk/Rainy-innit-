import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../config/defaults';
import type { NotificationHistoryEntry, ScheduledNotificationRecord, UserNotificationPreferences } from '../types/notifications';
import type { WeatherBundle } from '../types/weather';
import { isWeatherBundle } from './weatherService';

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadPreferences(): Promise<UserNotificationPreferences | null> {
  return readJson<UserNotificationPreferences>(STORAGE_KEYS.preferences);
}

export async function savePreferences(preferences: UserNotificationPreferences): Promise<void> {
  await writeJson(STORAGE_KEYS.preferences, preferences);
}

export async function loadOnboarded(): Promise<boolean> {
  const value = await readJson<boolean>(STORAGE_KEYS.onboarded);
  return value === true;
}

export async function saveOnboarded(done: boolean): Promise<void> {
  await writeJson(STORAGE_KEYS.onboarded, done);
}

export async function loadActiveSlot(): Promise<'home' | 'destination'> {
  const value = await readJson<'home' | 'destination'>(STORAGE_KEYS.activeSlot);
  return value === 'destination' ? 'destination' : 'home';
}

export async function saveActiveSlot(slot: 'home' | 'destination'): Promise<void> {
  await writeJson(STORAGE_KEYS.activeSlot, slot);
}

export async function loadWeatherCache(): Promise<WeatherBundle | null> {
  const value = await readJson<unknown>(STORAGE_KEYS.weatherCache);
  return isWeatherBundle(value) ? value : null;
}

export async function saveWeatherCache(bundle: WeatherBundle): Promise<void> {
  await writeJson(STORAGE_KEYS.weatherCache, bundle);
}

export async function loadHistory(): Promise<NotificationHistoryEntry[]> {
  const value = await readJson<NotificationHistoryEntry[]>(STORAGE_KEYS.history);
  return Array.isArray(value) ? value : [];
}

export async function saveHistory(history: NotificationHistoryEntry[]): Promise<void> {
  await writeJson(STORAGE_KEYS.history, history.slice(0, 50));
}

export async function loadScheduled(): Promise<ScheduledNotificationRecord[]> {
  const value = await readJson<ScheduledNotificationRecord[]>(STORAGE_KEYS.scheduled);
  return Array.isArray(value) ? value : [];
}

export async function saveScheduled(records: ScheduledNotificationRecord[]): Promise<void> {
  await writeJson(STORAGE_KEYS.scheduled, records);
}
