# Notification engine

The engine in `src/engine/notificationEngine.ts` is a pure function.

```ts
evaluateNotification(input) → NotificationEvaluationResult
```

`input` is `{ weather, preferences, config, history, scheduled, nowIso, dryRun }`. The same inputs always produce the same result, including the trace. `planDelivery(result)` is the only bridge to the scheduler, and it performs no I/O either.

## Configuration schema

`NotificationEngineConfig` in `src/types/notifications.ts`:

| Field | Default | Used for |
| --- | --- | --- |
| `probThresholdStandardPct` | 60 | Medium sensitivity take-line |
| `probThresholdSensitivePct` | 40 | High sensitivity take-line |
| `probThresholdRelaxedPct` | 75 | Low sensitivity take-line |
| `uncertaintyBandMinPct` | 35 | Bottom of "check again" |
| `uncertaintyBandMaxPct` | 59 | Documented top of the classic uncertain band. Hours under the user's own take-line and at or above the minimum are uncertain even when that take-line is above 59 (a relaxed user at 70%). |
| `minPrecipitationMmPerHr` | 0.2 | Floor under which an expected amount is a trace |
| `lightRainIgnoreThresholdMm` | 0.5 | Drizzle cut when the user ignores light rain |
| `leadTimeMinutes` | 45 | Fallback lead if the preference is not a finite number |
| `lookaheadHours` | 12 | How far ahead hourly points count |
| `maxNotificationsPerDay` | 2 | Hard ceiling. The preference cannot raise it. |
| `cooldownMinutes` | 180 | Minimum gap between delivered alerts |
| `deduplicationWindowMinutes` | 240 | Width of a rain-event bucket |
| `cancelDropBelowProbabilityPct` | 25 | Queued alerts under this peak are superseded |
| `quietHoursStart` | `22:00` | Fallback quiet start |
| `quietHoursEnd` | `07:00` | Fallback quiet end |

User fields that override the matching config values when set: `leadTimeMinutes`, `quietHoursStart`, `quietHoursEnd`, `maxDailyNotifications` (the engine takes the lower of the preference and the config ceiling), `rainSensitivity`, `ignoreLightDrizzle`, `enabled`, `usualDepartureTime`.

Probability comparisons read those fields. A test feeds a standard threshold of 90 and of 10 and expects the state to move. A literal `60` inside the engine would fail that test.

## Umbrella state, then notification state

`assessUmbrella` runs first and appends its own trace lines.

Hours kept are those with `now − 1 h ≤ time ≤ now + lookahead`. Each hour is classified:

- **Take** if probability ≥ the sensitivity threshold and the amount matters, and the hour has not already ended.
- **Ignored drizzle** if the amount would have mattered but the user turned drizzle off and the intensity is light (under the drizzle cut, and not moderate or heavy).
- **Inconsistent** if probability ≥ the threshold but the amount does not matter and it is not an ignored drizzle.
- **Uncertain** if it is inconsistent, or the probability is ≥ `uncertaintyBandMinPct` and still under the user's threshold, and the amount matters.

Priority: fresh live rain that matters → `TAKE_UMBRELLA` ("around now"). Else any take-hours, grouped into runs with gaps of at most 90 minutes → `TAKE_UMBRELLA` for the next run. Else any uncertain hours → `FORECAST_UNCERTAIN`. Else no hours in the window → `FORECAST_UNCERTAIN`. Else `NO_UMBRELLA_NEEDED`, with the drizzle sentence if that was the only thing suppressed.

Confidence starts from how far the peak sits above the threshold and from `modelConfidence`, then drops if `fetchedAtIso` is more than three hours old (high becomes medium) or six hours old (anything becomes low).

The headlines are fixed sentences:

- Take: `Take your umbrella. Rain is expected around {time}, with a {X}% probability of precipitation.`
- None: `You're probably fine without an umbrella today.`
- Uncertain: `The forecast is uncertain. Check again before leaving.`

British asides ("Proper chucking it down soon.", "Bone dry, mate.", "Bit dodgy — skies can't make their mind up.") are `britishSubtext`, not a replacement for the sentence.

## Notification state machine

```
                ┌─ disabled ──────────────► SUPPRESSED_DISABLED
                │
umbrella ───────┼─ no rain, nothing queued ► NO_RAIN_EXPECTED
                ├─ no rain, queue stale ───► CANCEL_SUPERSEDED
                ├─ uncertain, queue ok ────► UNCERTAIN_HOLD
                ├─ uncertain, queue stale ─► CANCEL_SUPERSEDED
                │
                └─ take
                     ├─ same signature already covered ► SUPPRESSED_DUPLICATE
                     ├─ cap used up ───────────────────► SUPPRESSED_DAILY_CAP
                     ├─ last alert too recent ─────────► SUPPRESSED_COOLDOWN
                     ├─ fire time in quiet hours ──────► SUPPRESSED_QUIET_HOURS
                     ├─ raining, or lead already past ─► NOTIFY_NOW
                     ├─ rain hits the commute ─────────► SCHEDULE_BEFORE_DEPARTURE
                     └─ otherwise ─────────────────────► SCHEDULE_BEFORE_RAIN
```

