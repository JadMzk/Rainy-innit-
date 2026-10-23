import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { DEFAULT_NOTIFICATION_CONFIG, DEFAULT_PREFERENCES } from '../config/defaults';
import { parseUtcMs } from '../engine/clock';
import { evaluateNotification } from '../engine/notificationEngine';
import { evaluateUmbrellaDecision } from '../engine/umbrellaDecision';
import {
  deliverEvaluation,
  ensureNotificationPermissions,
  setNotificationToastListener,
  triggerSimulatedRainForecast,
  triggerTestNotification,
} from '../services/notificationScheduler';
import type { SimulationScenario } from '../services/simulationPresets';
import {
  loadActiveSlot,
  loadHistory,
  loadOnboarded,
  loadPreferences,
  loadScheduled,
  loadWeatherCache,
  saveActiveSlot,
  saveHistory,
  saveOnboarded,
  savePreferences,
  saveScheduled,
  saveWeatherCache,
} from '../services/storage';
import { fetchWeatherBundle } from '../services/weatherService';
import type {
  NotificationEvaluationResult,
  NotificationHistoryEntry,
  ScheduledNotificationRecord,
  UserNotificationPreferences,
} from '../types/notifications';
import type { LocationCoords, UmbrellaDecision, WeatherBundle } from '../types/weather';

type Slot = 'home' | 'destination';

interface AppStateValue {
  ready: boolean;
  onboarded: boolean;
  preferences: UserNotificationPreferences;
  activeSlot: Slot;
  location: LocationCoords | null;
  weather: WeatherBundle | null;
  fromCache: boolean;
  weatherError: string | null;
  loadingWeather: boolean;
  decision: UmbrellaDecision | null;
  history: NotificationHistoryEntry[];
  scheduled: ScheduledNotificationRecord[];
  lastEvaluation: NotificationEvaluationResult | null;
  toast: string | null;
  refresh: () => Promise<void>;
  updatePreferences: (patch: Partial<UserNotificationPreferences>) => Promise<void>;
  setActiveSlot: (slot: Slot) => Promise<void>;
  completeOnboarding: (place: LocationCoords, enableNotifications: boolean) => Promise<void>;
  sendTestNotification: () => Promise<void>;
  runSimulation: (scenario: SimulationScenario, dryRun: boolean) => Promise<void>;
  dismissToast: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function watchedLocation(preferences: UserNotificationPreferences, slot: Slot): LocationCoords | null {
  if (slot === 'destination' && preferences.destinationLocation) return preferences.destinationLocation;
  return preferences.homeLocation ?? preferences.destinationLocation ?? null;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [preferences, setPreferences] = useState<UserNotificationPreferences>(DEFAULT_PREFERENCES);
  const [activeSlot, setSlot] = useState<Slot>('home');
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledNotificationRecord[]>([]);
  const [lastEvaluation, setLastEvaluation] = useState<NotificationEvaluationResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const prefsRef = useRef(preferences);
  const slotRef = useRef(activeSlot);
  const historyRef = useRef(history);
  const scheduledRef = useRef(scheduled);
  const onboardedRef = useRef(onboarded);
  prefsRef.current = preferences;
  slotRef.current = activeSlot;
  historyRef.current = history;
  scheduledRef.current = scheduled;
  onboardedRef.current = onboarded;

  useEffect(() => {
    setNotificationToastListener((message) => setToast(message));
    return () => setNotificationToastListener(null);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedPrefs, done, slot, cached, storedHistory, storedScheduled] = await Promise.all([
        loadPreferences(),
        loadOnboarded(),
        loadActiveSlot(),
        loadWeatherCache(),
        loadHistory(),
        loadScheduled(),
      ]);
      if (cancelled) return;
      if (storedPrefs) setPreferences({ ...DEFAULT_PREFERENCES, ...storedPrefs });
      setOnboarded(done);
      setSlot(slot);
      if (cached) {
        setWeather(cached);
        setFromCache(true);
      }
      setHistory(storedHistory);
      setScheduled(storedScheduled);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistAlerts = useCallback(async (nextHistory: NotificationHistoryEntry[], nextScheduled: ScheduledNotificationRecord[]) => {
    historyRef.current = nextHistory;
    scheduledRef.current = nextScheduled;
    setHistory(nextHistory);
    setScheduled(nextScheduled);
    await Promise.all([saveHistory(nextHistory), saveScheduled(nextScheduled)]);
  }, []);

  const commitResult = useCallback(
    async (result: NotificationEvaluationResult, notificationId?: string) => {
      const cancelled = new Set(result.shouldCancelExisting ? result.cancellationIds : []);
      let nextScheduled = scheduledRef.current.filter((item) => !cancelled.has(item.id));
      let nextHistory = historyRef.current;
      if (
        !result.dryRun &&
        result.shouldNotify &&
        result.eventSignature &&
        result.action === 'NOTIFY_NOW'
      ) {
        nextHistory = [
          {
            id: notificationId ?? `local-${Date.now()}`,
            sentAtIso: result.scheduledForIso ?? result.umbrellaDecision.evaluatedAtIso,
            eventSignature: result.eventSignature,
            action: result.action,
            title: result.title ?? 'Rainy innit',
            body: result.body ?? result.umbrellaDecision.headline,
          },
          ...nextHistory,
        ].slice(0, 50);
      }
      if (
        !result.dryRun &&
        result.shouldNotify &&
        notificationId &&
        result.eventSignature &&
        result.scheduledForIso &&
        (result.action === 'SCHEDULE_BEFORE_RAIN' || result.action === 'SCHEDULE_BEFORE_DEPARTURE')
      ) {
        nextScheduled = [
          {
            id: notificationId,
            eventSignature: result.eventSignature,
            scheduledForIso: result.scheduledForIso,
            peakProbabilityPct: result.umbrellaDecision.nextRainWindow?.peakProbabilityPct ?? 0,
            title: result.title ?? 'Rainy innit',
            body: result.body ?? result.umbrellaDecision.headline,
            createdAtIso: new Date().toISOString(),
          },
          ...nextScheduled,
        ];
      }
      await persistAlerts(nextHistory, nextScheduled);
      setLastEvaluation(result);
    },
    [persistAlerts],
  );

  const promoteDueAlerts = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const nowMs = parseUtcMs(nowIso);
    const due = scheduledRef.current.filter((item) => parseUtcMs(item.scheduledForIso) <= nowMs);
    if (due.length === 0) return;
    const kept = scheduledRef.current.filter((item) => parseUtcMs(item.scheduledForIso) > nowMs);
    const known = new Set(historyRef.current.map((entry) => entry.id));
    const extra: NotificationHistoryEntry[] = due
      .filter((item) => !known.has(item.id))
      .map((item) => ({
        id: item.id,
        sentAtIso: item.scheduledForIso,
        eventSignature: item.eventSignature,
        action: 'SCHEDULE_BEFORE_RAIN' as const,
        title: item.title,
        body: item.body,
      }));
    await persistAlerts([...extra, ...historyRef.current].slice(0, 50), kept);
  }, [persistAlerts]);

