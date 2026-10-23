# Rainy innit — Automated Test Execution Report (Forge QA)

- **Executed At:** Friday, Oct 23, 2026, 9:14 AM (Europe/London, UTC+1 / BST)
- **Test Runner:** `node --import tsx --test` (Node.js `v20.19.2`, TypeScript `7.0.2`)
- **Static Typecheck (`npm run typecheck`):** PASS (`0` errors)
- **Total Suites:** `11`
- **Total Test Cases:** `85`
- **Passed:** `85` (`100.0%`)
- **Failed:** `0`
- **Skipped:** `0`

## Suite Breakdown

| Suite File | Categories Covered | Test Count | Pass | Fail |
| :--- | :--- | :---: | :---: | :---: |
| `tests/unit/classifier_and_thresholds.test.ts` | Category 1 (Rain vs No-Rain `TC-RNR-001..008`) & Category 2 (Probability Tiers `High >=60%`, `Uncertain 35%–59%`, `Low <35%`, Intensity Boundaries & Sensitivity Profiles `TC-THR-001..013`) | 21 | 21 | 0 |
| `tests/unit/shifts_and_timing.test.ts` | Category 3 (Forecast Shifts: Cancel, Reschedule, Escalate, Hysteresis `TC-SHF-001..007`) & Category 4 (Timing: Immediate, Pre-Rain `15/30/60m`, Pre-Departure Commute, Quiet Hours, UK BST/GMT DST `TC-TIM-001..008`) | 15 | 15 | 0 |
| `tests/unit/dedup_permissions_location.test.ts` | Category 5 (Deduplication, `180m` Cooldowns, Daily Cap `max=3` & Severe Override `TC-DED-001..007`), Category 6 (Permissions `TC-PRM-001..006`) & Category 7 (Location Switch `>5km` & GPS Fallback `TC-LOC-001..007`) | 20 | 20 | 0 |
| `tests/unit/malformed_offline_background.test.ts` | Category 8 (Missing/Malformed Data `TC-MAL-001..008`), Category 9 (Offline Cache Tiers `TC-OFF-001..005`) & Category 10 (iOS `BGAppRefreshTask` / Android `WorkManager` / Doze / 24h Rolling Horizon `TC-BKG-001..008`) | 21 | 21 | 0 |
| `tests/integration/e2e_pipeline.test.ts` | Category 11 (End-to-End Multi-Stage Integration Pipeline `TC-INT-001..008`) | 8 | 8 | 0 |
| **Total** | **All 11 Categories** | **85** | **85** | **0** |

## Raw Spec Runner Output

