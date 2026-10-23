import { StyleSheet, Text, View } from 'react-native';

import type { CurrentObservation, DailyForecastPoint, HourlyForecastPoint, LocationCoords } from '../types/weather';
import { font, theme } from '../theme/theme';
import { formatMm, formatPercent, formatTemp } from '../utils/format';
import { WeatherGlyph } from './WeatherGlyph';

export function CurrentWeatherCard({
  location,
  current,
}: {
  location: LocationCoords;
  current: CurrentObservation;
}) {
  const place = [location.name, location.region].filter(Boolean).join(', ');
  return (
    <View style={styles.current}>
      <View style={styles.currentTop}>
        <View style={styles.currentCopy}>
          <Text style={styles.kicker}>Live observation</Text>
          <Text style={styles.place}>{place}</Text>
          <Text style={styles.temp}>{formatTemp(current.temperatureC)}</Text>
          <Text style={styles.condition}>
            {current.conditionLabel} · feels {formatTemp(current.apparentTemperatureC)}
          </Text>
        </View>
        <WeatherGlyph code={current.weatherCode} size={64} />
      </View>
      <View style={styles.metrics}>
        <Metric label="Rain chance" value={formatPercent(current.currentRainProbabilityPct)} hint="This hour's forecast" />
        <Metric label="Rainfall" value={`${formatMm(current.currentPrecipitationMm)} mm/h`} hint="Past hour, live" />
        <Metric label="Wind" value={`${Math.round(current.windSpeedKmh)} km/h`} hint="Live" />
      </View>
      <Text style={styles.caption}>
        Temperature, rainfall and wind are the live reading. The chance is the forecast for this hour — Open-Meteo doesn't publish a live probability.
      </Text>
    </View>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

export function HourlyForecastList({ hours }: { hours: HourlyForecastPoint[] }) {
  if (hours.length === 0) {
    return <Text style={styles.empty}>Hourly detail will show up once a forecast arrives.</Text>;
  }
  return (
    <View style={styles.list}>
      {hours.map((hour) => (
        <View key={hour.timeIso} style={styles.row}>
          <Text style={styles.time}>{hour.hourLabel}</Text>
          <WeatherGlyph code={hour.weatherCode} size={26} />
          <Text style={styles.rowTemp}>{formatTemp(hour.temperatureC)}</Text>
          <Text style={styles.rowPop}>{formatPercent(hour.precipitationProbabilityPct)}</Text>
          <Text style={styles.rowMm}>{formatMm(hour.precipitationMm)} mm</Text>
          <View style={[styles.badge, badgeTone(hour.intensityLevel)]}>
            <Text style={styles.badgeText}>{hour.intensityLevel}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function DailyForecastList({ days }: { days: DailyForecastPoint[] }) {
  if (days.length === 0) {
    return <Text style={styles.empty}>The week is empty until the forecast lands.</Text>;
  }
  return (
    <View style={styles.list}>
      {days.map((day) => (
        <View key={day.dateIso} style={styles.dayRow}>
          <View style={styles.dayName}>
            <Text style={styles.dayLabel}>{day.dayLabel}</Text>
            <Text style={styles.dayCondition}>{day.conditionLabel}</Text>
          </View>
          <WeatherGlyph code={day.weatherCode} size={26} />
          <Text style={styles.dayTemp}>
            {formatTemp(day.tempMinC)}–{formatTemp(day.tempMaxC)}
          </Text>
          <Text style={styles.rowPop}>{formatPercent(day.maxPrecipitationProbabilityPct)}</Text>
          <Text style={styles.rowMm}>{formatMm(day.totalPrecipitationMm)} mm</Text>
        </View>
      ))}
    </View>
  );
}

function badgeTone(level: HourlyForecastPoint['intensityLevel']) {
  if (level === 'heavy') return { backgroundColor: 'rgba(215, 25, 32, 0.22)' };
  if (level === 'moderate') return { backgroundColor: 'rgba(142, 190, 255, 0.18)' };
  if (level === 'light') return { backgroundColor: 'rgba(231, 177, 90, 0.16)' };
  return { backgroundColor: 'rgba(255,255,255,0.05)' };
}

const styles = StyleSheet.create({
  current: {
    backgroundColor: theme.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 18,
    gap: 14,
  },
  currentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentCopy: { flex: 1, gap: 2 },
  kicker: {
    color: theme.rain,
    fontFamily: font.body,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  place: { color: theme.muted, fontFamily: font.body, fontSize: 14 },
  temp: { color: theme.cream, fontFamily: font.display, fontSize: 56, lineHeight: 60 },
  condition: { color: theme.text, fontFamily: font.body, fontSize: 16 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: theme.bg,
    borderRadius: 14,
    padding: 10,
    gap: 2,
  },
  metricLabel: { color: theme.faint, fontFamily: font.body, fontSize: 11 },
  metricValue: { color: theme.cream, fontFamily: font.body, fontSize: 14, fontWeight: '700' },
  metricHint: { color: theme.faint, fontFamily: font.body, fontSize: 10 },
  caption: { color: theme.muted, fontFamily: font.body, fontSize: 12, lineHeight: 17 },
  list: {
    backgroundColor: theme.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  time: { width: 48, color: theme.cream, fontFamily: font.body, fontSize: 14 },
  rowTemp: { width: 42, color: theme.text, fontFamily: font.body, fontSize: 15 },
  rowPop: { width: 44, color: theme.rain, fontFamily: font.body, fontSize: 14, fontWeight: '700' },
  rowMm: { flex: 1, color: theme.muted, fontFamily: font.body, fontSize: 13 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: theme.cream, fontFamily: font.body, fontSize: 11, textTransform: 'capitalize' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  dayName: { width: 92 },
  dayLabel: { color: theme.cream, fontFamily: font.body, fontSize: 15, fontWeight: '700' },
  dayCondition: { color: theme.faint, fontFamily: font.body, fontSize: 11 },
  dayTemp: { flex: 1, color: theme.text, fontFamily: font.body, fontSize: 14 },
  empty: { color: theme.muted, fontFamily: font.body, paddingVertical: 8 },
});
