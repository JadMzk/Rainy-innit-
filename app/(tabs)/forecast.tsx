import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CurrentWeatherCard, DailyForecastList, HourlyForecastList } from '../../src/components/ForecastPanels';
import { RainProbabilityChart } from '../../src/components/RainProbabilityChart';
import { DEFAULT_NOTIFICATION_CONFIG } from '../../src/config/defaults';
import { parseUtcMs } from '../../src/engine/clock';
import { thresholdForSensitivity } from '../../src/engine/umbrellaDecision';
import { useAppState } from '../../src/state/AppState';
import { font, theme } from '../../src/theme/theme';

export default function ForecastScreen() {
  const insets = useSafeAreaInsets();
  const { weather, preferences, loadingWeather, weatherError, fromCache, refresh } = useAppState();
  const threshold = thresholdForSensitivity(preferences.rainSensitivity, DEFAULT_NOTIFICATION_CONFIG);

  const hourly = useMemo(() => {
    if (!weather) return [];
    const now = Date.now() - 30 * 60_000;
    return weather.hourly.filter((hour) => parseUtcMs(hour.timeIso) >= now).slice(0, 24);
  }, [weather]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={<RefreshControl refreshing={loadingWeather} onRefresh={() => void refresh()} tintColor={theme.cream} />}
    >
      <Text style={styles.kicker}>The proper forecast</Text>
      <Text style={styles.title}>What's actually coming</Text>
      <Text style={styles.intro}>
        Live weather up top. Then the chance of rain, hour by hour, and the week. The home screen stays a single answer.
      </Text>

      {fromCache && weatherError ? (
        <Text style={styles.warn}>Offline fallback. Last saved forecast is on screen. {weatherError}</Text>
      ) : null}

      {!weather && loadingWeather ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.cream} />
          <Text style={styles.intro}>Fetching Open-Meteo…</Text>
        </View>
      ) : null}

      {!weather && !loadingWeather ? (
        <Text style={styles.intro}>{weatherError ?? 'No forecast yet. Set a location and pull to refresh.'}</Text>
      ) : null}

      {weather ? (
        <>
          <CurrentWeatherCard location={weather.location} current={weather.current} />
          <RainProbabilityChart
            hours={hourly}
            thresholdPct={threshold.pct}
            uncertaintyMinPct={DEFAULT_NOTIFICATION_CONFIG.uncertaintyBandMinPct}
          />
          <Text style={styles.section}>Hourly</Text>
          <HourlyForecastList hours={hourly} />
          <Text style={styles.section}>Seven days</Text>
          <DailyForecastList days={weather.daily.slice(0, 7)} />
          <Text style={styles.credit}>
            Weather data by Open-Meteo.com · {weather.timezone} · confidence {weather.modelConfidence}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  kicker: {
    color: theme.postbox,
    fontFamily: font.body,
    fontSize: 12,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: { color: theme.cream, fontFamily: font.display, fontSize: 34, lineHeight: 40 },
  intro: { color: theme.muted, fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  section: {
    color: theme.cream,
    fontFamily: font.display,
    fontSize: 22,
    marginTop: 6,
  },
  warn: { color: theme.amber, fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  loading: { gap: 10, paddingVertical: 12 },
  credit: { color: theme.faint, fontFamily: font.body, fontSize: 12, lineHeight: 17 },
});
