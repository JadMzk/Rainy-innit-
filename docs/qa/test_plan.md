# Rainy innit — Comprehensive QA & Automated Verification Test Plan

**Workstream:** Forge (Testing & Quality Assurance Lead)  
**Application:** Rainy innit (React Native + Expo + TypeScript Weather & Rain Notification App)  
**Primary Artifact Path:** `/workspace/rainy-innit-team/forge/test_plan.md`  
**Automated Suite Path:** `/workspace/rainy-innit-team/forge/tests/`  
**Verification Status:** **85 / 85 Automated Tests Passing (100%)** (`tsc --noEmit` clean + `npm test` via `node --import tsx --test`)  
**Last Verified:** Friday, Oct 23, 2026, 9:13 AM (Europe/London, UTC+1 / BST)

---

## 1. Executive Summary & QA Strategy

**Rainy innit** must deliver high-signal, low-noise rain alerts for UK and international commuters without suffering from false positives on overcast skies, alert fatigue during light mist/drizzle, missed alerts when iOS/Android throttle background tasks, or crashes on malformed weather API payloads.

This QA Test Plan establishes a **deterministic, multi-layered verification architecture** spanning **10 core functional & non-functional domains** and **85 automated unit & integration test cases**:

1. **Rain vs. No-Rain Forecasts (`TC-RNR-001` – `TC-RNR-008`)**
2. **Exact Precipitation Probability Tiers (`>=60%` High, `35%–59%` Uncertain, `<35%` Low), Intensity Tiers & User Sensitivity Settings (`TC-THR-001` – `TC-THR-013`)**
3. **Forecast Shifts Requiring Notification Cancellation, Rescheduling, Escalation & Anti-Flap Hysteresis (`TC-SHF-001` – `TC-SHF-007`)**
4. **Notification Timing: Immediate Alerts, Pre-Rain Lead Time (`15/30/60m`), Pre-Departure Commute Windows, Quiet Hours & DST Transitions (`TC-TIM-001` – `TC-TIM-008`)**
5. **Duplicate Notification Suppression, Cooldowns (`180m`), Daily Caps (`max=3`), & Severe Overrides (`TC-DED-001` – `TC-DED-007`)**
6. **Notification Permissions: Granted, Denied, Undetermined, Provisional & Mid-Session Revocation (`TC-PRM-001` – `TC-PRM-006`)**
7. **Location Changes: City Switch (`>5 km`), Micro-Movement, Manual Override & GPS Failure/Fallback (`TC-LOC-001` – `TC-LOC-007`)**
8. **Missing & Malformed API Data Validation & Sanitization (`TC-MAL-001` – `TC-MAL-008`)**
9. **Offline Mode & Cached Forecast Staleness Tiers (`fresh`, `aging`, `stale`, `expired >12h`) (`TC-OFF-001` – `TC-OFF-005`)**
10. **iOS (`BGAppRefreshTask`) & Android (`WorkManager` / Doze) Background Execution Limitations & 24-Hour Rolling Horizon Pre-Scheduling (`TC-BKG-001` – `TC-BKG-008`)**
11. **End-to-End Multi-Stage Integration Scenarios (`TC-INT-001` – `TC-INT-008`)**

---

## 2. Decision Matrix Specifications Under Test

### 2.1 Exact Precipitation Probability Tiers
| Probability Tier | Range (`precipitation_probability`) | Boundary Test Values | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| **HIGH** | `>= 60.0%` (`60% – 100%`) | `60.0%`, `75.0%`, `100.0%` | High-confidence rain expected; primary trigger tier across all sensitivity profiles. |
| **UNCERTAIN** | `35.0% – 59.9%` (`35% <= p < 60%`) | `35.0%`, `45.0%`, `59.0%`, `59.9%` | Possible/scattered showers; triggers on `high` sensitivity or on `medium` sensitivity when intensity is Moderate/Heavy (`>= 2.5 mm/h`). |
| **LOW** | `< 35.0%` (`0% – 34.9%`) | `0.0%`, `15.0%`, `34.0%`, `34.9%` | Low probability background noise; never triggers notifications regardless of sensitivity. |