```text
▶ End-to-End Integration Pipeline (TC-INT-001..010)
  ✔ TC-INT-001: Full lifecycle: Dry morning -> Midday rain scheduled -> Afternoon intensity escalation -> Rain clears cancellation (19.932461ms)
  ✔ TC-INT-002: Live API 503 outage falls back to valid 2-hour-old offline cache and schedules alert (0.797942ms)
  ✔ TC-INT-003: Live API outage with expired (>12h old) cache suppresses false-confidence alert (0.642941ms)
  ✔ TC-INT-004: City switch (London -> Manchester) while offline invalidates London cache and avoids false alert (0.328214ms)
  ✔ TC-INT-005: Mid-session OS notification permission revocation cancels active scheduled notifications and shows UI banner (1.144732ms)
  ✔ TC-INT-006: Partial malformed API payload sanitizes bad hours and still schedules valid afternoon rain block (0.900973ms)
  ✔ TC-INT-007: Morning pre-departure commute alert triggers at 07:40 BST when rain hits 08:00 BST commute (0.732353ms)
  ✔ TC-INT-008: Rolling 24h horizon pre-schedules multiple separated rain blocks to survive iOS/Android background throttling (1.206608ms)
✔ End-to-End Integration Pipeline (TC-INT-001..010) (27.401098ms)
▶ Category 1: Rain vs No-Rain Forecasts (TC-RNR-001..008)
  ✔ TC-RNR-001: Clear sky (0% prob, 0.0 mm/h, WMO 0) classifies as DRY and does not trigger alert (1.017155ms)
  ✔ TC-RNR-002: Overcast dry sky with high cloud probability (75% prob, 0.0 mm/h, WMO 3) stays DRY and suppresses alert (0.225351ms)
  ✔ TC-RNR-003: Light drizzle (0.2 mm/h, WMO 51) classifies as DRIZZLE (0.123734ms)
  ✔ TC-RNR-004: Light rain (1.2 mm/h, 70% prob, WMO 61) classifies as LIGHT_RAIN and triggers alert on medium sensitivity (0.155775ms)
  ✔ TC-RNR-005: Moderate rain (4.0 mm/h, 65% prob, WMO 63) classifies as MODERATE_RAIN and triggers alert (0.125016ms)
  ✔ TC-RNR-006: Heavy downpour (9.5 mm/h, 90% prob, WMO 65) classifies as HEAVY_RAIN and triggers alert (0.119037ms)
  ✔ TC-RNR-007: Mixed wintry precipitation / snow / sleet (WMO 73, 1.8 mm/h, 65% prob) classifies as MIXED_WINTRY and alerts (0.113529ms)
  ✔ TC-RNR-008: Multi-hour wet/dry windows group contiguous wet hours into distinct RainBlocks and filter past hours (1.199661ms)
✔ Category 1: Rain vs No-Rain Forecasts (TC-RNR-001..008) (4.44573ms)
▶ Category 2: Probability Tiers, Intensity Boundaries & User Sensitivity (TC-THR-001..016)
  ✔ TC-THR-001: Exact probability tier boundaries for LOW (<35%), UNCERTAIN (35%–59%), and HIGH (>=60%) (0.384317ms)
  ✔ TC-THR-002: Exact precipitation intensity boundaries (0.09 vs 0.1, 0.49 vs 0.5, 2.49 vs 2.5, 7.59 vs 7.6 mm/h) (0.169717ms)
  ✔ TC-THR-003: High sensitivity alerts on UNCERTAIN (35%) + DRIZZLE (0.2 mm/h) when suppressDrizzle is false (0.143627ms)
  ✔ TC-THR-004: High sensitivity suppresses DRIZZLE (0.3 mm/h) when user enables suppressDrizzle=true (0.203764ms)
  ✔ TC-THR-005: High sensitivity rejects LOW probability (34.9%) even with moderate rain (0.17872ms)
  ✔ TC-THR-006: Medium sensitivity suppresses DRIZZLE (0.4 mm/h) even at 90% probability (0.120187ms)
  ✔ TC-THR-007: Medium sensitivity suppresses UNCERTAIN (50%) + LIGHT_RAIN (1.0 mm/h) (0.16107ms)
  ✔ TC-THR-008: Medium sensitivity alerts on UNCERTAIN (45%) when intensity is MODERATE_RAIN (3.2 mm/h) (0.106356ms)
  ✔ TC-THR-009: Medium sensitivity alerts on HIGH (60%) + LIGHT_RAIN (0.5 mm/h) (0.09349ms)
  ✔ TC-THR-010: Low sensitivity suppresses HIGH (75%) + LIGHT_RAIN (1.8 mm/h) (0.27284ms)
  ✔ TC-THR-011: Low sensitivity suppresses UNCERTAIN (55%) + HEAVY_RAIN (8.0 mm/h) (0.120508ms)
  ✔ TC-THR-012: Low sensitivity alerts on HIGH (60%) + MODERATE_RAIN (2.5 mm/h) (0.092711ms)
  ✔ TC-THR-013: Combined custom user probability & intensity gate passes only when BOTH thresholds met (0.106812ms)
✔ Category 2: Probability Tiers, Intensity Boundaries & User Sensitivity (TC-THR-001..016) (2.542316ms)
▶ Category 5: Duplicate Suppression, Cooldowns, and Daily Caps (TC-DED-001..007)
  ✔ TC-DED-001: Deterministic SHA-256 block fingerprint produces identical hash for same location + block start (0.867889ms)
  ✔ TC-DED-002: Idempotent repeat background evaluation suppresses duplicate notification (NO_CHANGE / DUPLICATE_FINGERPRINT) (14.506971ms)
  ✔ TC-DED-003: Cooldown window (180m) suppresses re-alerting for a block fingerprint when active schedule was cleared (0.492239ms)
  ✔ TC-DED-004: Cooldown expires after 180 minutes, permitting new alert if needed (0.579595ms)
  ✔ TC-DED-005: Daily cap (maxDailyNotifications = 3) suppresses 4th notification on the same local day (0.59426ms)
  ✔ TC-DED-006: Daily cap resets automatically to 0 when local calendar day rolls over (0.473157ms)
  ✔ TC-DED-007: Severe heavy rain override bypasses daily cap when allowSevereOverrideDailyCap=true and tier is HEAVY_RAIN (0.483592ms)
✔ Category 5: Duplicate Suppression, Cooldowns, and Daily Caps (TC-DED-001..007) (19.224804ms)
▶ Category 6: Notification Permissions (Granted, Denied, Provisional, Revoked) (TC-PRM-001..006)
  ✔ TC-PRM-001: Permission granted allows local notification scheduling (0.375044ms)
  ✔ TC-PRM-002: Permission denied suppresses scheduling and enables UI settings banner (0.447984ms)
  ✔ TC-PRM-003: Permission undetermined suppresses background scheduling until onboarding prompt resolves (0.363959ms)
  ✔ TC-PRM-004: iOS provisional permission allows quiet notification scheduling (0.363059ms)
  ✔ TC-PRM-005: Mid-session OS permission revocation (granted -> denied) transitions to revoked and cancels pending notifications (1.622323ms)
  ✔ TC-PRM-006: Re-granting permission in OS settings (revoked -> granted) restores scheduling capability (0.161968ms)
✔ Category 6: Notification Permissions (Granted, Denied, Provisional, Revoked) (TC-PRM-001..006) (3.705595ms)
▶ Category 7: Location Changes, City Switch & GPS Fallback (TC-LOC-001..007)
  ✔ TC-LOC-001: City switch (London -> Manchester, ~262 km) exceeds 5 km threshold and invalidates forecast cache (0.514167ms)
  ✔ TC-LOC-002: Minor local walk (< 5 km, Westminster -> Soho ~0.9 km) keeps forecast cache valid (0.182387ms)
  ✔ TC-LOC-003: GPS hardware timeout / error falls back gracefully to lastKnownCoords (0.365654ms)
  ✔ TC-LOC-004: GPS failure with no cached location and no manual city falls back to default London coordinates (0.158688ms)
  ✔ TC-LOC-005: Location permission denied uses user-pinned manual city when configured (0.305707ms)
  ✔ TC-LOC-006: Manual pinned city with isManualFallback=true overrides live GPS when user locks city (0.183135ms)
  ✔ TC-LOC-007: Out-of-range and NaN coordinates are rejected by validator and trigger fallback (0.157334ms)
✔ Category 7: Location Changes, City Switch & GPS Fallback (TC-LOC-001..007) (2.198582ms)
▶ Category 8: Missing & Malformed API Data (TC-MAL-001..008)
  ✔ TC-MAL-001: Rejects null, undefined, or primitive forecast payloads cleanly (1.104232ms)
  ✔ TC-MAL-002: Rejects payload missing hourly object or with non-array fields (0.327839ms)
  ✔ TC-MAL-003: Rejects empty hourly arrays (0.159767ms)
  ✔ TC-MAL-004: Truncates mismatched array lengths safely to shortest array and records warning (0.330466ms)
  ✔ TC-MAL-005: Sanitizes isolated null/NaN probability or precipitation when the other metric is valid (0.194774ms)
  ✔ TC-MAL-006: Drops hourly row when BOTH probability and precipitation are null/NaN (0.141765ms)
  ✔ TC-MAL-007: Clamps out-of-range probability (<0 or >100) and negative precipitation (<0) (0.17988ms)
  ✔ TC-MAL-008: Drops rows with malformed timestamps and fails if all rows are corrupted (0.293393ms)
✔ Category 8: Missing & Malformed API Data (TC-MAL-001..008) (3.912837ms)
▶ Category 9: Offline Cached State & Staleness Tiers (TC-OFF-001..005)
  ✔ TC-OFF-001: Cache fetched <= 1 hour ago classifies as fresh and allows alerts (0.567895ms)
  ✔ TC-OFF-002: Cache fetched 1–6 hours ago classifies as aging and allows alerts (0.178056ms)
  ✔ TC-OFF-003: Cache fetched 6–12 hours ago classifies as stale and allows degraded alerts (0.105804ms)
  ✔ TC-OFF-004: Cache fetched > 12 hours ago classifies as expired and blocks false-confidence alerts (0.174252ms)
  ✔ TC-OFF-005: Missing or corrupted fetchedAtIso timestamp classifies as expired (0.107142ms)
✔ Category 9: Offline Cached State & Staleness Tiers (TC-OFF-001..005) (1.363822ms)
▶ Category 10: iOS & Android Background Execution Limitations (TC-BKG-001..008)
  ✔ TC-BKG-001: iOS BGAppRefreshTask enforces 25s watchdog cap inside 30s OS budget and limits retries to 2 (0.379964ms)
  ✔ TC-BKG-002: iOS Background App Refresh disabled (or Low Power Mode) skips background network fetch and relies on 24h pre-scheduled local horizon (0.212187ms)
  ✔ TC-BKG-003: Android WorkManager clamps sub-15-minute interval requests to 15 minutes minimum (0.171119ms)
  ✔ TC-BKG-004: Android deep Doze Mode defers network fetch and relies on pre-scheduled local notification triggers (0.090732ms)
  ✔ TC-BKG-005: Opportunistic foreground resume piggybacks network refresh when cache is >= 15 minutes old (0.23321ms)
  ✔ TC-BKG-006: Rolling 24-hour local notification horizon pre-schedules multiple rain blocks up to daily cap so OS background throttling does not miss alerts (1.019885ms)
  ✔ TC-BKG-007: Exponential backoff with bounded jitter increases across attempts and caps at maxDelayMs (0.233017ms)
  ✔ TC-BKG-008: HTTP 429 Retry-After header is respected up to maxDelayMs (0.120908ms)
✔ Category 10: iOS & Android Background Execution Limitations (TC-BKG-001..008) (2.781983ms)
▶ Category 3: Forecast Shifts (Cancellation, Rescheduling, Escalation, Hysteresis) (TC-SHF-001..007)
  ✔ TC-SHF-001: Dry-to-rain flip schedules a new notification (NEW_SCHEDULE) (16.248186ms)
  ✔ TC-SHF-002: Rain-to-dry flip BEFORE delivery cancels pending local notification without all-clear push (1.888268ms)
  ✔ TC-SHF-003: Rain-to-dry flip AFTER immediate notification was already delivered emits allClearNoticeSent=true (0.756445ms)
  ✔ TC-SHF-004: Forecast start-time shift earlier (15:00Z -> 13:00Z) cancels old notification and reschedules earlier (RESCHEDULED) (1.058039ms)
  ✔ TC-SHF-005: Forecast start-time shift later (13:00Z -> 16:00Z) cancels early alert and reschedules to 15:30Z (0.741837ms)
  ✔ TC-SHF-006: Intensity escalation (LIGHT_RAIN -> HEAVY_RAIN on same block) triggers ESCALATED and bypasses cooldown (1.187854ms)
  ✔ TC-SHF-007: Anti-flap hysteresis holds existing scheduled notification when probability oscillates from 60% to 58% (0.729483ms)
✔ Category 3: Forecast Shifts (Cancellation, Rescheduling, Escalation, Hysteresis) (TC-SHF-001..007) (23.85127ms)
▶ Category 4: Notification Timing (Immediate, Pre-Rain, Pre-Departure, Quiet Hours, DST) (TC-TIM-001..008)
  ✔ TC-TIM-001: Immediate alert fires at nowMs when rain starts within <= 15 minutes (0.757015ms)
  ✔ TC-TIM-002: Pre-rain lead time schedules accurately for 15m, 30m, and 60m user settings (1.047114ms)
  ✔ TC-TIM-003: Pre-departure commute window schedules alert at departureStart minus preDepartureLeadMinutes (0.89414ms)
  ✔ TC-TIM-004: Quiet hours (22:00–07:00 Europe/London) suppresses overnight notification when deferToEndOfQuietHours=false (0.577168ms)
  ✔ TC-TIM-005: Quiet hours deferral schedules notification at 07:00 local time if rain block continues past 07:00 (1.818684ms)
  ✔ TC-TIM-006: Quiet hours deferral suppresses alert if overnight rain ends BEFORE 07:00 local wake time (2.299487ms)
  ✔ TC-TIM-007: Europe/London BST (UTC+1) to GMT (UTC+0) autumn DST transition resolves local hours accurately (0.940563ms)
  ✔ TC-TIM-008: Past-event filtering suppresses blocks that have already ended before nowMs (0.458718ms)
✔ Category 4: Notification Timing (Immediate, Pre-Rain, Pre-Departure, Quiet Hours, DST) (TC-TIM-001..008) (9.29495ms)
ℹ tests 85
ℹ suites 11
ℹ pass 85
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 448.015251
```
