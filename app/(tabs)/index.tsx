import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UmbrellaMark } from '../../src/components/WeatherGlyph';
import { useAppState } from '../../src/state/AppState';
import { font, theme } from '../../src/theme/theme';
import { formatMm, formatUpdated } from '../../src/utils/format';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { location, weather, decision, loadingWeather, weatherError, fromCache, refresh } = useAppState();

  const tone = decision?.state === 'TAKE_UMBRELLA' ? 'take' : decision?.state === 'FORECAST_UNCERTAIN' ? 'dodgy' : 'fine';
  const seal =
    decision?.state === 'TAKE_UMBRELLA' ? 'Take it' : decision?.state === 'FORECAST_UNCERTAIN' ? 'Check again' : 'No brolly';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={<RefreshControl refreshing={loadingWeather} onRefresh={() => void refresh()} tintColor={theme.cream} />}
    >
      <View style={styles.rule} />
      <Text style={styles.brand}>Rainy innit</Text>
      <Text style={styles.tagline}>Know when it's gonna rain.</Text>

      <View style={styles.where}>
        <Text style={styles.whereText}>{location ? location.name : 'No location yet'}</Text>
        {weather ? (
          <Text style={styles.updated}>{formatUpdated(weather.fetchedAtIso, weather.utcOffsetSeconds, new Date().toISOString())}</Text>
        ) : null}
      </View>

      <Text style={styles.question}>Do I need to take my umbrella?</Text>

      {!weather && loadingWeather ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.cream} />
          <Text style={styles.body}>Checking the clouds…</Text>
        </View>
      ) : null}

      {!weather && !loadingWeather ? (
        <View style={styles.card}>
          <Text style={styles.headline}>Tell us where you are and we'll watch the sky.</Text>
          <Text style={styles.body}>
            {weatherError ?? 'Pick a city in Settings, or finish the short setup. Nothing here is made up.'}
          </Text>
        </View>
      ) : null}

      {weather && decision ? (
        <View style={[styles.verdict, tone === 'take' ? styles.take : tone === 'dodgy' ? styles.dodgy : styles.fine]}>
          <UmbrellaMark tone={tone} />
          <Text style={styles.seal}>{seal}</Text>
          <Text style={styles.headline}>{decision.headline}</Text>
          <Text style={styles.subtext}>{decision.britishSubtext}</Text>
          <Text style={styles.reason}>{decision.reason}</Text>
          <Text style={styles.confidence}>Confidence {decision.confidence}</Text>
        </View>
      ) : null}

      {decision?.nextRainWindow ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>Next rain window</Text>
          <Text style={styles.windowTime}>{decision.nextRainWindow.startLabel}</Text>
          <Text style={styles.body}>
            {decision.nextRainWindow.peakProbabilityPct}% chance · {formatMm(decision.nextRainWindow.expectedMm)} mm · {decision.nextRainWindow.intensity}
          </Text>
        </View>
      ) : null}

      {fromCache && weatherError ? (
        <Text style={styles.cacheNote}>
          Couldn't reach Open-Meteo. Showing the last forecast we tucked away. {weatherError}
        </Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push('/forecast')} style={styles.link}>
        <Text style={styles.linkText}>See the full forecast</Text>
        <Text style={styles.linkHint}>Hour by hour, and the week</Text>
      </Pressable>

      <Text style={styles.credit}>Forecasts from Open-Meteo. Not the Met Office, mind.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 20, paddingBottom: 36, gap: 14 },
  rule: { height: 4, width: 56, backgroundColor: theme.postbox, borderRadius: 4 },
  brand: {
    color: theme.cream,
    fontFamily: font.display,
    fontSize: 28,
  },
  tagline: { color: theme.muted, fontFamily: font.body, fontSize: 15, marginTop: -8 },
  where: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  whereText: { color: theme.text, fontFamily: font.body, fontSize: 15, fontWeight: '700' },
  updated: { color: theme.faint, fontFamily: font.body, fontSize: 12 },
  question: {
    color: theme.cream,
    fontFamily: font.display,
    fontSize: 32,
    lineHeight: 38,
    marginTop: 6,
  },
  verdict: {
    borderRadius: 24,
    padding: 18,
    gap: 8,
    borderWidth: 1,
  },
  take: { backgroundColor: '#3A1216', borderColor: 'rgba(215, 25, 32, 0.45)' },
  fine: { backgroundColor: '#13281C', borderColor: 'rgba(143, 203, 155, 0.35)' },
  dodgy: { backgroundColor: '#332816', borderColor: 'rgba(231, 177, 90, 0.4)' },
  seal: {
    color: theme.cream,
    fontFamily: font.body,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '700',
  },
  headline: { color: theme.cream, fontFamily: font.display, fontSize: 24, lineHeight: 30 },
  subtext: { color: theme.cream, fontFamily: font.body, fontSize: 16 },
  reason: { color: theme.muted, fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  confidence: { color: theme.faint, fontFamily: font.body, fontSize: 12 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 16,
    gap: 6,
  },
  kicker: {
    color: theme.faint,
    fontFamily: font.body,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  windowTime: { color: theme.cream, fontFamily: font.display, fontSize: 28 },
  body: { color: theme.muted, fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  cacheNote: { color: theme.amber, fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  link: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: { color: theme.rain, fontFamily: font.body, fontSize: 16, fontWeight: '700' },
  linkHint: { color: theme.faint, fontFamily: font.body, fontSize: 12 },
  credit: { color: theme.faint, fontFamily: font.body, fontSize: 12 },
});