### 2.2 Precipitation Intensity Tiers & WMO Weather Codes
| Intensity Tier | Range (`precipitation` mm/h) | WMO Codes | Boundary Test Values | Default Alert Treatment |
| :--- | :--- | :--- | :--- | :--- |
| **DRY** | `< 0.1 mm/h` (`0.00 – 0.09 mm/h`) | `0, 1, 2, 3, 45, 48` | `0.00 mm/h`, `0.09 mm/h` | Never alerts (even if cloud/precip probability is `>=60%`). |
| **DRIZZLE** | `0.1 – 0.49 mm/h` | `51, 53, 55` | `0.10 mm/h`, `0.49 mm/h` | Suppressed when `suppressDrizzle=true` or sensitivity is `medium`/`low`. Alerts only on `high` sensitivity with `suppressDrizzle=false`. |
| **LIGHT_RAIN** | `0.5 – 2.49 mm/h` | `61, 80` | `0.50 mm/h`, `2.49 mm/h` | Alerts on `HIGH` (`>=60%`) probability for `medium` and `high` sensitivity; suppressed on `low` sensitivity. |
| **MODERATE_RAIN** | `2.5 – 7.59 mm/h` | `63, 81` | `2.50 mm/h`, `7.59 mm/h` | Alerts on `HIGH` (`>=60%`) across all sensitivities, and on `UNCERTAIN` (`35%–59%`) for `medium`/`high` sensitivity. |
| **HEAVY_RAIN** | `>= 7.6 mm/h` | `65, 82, 95, 96, 99` | `7.60 mm/h`, `12.0 mm/h` | High-priority downpour alert; eligible for escalation and optional severe daily-cap override. |
| **MIXED_WINTRY** | `>= 0.1 mm/h` + Wintry WMO | `66, 67, 71, 73, 75, 77, 85, 86` | `1.80 mm/h` + WMO `73` | Treated at `MODERATE_RAIN` equivalent urgency rank (`3`) with sleet/snow/freezing rain copy. |

### 2.3 User Sensitivity Profile Matrix
| User Sensitivity | `suppressDrizzle` | `LOW (<35%)` | `UNCERTAIN (35%–59%)` | `HIGH (>=60%)` |
| :--- | :--- | :--- | :--- | :--- |
| **High (`high`)** | `false` | Suppress | Alert on `>= 0.1 mm/h` (incl. Drizzle) | Alert on `>= 0.1 mm/h` (incl. Drizzle) |
| **High (`high`)** | `true` | Suppress | Alert on `>= 0.5 mm/h` (Light+) | Alert on `>= 0.5 mm/h` (Light+) |
| **Medium (`medium`, default)** | `true` / `false` | Suppress | Alert on `>= 2.5 mm/h` (Moderate/Heavy/Wintry) | Alert on `>= 0.5 mm/h` (Light/Moderate/Heavy/Wintry) |
| **Low (`low`)** | `true` / `false` | Suppress | Suppress | Alert on `>= 2.5 mm/h` (Moderate/Heavy/Wintry only) |

---

## 3. Detailed Test Cases by Category

### Category 1: Rain vs. No-Rain Forecasts (`TC-RNR-001` – `TC-RNR-008`)
**Automated File:** `tests/unit/classifier_and_thresholds.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-RNR-001` | Clear sky dry baseline | `medium` sensitivity | `prob=0%`, `mm=0.0`, `WMO=0` | `probabilityTier='LOW'`, `intensityTier='DRY'`, `isWet=false`, `triggersAlert=false` (`BELOW_THRESHOLD`). | PASS |
| `TC-RNR-002` | Overcast sky with high probability but zero precipitation | `medium` sensitivity | `prob=75%`, `mm=0.0`, `WMO=3` | `probabilityTier='HIGH'`, `intensityTier='DRY'`, `isWet=false`, `triggersAlert=false`. Prevents false alarms on dry cloudy days. | PASS |
| `TC-RNR-003` | Light mist / drizzle classification | Standard classifier | `mm=0.2`, `WMO=51` | Classifies as `DRIZZLE` (`0.1 <= mm < 0.5`). | PASS |
| `TC-RNR-004` | Light rain classification & alert | `medium` sensitivity | `prob=70%`, `mm=1.2`, `WMO=61` | Classifies as `HIGH` + `LIGHT_RAIN`; `triggersAlert=true`. | PASS |
| `TC-RNR-005` | Moderate rain classification & alert | `medium` sensitivity | `prob=65%`, `mm=4.0`, `WMO=63` | Classifies as `HIGH` + `MODERATE_RAIN`; `triggersAlert=true`. | PASS |
| `TC-RNR-006` | Heavy downpour classification & alert | `medium` sensitivity | `prob=90%`, `mm=9.5`, `WMO=65` | Classifies as `HIGH` + `HEAVY_RAIN`; `triggersAlert=true`. | PASS |
| `TC-RNR-007` | Mixed wintry precipitation (snow/sleet) | `medium` sensitivity | `prob=65%`, `mm=1.8`, `WMO=73` | Classifies as `MIXED_WINTRY`; `triggersAlert=true`. | PASS |
| `TC-RNR-008` | Multi-hour wet/dry windows & past-hour filtering | `now=10:30Z`, wet at `09:00Z` (past), `11:00–12:00Z`, dry `13:00–14:00Z`, wet `15:00Z` | 6-hour array | Filters out past `09:00Z` slot; merges `11:00Z` & `12:00Z` into Block 1 (`durationHours=2`, `peakProb=85%`, `peakMm=4.2`); splits `15:00Z` after 2h dry gap into Block 2 (`HEAVY_RAIN`). | PASS |

