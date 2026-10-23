import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HourlyForecastPoint } from '../types/weather';
import { font, theme } from '../theme/theme';
import { formatMm, formatPercent } from '../utils/format';

interface RainProbabilityChartProps {
  hours: HourlyForecastPoint[];
  thresholdPct: number;
  uncertaintyMinPct: number;
}

/**
 * Probability of precipitation over the next day.
 * The percentage is the chance of at least 0.1 mm in that hour, not the
 * fraction of the hour that will be wet.
 */
export function RainProbabilityChart({ hours, thresholdPct, uncertaintyMinPct }: RainProbabilityChartProps) {
  const points = hours.slice(0, 24);
  const found = points.findIndex((hour) => hour.precipitationProbabilityPct >= thresholdPct);
  const [selected, setSelected] = useState(found === -1 ? 0 : found);
  const active = points[selected] ?? points[0];

  const highRuns = useMemo(() => {
    return points.map((hour) => hour.precipitationProbabilityPct >= thresholdPct);
  }, [points, thresholdPct]);

  if (!active || points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No hourly chances to plot yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Next 24 hours</Text>
        <Text style={styles.readout}>
          {active.hourLabel} · {formatPercent(active.precipitationProbabilityPct)} · {formatMm(active.precipitationMm)} mm
        </Text>
      </View>
      <View style={styles.plot}>
        <View
          pointerEvents="none"
          style={[styles.threshold, { bottom: `${Math.min(100, Math.max(0, thresholdPct))}%` }]}
        >
          <View style={styles.thresholdLine} />
        </View>
        <View style={styles.bars}>
          {points.map((hour, index) => {
            const pop = Math.max(0, Math.min(100, hour.precipitationProbabilityPct));
            const hot = pop >= thresholdPct;
            const uneasy = !hot && pop >= uncertaintyMinPct;
            const color = hot ? theme.postbox : uneasy ? theme.amber : theme.rain;
            return (
              <Pressable
                key={hour.timeIso}
                accessibilityRole="button"
                accessibilityLabel={`${hour.hourLabel}, ${Math.round(pop)} percent chance of rain, ${formatMm(hour.precipitationMm)} millimetres`}
                onPress={() => setSelected(index)}
                style={styles.barHit}
              >
                <View style={[styles.barTrack, index === selected ? styles.barTrackOn : null]}>
                  {highRuns[index] ? <View style={styles.riskGlow} /> : null}
                  <View style={[styles.bar, { height: `${Math.max(pop, 2)}%`, backgroundColor: color }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{points[0]?.hourLabel}</Text>
        <Text style={styles.axisText}>Threshold {Math.round(thresholdPct)}%</Text>
        <Text style={styles.axisText}>{points[points.length - 1]?.hourLabel}</Text>
      </View>
      <Text style={styles.note}>
        The percentage is the chance of at least 0.1 mm of rain in that hour. It is not the share of the hour it will be raining.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 16,
    gap: 12,
  },
  header: { gap: 4 },
  kicker: {
    color: theme.faint,
    fontFamily: font.body,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  readout: {
    color: theme.cream,
    fontFamily: font.display,
    fontSize: 22,
  },
  plot: {
    height: 148,
    justifyContent: 'flex-end',
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barTrackOn: {
    backgroundColor: 'rgba(243, 237, 226, 0.06)',
  },
  riskGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(215, 25, 32, 0.14)',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 3,
  },
  threshold: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
  },
  thresholdLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(243, 237, 226, 0.55)',
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisText: {
    color: theme.faint,
    fontFamily: font.body,
    fontSize: 11,
  },
  note: {
    color: theme.muted,
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
  },
  empty: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: theme.card,
  },
  emptyText: {
    color: theme.muted,
    fontFamily: font.body,
  },
});