  const syncAlerts = useCallback(
    async (bundle: WeatherBundle) => {
      if (!onboardedRef.current) return;
      await promoteDueAlerts();
      const result = evaluateNotification({
        weather: bundle,
        preferences: prefsRef.current,
        config: DEFAULT_NOTIFICATION_CONFIG,
        history: historyRef.current,
        scheduled: scheduledRef.current,
        nowIso: new Date().toISOString(),
        dryRun: false,
      });
      const delivery = await deliverEvaluation(result);
      await commitResult(result, delivery.notificationId);
    },
    [commitResult, promoteDueAlerts],
  );

  const refresh = useCallback(async () => {
    const place = watchedLocation(prefsRef.current, slotRef.current);
    if (!place) return;
    setLoadingWeather(true);
    const result = await fetchWeatherBundle(place, {
      cache: { read: loadWeatherCache, write: saveWeatherCache },
    });
    setLoadingWeather(false);
    setWeather(result.bundle);
    setFromCache(result.fromCache);
    setWeatherError(result.error);
    if (result.bundle) {
      await syncAlerts(result.bundle);
    }
  }, [syncAlerts]);

  const location = watchedLocation(preferences, activeSlot);
  const locationKey = location ? `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}` : '';

  useEffect(() => {
    if (!ready || !locationKey) return;
    void refresh();
  }, [ready, locationKey, refresh]);

  const updatePreferences = useCallback(async (patch: Partial<UserNotificationPreferences>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPreferences(next);
    await savePreferences(next);
  }, []);

  const setActiveSlot = useCallback(async (slot: Slot) => {
    slotRef.current = slot;
    setSlot(slot);
    await saveActiveSlot(slot);
  }, []);

  const completeOnboarding = useCallback(
    async (place: LocationCoords, enableNotifications: boolean) => {
      let enabled = enableNotifications;
      if (enableNotifications) {
        const permission = await ensureNotificationPermissions();
        enabled = permission.granted;
        if (!permission.granted) {
          setToast('Notification permission was declined. You can still check the app, and turn alerts on later.');
        }
      }
      const next: UserNotificationPreferences = {
        ...prefsRef.current,
        homeLocation: place,
        enabled,
      };
      prefsRef.current = next;
      setPreferences(next);
      onboardedRef.current = true;
      setOnboarded(true);
      await Promise.all([savePreferences(next), saveOnboarded(true)]);
    },
    [],
  );

  const sendTestNotification = useCallback(async () => {
    const delivered = await triggerTestNotification();
    setToast(
      delivered.mode === 'native'
        ? 'Test notification handed to the phone.'
        : 'Test notification shown here. This browser cannot schedule a system alert.',
    );
  }, []);

  const runSimulation = useCallback(
    async (scenario: SimulationScenario, dryRun: boolean) => {
      const run = await triggerSimulatedRainForecast({
        scenario,
        preferences: prefsRef.current,
        config: DEFAULT_NOTIFICATION_CONFIG,
        history: historyRef.current,
        scheduled: scheduledRef.current,
        dryRun,
      });
      await commitResult(run.result, run.notificationId);
      if (dryRun) {
        setToast('Dry run only. Nothing was sent.');
      }
    },
    [commitResult],
  );

  const decision = useMemo(() => {
    if (!weather) return null;
    return evaluateUmbrellaDecision(weather, preferences, DEFAULT_NOTIFICATION_CONFIG, new Date().toISOString());
  }, [weather, preferences]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      onboarded,
      preferences,
      activeSlot,
      location,
      weather,
      fromCache,
      weatherError,
      loadingWeather,
      decision,
      history,
      scheduled,
      lastEvaluation,
      toast,
      refresh,
      updatePreferences,
      setActiveSlot,
      completeOnboarding,
      sendTestNotification,
      runSimulation,
      dismissToast: () => setToast(null),
    }),
    [
      ready,
      onboarded,
      preferences,
      activeSlot,
      location,
      weather,
      fromCache,
      weatherError,
      loadingWeather,
      decision,
      history,
      scheduled,
      lastEvaluation,
      toast,
      refresh,
      updatePreferences,
      setActiveSlot,
      completeOnboarding,
      sendTestNotification,
      runSimulation,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