---

### Category 2: Probability Tiers, Intensity Thresholds & User Sensitivity (`TC-THR-001` – `TC-THR-013`)
**Automated File:** `tests/unit/classifier_and_thresholds.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-THR-001` | Exact probability tier boundary verification | Classifier unit | `0%, 34%, 34.9%, 35.0%, 45%, 59%, 59.9%, 60.0%, 100%` | `<35%` -> `LOW`; `35.0%..59.9%` -> `UNCERTAIN`; `>=60.0%` -> `HIGH`. | PASS |
| `TC-THR-002` | Exact precipitation intensity boundary verification | Classifier unit | `0.0, 0.09, 0.1, 0.49, 0.5, 2.49, 2.5, 7.59, 7.6, 25.0 mm/h` | Exact boundary cutoffs verified at `0.1`, `0.5`, `2.5`, and `7.6 mm/h`. | PASS |
| `TC-THR-003` | High sensitivity + drizzle allowed | `sensitivity='high'`, `suppressDrizzle=false` | `prob=35%`, `mm=0.2` | `triggersAlert=true`, `suppressionReason='NONE'`. | PASS |
| `TC-THR-004` | High sensitivity + explicit drizzle suppression | `sensitivity='high'`, `suppressDrizzle=true` | `prob=80%`, `mm=0.3` | `triggersAlert=false`, `suppressionReason='DRIZZLE_SUPPRESSED'`. | PASS |
| `TC-THR-005` | High sensitivity rejects `LOW` probability (`34.9%`) | `sensitivity='high'`, `suppressDrizzle=false` | `prob=34.9%`, `mm=3.0` | `triggersAlert=false`, `suppressionReason='BELOW_THRESHOLD'`. | PASS |
| `TC-THR-006` | Medium sensitivity suppresses light drizzle (`0.4 mm/h`) | `sensitivity='medium'` | `prob=90%`, `mm=0.4` | `triggersAlert=false`, `suppressionReason='DRIZZLE_SUPPRESSED'`. | PASS |
| `TC-THR-007` | Medium sensitivity suppresses `UNCERTAIN` + `LIGHT_RAIN` | `sensitivity='medium'` | `prob=50%`, `mm=1.0` | `triggersAlert=false`, `suppressionReason='BELOW_THRESHOLD'`. | PASS |
| `TC-THR-008` | Medium sensitivity alerts on `UNCERTAIN` + `MODERATE_RAIN` | `sensitivity='medium'` | `prob=45%`, `mm=3.2` | `triggersAlert=true`, `suppressionReason='NONE'`. | PASS |
| `TC-THR-009` | Medium sensitivity alerts on `HIGH` (`60%`) + `LIGHT_RAIN` (`0.5 mm/h`) | `sensitivity='medium'` | `prob=60%`, `mm=0.5` | `triggersAlert=true`, `suppressionReason='NONE'`. | PASS |
| `TC-THR-010` | Low sensitivity suppresses `HIGH` + `LIGHT_RAIN` | `sensitivity='low'` | `prob=75%`, `mm=1.8` | `triggersAlert=false`, `suppressionReason='BELOW_THRESHOLD'`. | PASS |
| `TC-THR-011` | Low sensitivity suppresses `UNCERTAIN` + `HEAVY_RAIN` | `sensitivity='low'` | `prob=55%`, `mm=8.0` | `triggersAlert=false`, `suppressionReason='BELOW_THRESHOLD'`. | PASS |
| `TC-THR-012` | Low sensitivity alerts on `HIGH` (`60%`) + `MODERATE_RAIN` (`2.5 mm/h`) | `sensitivity='low'` | `prob=60%`, `mm=2.5` | `triggersAlert=true`, `suppressionReason='NONE'`. | PASS |
| `TC-THR-013` | Custom combined probability + intensity gate (`prob >= 50%` AND `mm >= 1.0`) | `customMinProbability=50`, `customMinPrecipitationMm=1.0` | `(49.9%, 2.0mm)`, `(80%, 0.9mm)`, `(50.0%, 1.0mm)` | First two suppressed (`BELOW_THRESHOLD`); third passes (`triggersAlert=true`). | PASS |