Suppression checks run in that order. A duplicate that is also inside the cooldown reports `SUPPRESSED_DUPLICATE`. The daily cap is counted before the cooldown so a full day reports the cap even when the most recent alert is also recent.

`shouldNotify` is true only for `NOTIFY_NOW`, `SCHEDULE_BEFORE_RAIN`, and `SCHEDULE_BEFORE_DEPARTURE`. It stays true during dry-run: dry-run describes the send, and `planDelivery` is what refuses to perform it.

`shouldCancelExisting` is true when `cancellationIds` is non-empty. A new send can carry cancellation ids for a different, now-dead signature. A suppression does not keep a stale id alive.

## Deduplication

```
signature = {local date}|rain-{floor(local hour / bucketHours)}
bucketHours = max(1, round(deduplicationWindowMinutes / 60))
```

Default bucket is four hours. The signature is compared with history entries whose action was a real delivery (`NOTIFY_NOW`, `SCHEDULE_BEFORE_RAIN`, `SCHEDULE_BEFORE_DEPARTURE`) and whose `sentAtIso` is inside the dedupe window, and with queued records of the same signature whose fire time is still in the future and which are not themselves being cancelled on this pass.

## Cancellation

For each queued record the engine recomputes the max probability of hourly points with the same signature.

- Peak `< cancelDropBelowProbabilityPct` → cancel.
- No hours left in that bucket → cancel.
- Peak still at or above the line → keep. An uncertain 48% does not cancel a queued alert, because 48 is not below 25.

Disabled notifications cancel every queued id without sending a replacement.

## Delivery

`planDelivery`:

| Result | Plan |
| --- | --- |
| `dryRun` | `{ kind: 'none', cancelIds: [], recordHistory: false }` |
| notify now | `present`, plus any cancel ids |
| schedule before rain or departure | `schedule` at `scheduledForIso` |
| cancel only | `cancel` |
| anything else | `none` |

`notificationScheduler.ts` loads `expo-notifications` only when `Platform.OS !== 'web'`. It requests permission, creates the Android channel `rain-alerts`, presents with a `null` trigger, and schedules with `SchedulableTriggerInputTypes.DATE`. Cancel ignores ids the OS does not know, which covers web ids and already-delivered ones.

Web, a simulator without the native module, or a failed import: an in-app toast always fires for an immediate alert, the browser Notification API is used if permission was granted, and a `setTimeout` covers a fire within six hours of the open session. The debug panel still lists the persisted id. Reloading the page does not reconstruct timers. That limitation is deliberate and visible.

`triggerTestNotification` sends "Test nudge. If you can read this, alerts are wired up." `triggerSimulatedRainForecast` builds a preset from `simulationPresets.ts`, evaluates it, and delivers only when `dryRun` is false.

## Mobile background limits

Local notifications are scheduled while the app is in the foreground. We do not depend on the operating system to wake the process at the departure minute and let us think. Both major mobile schedulers are a poor fit for "run our engine at 07:15 exactly".

### iOS `BGAppRefreshTask`

`BGAppRefreshTask` (`BGAppRefreshTaskRequest` in BackgroundTasks) asks the system for an opportunistic moment to refresh data. The system decides whether and when, using energy, usage, and the refresh budget. It is not an alarm clock. The task is short — on the order of tens of seconds — and the user can turn Background App Refresh off entirely. A `BGAppRefreshTask` that then tried to post the umbrella alert would miss departure whenever iOS had not felt like running us. Apple's local notification trigger (`UNCalendarNotificationTrigger` / a date trigger, which is what Expo schedules) is the mechanism that fires at a time without the app being resident.

The app does not register a background refresh task in this version. Doing so later would be for one job only: fetch a newer Open-Meteo bundle and cancel or replace the already-scheduled notification. The alert itself would still be a local notification scheduled during that run. Documentation: https://developer.apple.com/documentation/backgroundtasks/bgapprefreshtask

### Android `WorkManager`

`WorkManager` is the right API for durable deferrable work, and the wrong API for "at 07:15, decide". Periodic work cannot be scheduled more often than 15 minutes, and Doze, app standby, and battery restrictions stretch that further. Exact alarms (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`) are restricted and are a poor fit for a weather nudge.

The pattern that matches the platform is the same as on iOS. While the app is open, `evaluateNotification` decides, and `expo-notifications` hands a timestamp to `NotificationManager`. A later `WorkManager` worker could refresh the forecast and reschedule, subject to the 15-minute floor and Doze delay. It should not be the thing the user is waiting on at the door. Documentation: https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started

### What the MVP actually does

Open the app, or pull to refresh. The engine runs. If rain qualifies, a local notification is scheduled at the fire time and its id is stored. Next open, if the probability has fallen through the cancel line, that id is cancelled. Quiet hours, the cap, the cooldown, and the signature are applied at decision time so a notification that should not exist is never handed to the OS. Web is best-effort and says so in the toast.
