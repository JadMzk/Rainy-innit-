# Architecture

Rainy innit is a single Expo app. There is no account, no database, and no weather key. Open-Meteo is called from the device. Notifications are scheduled on the device. The rules that decide both the home-screen sentence and the push are a pure function with no React and no network inside it.

```
Open-Meteo forecast API ──► weatherService.parse ──► WeatherBundle
Open-Meteo geocoding     ──► geocoding             ──► LocationCoords
                                                          │
User preferences (AsyncStorage) ─────────────────────────┤
Notification history + queued ids ───────────────────────┤
                                                          ▼
                                              notificationEngine
                                              (pure, clock injected)
                                                          │
                          ┌───────────────────────────────┼────────────────────────┐
                          ▼                               ▼                        ▼
                   UmbrellaDecision              NotificationEvaluation     DeliveryPlan
                   Home screen                   Settings trace             expo-notifications
                                                                             or in-app fallback
```

## Module boundaries

| Path | Owns | Must not |
| --- | --- | --- |
| `src/types/weather.ts`, `src/types/notifications.ts` | Shared contracts | Import React, fetch, or Expo |
| `src/config/defaults.ts` | Default thresholds and storage keys | Decide anything |
| `src/engine/clock.ts` | UTC ↔ location wall-clock, quiet hours, rain-event signatures | Know about weather or notifications |
| `src/engine/umbrellaDecision.ts` | The three umbrella states | Schedule a notification or read storage |
| `src/engine/notificationEngine.ts` | Suppress, time, cancel, explain | Call `fetch` or `expo-notifications` |
| `src/services/weatherService.ts` | Open-Meteo URL, parser, cache fallback | Render UI or invent a forecast |
| `src/services/simulationPresets.ts` | Labelled QA skies | Be used as the home-screen source |
| `src/services/geocoding.ts`, `cities.ts` | Search, reverse geocode, UK presets | Store preferences |
| `src/services/notificationScheduler.ts` | Permissions, present, schedule, cancel, test nudge, simulated trigger | Reimplement the rules |
| `src/services/deviceLocation.ts` | GPS, with a web geolocation path | Decide the umbrella |
| `src/services/storage.ts` | AsyncStorage for prefs, cache, history, queue | Evaluate weather |
| `src/state/AppState.tsx` | Load, refresh, commit deliveries, onboarding | Hide a rule in a component |
| `app/(tabs)/*`, `src/components/*` | Presentation | Duplicate threshold comparisons |

The engine takes `nowIso` as an argument. Tests pass a fixed instant. The UI passes `new Date().toISOString()`. Nothing in the decision path calls the clock itself.

## Shared interfaces

`WeatherBundle` is a production forecast only: `provider: 'open-meteo'`. Current weather is a `CurrentObservation` with the literal `isLiveObservation: true`. Hourly and daily points carry the literal `isForecast: true`. `SimulatedWeatherBundle` extends the same shape with `provider: 'simulation'`, `simulationScenario`, and a `simulationLabel` that always contains `SIMULATED`. `isWeatherBundle` rejects simulations, so a debug sky cannot be written into the offline cache and later shown as live.

`NotificationEngineConfig` is the full threshold object: probability cuts for three sensitivities, the 35–59 uncertainty band, millimetre floors, lookahead, lead default, daily cap, cooldown, dedupe window, cancel line, and quiet-hour defaults. `UserNotificationPreferences` holds what the person can change: enabled, departure, lead, sensitivity, drizzle, their own cap, their quiet hours, home, and an optional destination.

`evaluateNotification` returns `NotificationEvaluationResult`: whether to notify, whether to cancel, the ids, a single action, optional fire time, title, body, event signature, the dry-run flag, a sentence, the trace, and the umbrella decision that was the input to the policy.

`planDelivery` turns that result into `present`, `schedule`, `cancel`, or `none`. Dry-run is always `none`, including when the result says a real run would have cancelled.

## Data flow

1. First launch shows onboarding over the tabs: what the app is, a place (London, Manchester, Edinburgh, Bristol, Cardiff, search, or GPS), then notification permission. Declining permission stores `enabled: false` and still lets the home screen work.
2. The watched place is home, unless the user switches the slot to a destination they have set.
3. `fetchWeatherBundle` builds `https://api.open-meteo.com/v1/forecast` with the current, hourly, and daily variables in the product spec, `timezone=auto`, and explicit Celsius, km/h, and millimetre units. A non-OK response, a thrown network error, invalid JSON, or a payload that fails the parser all take the same path: if the cache holds a real bundle for a nearby coordinate, return it with `fromCache: true` and the error string. Otherwise return a null bundle and the error. The UI says so. It does not draw a fake sky.
4. On a successful parse the bundle is written to the cache. The parser converts Open-Meteo's zone-less local times to UTC using `utc_offset_seconds`, and copies the matching hourly probability onto the observation because the current endpoint has no probability field.
5. After onboarding, a fresh or cached bundle is passed through `evaluateNotification` with the stored history and queue. `deliverEvaluation` performs the plan. Immediate alerts are recorded in history. Future alerts are stored as `ScheduledNotificationRecord`s. Ids marked for cancellation are removed and cancelled in the OS. Queued alerts whose fire time has passed are promoted into history so the daily cap still counts them.
6. The home screen does not read the notification result for its sentence. It calls `evaluateUmbrellaDecision` on the same bundle so the words and the push cannot drift apart: both come from `assessUmbrella`.
7. The settings bench calls `triggerSimulatedRainForecast`. That builds a labelled simulation, runs the same engine, and delivers only when dry-run is off. The Today tab keeps showing Open-Meteo.

## Runtime shape

Expo Router serves three tabs from `app/(tabs)`: `index` (Today), `forecast`, `settings`. Onboarding is an overlay in the root layout, not a fourth tab, and it stays up until a place has been saved. The root column is capped at 480 px so a desktop browser shows the phone layout instead of a stretched dashboard.

Native notifications go through `expo-notifications` (date trigger, Android channel `rain-alerts`). Web and any failure to load the native module use the Web Notifications API when permission exists, plus an in-app toast, and `setTimeout` for fires inside the next six hours. That is a fallback, not a claim that a browser tab will wake up tomorrow at 07:15. The background-execution limits are spelled out in `docs/notification_engine.md`.

## What is intentionally absent

No account, no server of ours, no push provider, no background-fetch task that pretends iOS will run us on the minute. The forecast is refreshed when the app is open, and the notification for later is scheduled then. Re-opening the app is what cancels or replaces it.