---

### Category 3: Forecast Shifts (Cancellation, Rescheduling, Escalation, Anti-Flap Hysteresis) (`TC-SHF-001` – `TC-SHF-007`)
**Automated File:** `tests/unit/shifts_and_timing.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-SHF-001` | Dry-to-rain forecast flip | No active scheduled alerts | Forecast updates to `80% prob, 2.0 mm/h` at `14:00Z` | `shiftAction='NEW_SCHEDULE'`, schedules notification at `13:30Z` (`30m` lead time). | PASS |
| `TC-SHF-002` | Rain-to-dry flip BEFORE notification delivery | Pending scheduled alert for `14:00Z` (`alreadyDelivered=false`) | Next poll at `11:30Z` shows `10% prob, 0.0 mm/h` | `shiftAction='CANCELLED'`, cancels pending OS notification ID, `allClearNoticeSent=false` (avoids noisy cancellation push for an alert the user never saw). | PASS |
| `TC-SHF-003` | Rain-to-dry flip AFTER immediate alert was already delivered | Immediate alert for `11:10Z` already delivered (`alreadyDelivered=true`) | Radar clears at `11:05Z` (`5% prob, 0.0 mm/h`) | `shiftAction='CANCELLED'`, `allClearNoticeSent=true` so user knows rain cleared. | PASS |
| `TC-SHF-004` | Rain onset shifts EARLIER (`15:00Z -> 13:00Z`) | Scheduled alert for `15:00Z` | Updated forecast moves rain onset to `13:00Z` | `shiftAction='RESCHEDULED'`, cancels old notification ID and schedules new alert for `12:30Z`. | PASS |
| `TC-SHF-005` | Rain onset shifts LATER (`13:00Z -> 16:00Z`) | Scheduled alert for `13:00Z` | Updated forecast delays rain onset to `16:00Z` | `shiftAction='RESCHEDULED'`, cancels `12:30Z` alert and reschedules to `15:30Z`. | PASS |
| `TC-SHF-006` | Intensity escalation (`LIGHT_RAIN -> HEAVY_RAIN`) | Scheduled `LIGHT_RAIN` alert (`1.0 mm/h`) | Forecast escalates to `95% prob, 9.2 mm/h` (`HEAVY_RAIN`) 20m later | `shiftAction='ESCALATED'`, bypasses 180m cooldown, replaces old notification with urgent `"Heavy downpour"` copy. | PASS |
| `TC-SHF-007` | Oscillating borderline forecast anti-flap hysteresis (`60% -> 58%`) | Scheduled alert at `60% prob, 1.2 mm/h` | Next poll dips slightly to `58% prob, 1.1 mm/h` (within `3%` hysteresis margin) | `shiftAction='HYSTERESIS_HOLD'`, retains existing scheduled notification instead of flapping cancel/reschedule. | PASS |

---

