# Rainy innit

Know when it's gonna rain. Innit.

A British umbrella assistant. It asks one question — **do I need to take my umbrella?** — and answers from a live Open-Meteo observation plus the hourly forecast. If the answer is yes, it can nudge you before the rain or before you usually leave. If the forecast is sat in the middle, it says so and stays quiet.

No weather API key. Notifications are scheduled on the phone. Nothing here is a made-up forecast: if the network fails, you get the last saved reading or an honest error. Simulated skies exist only on the settings bench and in tests, and they are labelled `SIMULATED`.

## Run it

Node 20 or newer.

```bash
npm install
npm start
```

Web, on a port that stays out of the way:

```bash
npx expo start --web --port 43123
```

iOS simulator: `npm run ios`. Android: `npm run android`. The first launch asks for a place (London, Manchester, Edinburgh, Bristol, Cardiff, search, or GPS) and for notification permission. You can skip the permission and still use the forecast.

## Checks

```bash
npx tsc --noEmit
npm test
npx expo export --platform web
```

`npm test` is Jest and ts-jest. It does not call Open-Meteo. The suite covers rain and no rain, the 35–59% uncertain band, sensitivity and drizzle, cancellation when a queued alert's probability falls below the cancel line, immediate versus lead-time versus departure timing, duplicates, cooldown, the daily cap, quiet hours, malformed payloads, the offline cache, and the live-versus-forecast tags.

## How it is put together

Expo SDK 52, React Native, TypeScript in strict mode, Expo Router.

| Tab | Job |
| --- | --- |
| Today | The umbrella answer, the reason, the next rain window, a link through to the forecast. |
| Forecast | Live conditions, a 24-hour chance-of-rain chart, hourly rows, seven days. |
| Settings | Departure, lead time, sensitivity, drizzle, quiet hours, place, and the notification bench. |

The decision engine is a pure function in `src/engine`. Thresholds live in `src/config/defaults.ts` (`60%` medium, `40%` sensitive, `75%` relaxed, uncertain from `35%` to `59%`, and the rest of the fatigue rules). The UI and the notifier both call that function, so the sentence and the push cannot drift.

Weather data is from [Open-Meteo](https://open-meteo.com/). Their hourly chance of rain is the probability of more than 0.1 mm in that hour, which is what the chart caption says. It is not the fraction of the hour that will be wet.

## Docs

- [Notification strategy](docs/research/notification_strategy.md) — what a chance of rain means, why the thresholds sit where they do, Brier score and reliability, and what this version does not claim.
- [Architecture](docs/architecture.md) — data flow, shared types, and which module is allowed to do what.
- [Notification engine](docs/notification_engine.md) — rules, config schema, state machine, dedupe, cancellation, and why iOS background refresh and Android WorkManager are not the alarm clock.
- [Test plan](docs/qa/test_plan.md) — matrix, automated coverage, and the manual pass.

## Licence of the weather

Open-Meteo data is used under their attribution terms. The forecast screen credits Open-Meteo. This project is not the Met Office.