### Category 4: Notification Timing (Immediate, Pre-Rain, Pre-Departure, Quiet Hours, DST) (`TC-TIM-001` – `TC-TIM-008`)
**Automated File:** `tests/unit/shifts_and_timing.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-TIM-001` | Immediate alert when rain onset is `<= 15m` away | `now=13:50Z`, `leadTime=30m` | Rain block starts at `14:00Z` (`10m` away) | `timingMode='IMMEDIATE'`, `scheduledTriggerMs=nowMs`, `alreadyDelivered=true`. | PASS |
| `TC-TIM-002` | Pre-rain lead time scheduling (`15m`, `30m`, `60m`) | `now=11:00Z`, rain onset `14:00Z` | `leadTimeMinutes` in `[15, 30, 60]` | `timingMode='PRE_RAIN'`, triggers at `13:45Z`, `13:30Z`, and `13:00Z` respectively. | PASS |
| `TC-TIM-003` | Pre-departure commute window alert | Morning commute `08:00–09:00 BST` (`07:00–08:00Z`), `preDepartureLeadMinutes=20` | Rain at `07:00Z` (`08:00 BST`), evaluated at `05:30Z` | `timingMode='PRE_DEPARTURE'`, scheduled for `06:40Z` (`07:40 BST`, 20m before departure). | PASS |
| `TC-TIM-004` | Quiet hours strict suppression (`22:00–07:00` local) | `quietHours.enabled=true`, `deferToEndOfQuietHours=false` | Rain at `23:00Z` (`00:00 BST`) | `shouldSchedule=false`, `suppressionReason='QUIET_HOURS_ACTIVE'`. | PASS |
| `TC-TIM-005` | Quiet hours deferral to `07:00` local when rain persists into morning | `deferToEndOfQuietHours=true` | Rain from `05:00 BST` to `09:00 BST` | Defers trigger to `07:00 BST` (`06:00 UTC` on `2026-10-24`). | PASS |
| `TC-TIM-006` | Quiet hours deferral cancelled if overnight rain ends before `07:00` | `deferToEndOfQuietHours=true` | Rain only `02:00–03:00 BST`, dry by `07:00 BST` | Suppresses alert (`QUIET_HOURS_ACTIVE`) rather than alerting at `07:00` for rain that already ended 4 hours ago. | PASS |
| `TC-TIM-007` | UK BST (`UTC+1`) to GMT (`UTC+0`) autumn DST transition | `timezone='Europe/London'`, Oct 24–25, 2026 | `2026-10-24T20:30Z` (`21:30 BST`) vs `2026-10-25T22:15Z` (`22:15 GMT`) | Accurately resolves local hour (`21` vs `22`) across the Oct 25, 2026 01:00 UTC DST fallback boundary. | PASS |
| `TC-TIM-008` | Past-event guard in scheduler | `now=16:00Z` | Block ended at `15:00Z` | `shouldSchedule=false`, `suppressionReason='PAST_EVENT'`. | PASS |

---

### Category 5: Duplicate Suppression, Cooldowns, Daily Caps & Severe Overrides (`TC-DED-001` – `TC-DED-007`)
**Automated File:** `tests/unit/dedup_permissions_location.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-DED-001` | Deterministic SHA-256 block fingerprinting | `locationKey + blockStartIso` | Same location + start time vs different city | Identical 16-char SHA-256 prefix for same location/block; distinct hash when city changes. | PASS |
| `TC-DED-002` | Idempotent duplicate suppression on consecutive background runs | Alert already scheduled for `14:00Z` block | Background task runs 15m later with identical forecast | `shouldSchedule=false`, `shiftAction='NO_CHANGE'`, `suppressionReason='DUPLICATE_FINGERPRINT'`, `deliveredTodayCount` unchanged (`1`). | PASS |
| `TC-DED-003` | Cooldown window (`180m`) suppresses re-alerting for same block | Previous alert at `10:00Z`, `cooldownMinutes=180` | Re-evaluated at `11:00Z` (`60m` elapsed) | `shouldSchedule=false`, `suppressionReason='COOLDOWN_ACTIVE'`. | PASS |
| `TC-DED-004` | Cooldown window expiration after `180m` | Previous alert at `10:00Z`, `cooldownMinutes=180` | Re-evaluated at `13:01Z` (`181m` elapsed) | `shouldSchedule=true`, `suppressionReason='NONE'`. | PASS |
| `TC-DED-005` | Daily notification cap (`maxDailyNotifications=3`) | `deliveredTodayCount=3` on `2026-10-23` | 4th distinct rain block at `18:00Z` | `shouldSchedule=false`, `suppressionReason='DAILY_CAP_REACHED'`. | PASS |
| `TC-DED-006` | Automatic daily cap reset at local midnight rollover | `deliveredTodayCount=3` on `2026-10-23` | Evaluated on `2026-10-24T08:00Z` | Resets `deliveredTodayCount` to `0`, updates `currentDayKey='2026-10-24'`, schedules alert (`count=1`). | PASS |
| `TC-DED-007` | Severe heavy downpour override (`allowSevereOverrideDailyCap=true`) | `deliveredTodayCount=3`, `allowSevereOverrideDailyCap=true` | `HEAVY_RAIN` (`95% prob, 11.0 mm/h`) | Overrides daily cap for severe downpour and schedules alert. | PASS |

---

### Category 6: Notification Permissions (`TC-PRM-001` – `TC-PRM-006`)
**Automated File:** `tests/unit/dedup_permissions_location.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-PRM-001` | Permission `granted` | Standard OS state | `previous='granted'`, `current='granted'` | `canScheduleNotifications=true`, `showSettingsBanner=false`. | PASS |
| `TC-PRM-002` | Permission `denied` | User declined prompt | `previous='undetermined'`, `current='denied'` | `canScheduleNotifications=false`, `showSettingsBanner=true`, `suppressionReason='PERMISSION_DENIED_OR_REVOKED'`. | PASS |
| `TC-PRM-003` | Permission `undetermined` | Fresh install before onboarding | `current='undetermined'` | Suppresses background scheduling until user completes onboarding permission flow. | PASS |
| `TC-PRM-004` | iOS `provisional` quiet authorization | iOS `UNAuthorizationOptionProvisional` | `current='provisional'` | `canScheduleNotifications=true`, schedules quiet Notification Summary delivery. | PASS |
| `TC-PRM-005` | Mid-session OS permission revocation (`granted -> denied`) | 1 active scheduled notification | User disables notifications in OS Settings (`current='denied'`) | Detects `effectiveStatus='revoked'`, `shiftAction='CANCELLED'`, cancels pending OS notification IDs, sets `showSettingsBanner=true`. | PASS |
| `TC-PRM-006` | Permission re-granted in OS Settings (`revoked -> granted`) | Previously `revoked` | User re-enables notifications (`current='granted'`) | Restores `effectiveStatus='granted'`, hides banner, resumes scheduling. | PASS |

---

### Category 7: Location Changes, City Switch & GPS Fallback (`TC-LOC-001` – `TC-LOC-007`)
**Automated File:** `tests/unit/dedup_permissions_location.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-LOC-001` | City switch (`London -> Manchester`, `~262 km`) | `lastKnown=London (51.5074, -0.1278)` | Live GPS `Manchester (53.4808, -2.2426)` | Haversine distance `> 5.0 km` (`~262.3 km`); sets `cacheInvalidated=true` and updates location fingerprint. | PASS |
| `TC-LOC-002` | Minor local movement (`< 5 km`, Westminster -> Soho `~0.9 km`) | `lastKnown=London` | Live GPS `Soho (51.5136, -0.1365)` | Distance `< 5.0 km`; preserves existing forecast cache (`cacheInvalidated=false`). | PASS |
| `TC-LOC-003` | GPS timeout / hardware error fallback to `lastKnownCoords` | `lastKnown=London` | `gpsError='E_LOCATION_TIMEOUT'` | Falls back to `last_known_cache` (`London`) with warning; does not crash. | PASS |
| `TC-LOC-004` | GPS failure with no cached coords falls back to default London | No cache, no manual city | `gpsError='E_LOCATION_UNAVAILABLE'` | Falls back to `default_fallback` (`London 51.5074, -0.1278`). | PASS |
| `TC-LOC-005` | Location permission `denied` uses user's manual pinned city | `locationPermission='denied'` | `manualPinnedCity=Edinburgh (55.9533, -3.1883)` | Uses `manual_override` (`Edinburgh`), invalidating stale London cache. | PASS |
| `TC-LOC-006` | Manual pinned city overrides live GPS when user locks city | `isManualFallback=true` | `manualPinnedCity=Bristol` | Prioritizes `manual_override` (`Bristol`) over live GPS. | PASS |
| `TC-LOC-007` | Invalid / out-of-range / `NaN` GPS coordinates rejected | `lastKnown=London` | `lat=95`, `lat=-91`, `lon=185`, `lat=NaN` | `isValidCoordinates` returns `false`; falls back safely to `lastKnownCoords`. | PASS |

---

### Category 8: Missing & Malformed API Data (`TC-MAL-001` – `TC-MAL-008`)
**Automated File:** `tests/unit/malformed_offline_background.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-MAL-001` | Null, undefined, or primitive API response | Validator unit | `null`, `undefined`, `'invalid'` | `isValid=false` with descriptive schema error; zero unhandled exceptions. | PASS |
| `TC-MAL-002` | Missing `hourly` object or non-array fields | Validator unit | `{ latitude: 51.5 }`, `{ hourly: { time: 'str' } }` | `isValid=false`; reports missing/non-array fields. | PASS |
| `TC-MAL-003` | Empty `hourly` arrays | Validator unit | `time: [], precipitation_probability: [], precipitation: []` | `isValid=false` (`Hourly arrays must not be empty`). | PASS |
| `TC-MAL-004` | Mismatched array lengths across `time`, `prob`, `precip` | Validator unit | `time(3)`, `prob(2)`, `precip(3)` | Truncates safely to shortest overlapping length (`2`), records `droppedCount=1` and mismatch warning. | PASS |
| `TC-MAL-005` | Isolated `null` or `NaN` in one metric while sibling metric is valid | Validator unit | `[prob=null, mm=1.5]`, `[prob=85, mm=NaN]` | Sanitizes missing metric to `0`, increments `sanitizedCount=2`, retains valid points. | PASS |
| `TC-MAL-006` | Both `probability` AND `precipitation` are `null`/`undefined` | Validator unit | Row 0 `[null, undefined]`, Row 1 `[75, 2.0]` | Drops corrupted Row 0 (`droppedCount=1`), preserves valid Row 1. | PASS |
| `TC-MAL-007` | Out-of-range probability (`140%`, `-15%`) and negative precipitation (`-2.5 mm`) | Validator unit | `prob=[140, -15]`, `mm=[-2.5, 3.4]` | Clamps probability to `[0, 100]` (`100%`, `0%`) and precipitation to `>= 0` (`0.0`, `3.4`). | PASS |
| `TC-MAL-008` | Unparseable / corrupted ISO timestamps | Validator unit | `time=['not-a-timestamp', '']` | Drops corrupted rows; returns `isValid=false` when `0` valid points remain. | PASS |

---

### Category 9: Offline Cached State & Staleness Tiers (`TC-OFF-001` – `TC-OFF-005`)
**Automated File:** `tests/unit/malformed_offline_background.test.ts`

| Test ID | Scenario | Preconditions | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-OFF-001` | Fresh cache (`<= 1 hour` old) | Offline mode | `fetchedAt = now - 30m` | `tier='fresh'`, `canTriggerAlerts=true`. | PASS |
| `TC-OFF-002` | Aging cache (`1 – 6 hours` old) | Offline mode | `fetchedAt = now - 3h` | `tier='aging'`, `canTriggerAlerts=true`. | PASS |
| `TC-OFF-003` | Stale cache (`6 – 12 hours` old) | Offline mode | `fetchedAt = now - 9h` | `tier='stale'`, `canTriggerAlerts=true` (with staleness indicator). | PASS |
| `TC-OFF-004` | Expired cache (`> 12 hours` old) blocks false-confidence alerts | Offline mode | `fetchedAt = now - 13h` | `tier='expired'`, `canTriggerAlerts=false` (`CACHE_EXPIRED_STALE`). | PASS |
| `TC-OFF-005` | Missing or malformed `fetchedAtIso` timestamp | Offline mode | `undefined`, `'bad-date'` | `tier='expired'`, `canTriggerAlerts=false`. | PASS |

---

### Category 10: iOS & Android Background Execution Limitations (`TC-BKG-001` – `TC-BKG-008`)
**Automated File:** `tests/unit/malformed_offline_background.test.ts`

| Test ID | Scenario | Platform / Mechanism | Test Inputs | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TC-BKG-001` | iOS `BGAppRefreshTask` 30s execution budget watchdog | iOS `BGTaskScheduler` | `osExecutionBudgetMs=30000` | Bounds task watchdog to `25000ms`, single fetch timeout `<=8000ms`, `maxRetryAttempts=2`, and enables `relyOnPreScheduledHorizon=true`. | PASS |
| `TC-BKG-002` | iOS Background App Refresh disabled / Low Power Mode | iOS `UIBackgroundRefreshStatusDenied` | `iosBackgroundRefreshAvailable=false` | Skips background network fetch (`canExecuteNetworkFetch=false`) and relies on 24h pre-scheduled local notification horizon + foreground resume piggybacking. | PASS |
| `TC-BKG-003` | Android `WorkManager` minimum 15-minute periodic interval | Android `PeriodicWorkRequest` | `requestedMinutes=5` vs `30` | Clamps `5m` request to `15m` (`clamped=true`) per Android OS enforcement; keeps `30m` unchanged. | PASS |
| `TC-BKG-004` | Android deep Doze Mode restriction | Android Doze / App Standby | `androidDozeModeActive=true` | Defers network fetch outside maintenance window (`canExecuteNetworkFetch=false`) and relies on pre-scheduled local notification triggers. | PASS |
| `TC-BKG-005` | Opportunistic foreground resume piggybacking (`AppState='active'`) | iOS & Android foreground transition | `lastFetch=20m ago` vs `5m ago` | Triggers immediate refresh when cache is `>=15m` old; skips redundant network fetch when cache is `<15m` old. | PASS |
| `TC-BKG-006` | Rolling 24-hour local notification horizon builder | iOS `UNCalendarNotificationTrigger` / Android Alarm | 4 distinct rain blocks across next 24h (`maxDailyNotifications=3`) | Pre-schedules local notifications for the first 3 rain blocks (`10:30Z`, `15:30Z`, `20:30Z`) so user is alerted even if OS throttles background tasks for 12+ hours. | PASS |
| `TC-BKG-007` | Exponential backoff with bounded jitter | Network retry policy | Attempts `1, 2, 3, 10` (`base=1000ms, max=16000ms`) | Backoff scales `1000ms -> 2000ms -> 4000ms` and caps at `16000ms`. | PASS |
| `TC-BKG-008` | HTTP 429 `Retry-After` header compliance | Rate-limit handling | `retryAfterSeconds=6` | Waits exact `6000ms` (bounded by `maxDelayMs`). | PASS |

---

### Category 11: End-to-End Integration Pipeline (`TC-INT-001` – `TC-INT-008`)
**Automated File:** `tests/integration/e2e_pipeline.test.ts`

| Test ID | Scenario | End-to-End Flow Verified | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `TC-INT-001` | Full commuter day lifecycle | Dry morning (`09:00Z`) -> Light rain scheduled (`09:30Z`) -> Heavy downpour escalation (`10:00Z`) -> Forecast clears cancellation (`11:00Z`) | Transitions cleanly: `SUPPRESSED` -> `NEW_SCHEDULE` -> `ESCALATED` -> `CANCELLED`. | PASS |
| `TC-INT-002` | Live API HTTP 503 outage with valid 2h cache | API returns `503 Service Unavailable`; 2h-old cache exists for same city | `usedCacheFallback=true`, `cacheFreshnessTier='aging'`, schedules rain alert seamlessly. | PASS |
| `TC-INT-003` | Live API HTTP 504 outage with expired (`15h`) cache | API fails; cache is `15h` old (`>12h` limit) | `usedCacheFallback=true`, `cacheFreshnessTier='expired'`, suppresses alert (`CACHE_EXPIRED_STALE`). | PASS |
| `TC-INT-004` | Offline inter-city travel (`London -> Manchester`) | User travels 262 km to Manchester while offline with cached London rain | Detects `>5 km` shift (`cacheInvalidatedByLocationShift=true`), refuses to apply London cache to Manchester (`usedCacheFallback=false`). | PASS |
| `TC-INT-005` | Mid-session OS notification permission revocation | Alert scheduled at `10:00Z`; user revokes permission in OS Settings at `10:10Z` | `effectiveNotificationPermission='revoked'`, cancels scheduled notification ID, clears 24h horizon, sets `showSettingsBanner=true`. | PASS |
| `TC-INT-006` | Partially malformed live API payload recovery | Payload contains `null` row and `'corrupted-timestamp'` alongside valid `13:00Z` rain | Sanitizes/drops bad rows with warnings and still schedules valid `13:00Z` alert. | PASS |
| `TC-INT-007` | Morning commute pre-departure alert end-to-end | Rain at `08:00 BST` overlaps `08:00–09:00 BST` commute window (`lead=20m`) | Schedules `PRE_DEPARTURE` notification at `07:40 BST` (`06:40Z`). | PASS |
| `TC-INT-008` | Multi-block 24-hour rolling horizon pre-scheduling | 3 separated storm blocks at `11:00Z`, `16:00Z`, `20:00Z` | Populates `rollingHorizonSchedules` with all 3 local notification triggers in a single evaluation pass. | PASS |

---

## 4. Test Execution Instructions

To run the complete automated verification suite and TypeScript static typecheck:

```bash
cd /workspace/rainy-innit-team/forge
npm run typecheck
npm test
```

Individual suites can also be run directly:

```bash
npm run test:unit
npm run test:integration
```
