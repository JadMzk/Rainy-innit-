import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationPicker } from '../../src/components/LocationPicker';
import { DEFAULT_NOTIFICATION_CONFIG, LEAD_TIME_OPTIONS } from '../../src/config/defaults';
import { formatHhmm, parseHhmm } from '../../src/engine/clock';
import { SIMULATION_SCENARIOS, type SimulationScenario } from '../../src/services/simulationPresets';
import { useAppState } from '../../src/state/AppState';
import { font, theme } from '../../src/theme/theme';
import type { LocationCoords } from '../../src/types/weather';

function shift(hhmm: string, deltaMinutes: number): string {
  return formatHhmm(parseHhmm(hhmm) + deltaMinutes);
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    preferences,
    activeSlot,
    updatePreferences,
    setActiveSlot,
    history,
    scheduled,
    lastEvaluation,
    sendTestNotification,
    runSimulation,
  } = useAppState();
  const [scenario, setScenario] = useState<SimulationScenario>('heavy_rain_soon');
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);

  function setHome(place: LocationCoords) {
    void updatePreferences({ homeLocation: place });
  }

  function setDestination(place: LocationCoords) {
    void updatePreferences({ destinationLocation: place });
  }

  async function onSimulate() {
    setRunning(true);
    try {
      await runSimulation(scenario, dryRun);
    } finally {
      setRunning(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}>
      <Text style={styles.kicker}>Preferences</Text>
      <Text style={styles.title}>How we should nag</Text>

      <View style={styles.card}>
        <Row label="Umbrella alerts" hint="Local notifications on this phone">
          <Switch
            value={preferences.enabled}
            onValueChange={(enabled) => void updatePreferences({ enabled })}
            trackColor={{ true: theme.postbox, false: '#2A3B52' }}
            thumbColor={theme.cream}
          />
        </Row>
        <Stepper
          label="Usual departure"
          value={preferences.usualDepartureTime}
          onMinus={() => void updatePreferences({ usualDepartureTime: shift(preferences.usualDepartureTime, -15) })}
          onPlus={() => void updatePreferences({ usualDepartureTime: shift(preferences.usualDepartureTime, 15) })}
        />
        <Text style={styles.label}>Lead time</Text>
        <View style={styles.segment}>
          {LEAD_TIME_OPTIONS.map((minutes) => {
            const on = preferences.leadTimeMinutes === minutes;
            return (
              <Pressable
                key={minutes}
                accessibilityRole="button"
                onPress={() => void updatePreferences({ leadTimeMinutes: minutes })}
                style={[styles.segmentItem, on ? styles.segmentOn : null]}
              >
                <Text style={[styles.segmentText, on ? styles.segmentTextOn : null]}>{minutes}m</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>Rain sensitivity</Text>
        <View style={styles.segment}>
          {(['low', 'medium', 'high'] as const).map((level) => {
            const on = preferences.rainSensitivity === level;
            return (
              <Pressable
                key={level}
                accessibilityRole="button"
                onPress={() => void updatePreferences({ rainSensitivity: level })}
                style={[styles.segmentItem, on ? styles.segmentOn : null]}
              >
                <Text style={[styles.segmentText, on ? styles.segmentTextOn : null]}>{level}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {preferences.rainSensitivity === 'low'
            ? `Low waits until about ${DEFAULT_NOTIFICATION_CONFIG.probThresholdRelaxedPct}%.`
            : preferences.rainSensitivity === 'high'
              ? `High pipes up from about ${DEFAULT_NOTIFICATION_CONFIG.probThresholdSensitivePct}%.`
              : `Medium, the sensible default, uses ${DEFAULT_NOTIFICATION_CONFIG.probThresholdStandardPct}%.`}
        </Text>
        <Row label="Ignore light drizzle" hint={`Skip rain under ${DEFAULT_NOTIFICATION_CONFIG.lightRainIgnoreThresholdMm} mm/h`}>
          <Switch
            value={preferences.ignoreLightDrizzle}
            onValueChange={(ignoreLightDrizzle) => void updatePreferences({ ignoreLightDrizzle })}
            trackColor={{ true: theme.postbox, false: '#2A3B52' }}
            thumbColor={theme.cream}
          />
        </Row>
        <Stepper
          label="Quiet from"
          value={preferences.quietHoursStart}
          onMinus={() => void updatePreferences({ quietHoursStart: shift(preferences.quietHoursStart, -30) })}
          onPlus={() => void updatePreferences({ quietHoursStart: shift(preferences.quietHoursStart, 30) })}
        />
        <Stepper
          label="Quiet until"
          value={preferences.quietHoursEnd}
          onMinus={() => void updatePreferences({ quietHoursEnd: shift(preferences.quietHoursEnd, -30) })}
          onPlus={() => void updatePreferences({ quietHoursEnd: shift(preferences.quietHoursEnd, 30) })}
        />
        <Stepper
          label="Max alerts a day"
          value={String(preferences.maxDailyNotifications)}
          onMinus={() =>
            void updatePreferences({
              maxDailyNotifications: Math.max(0, preferences.maxDailyNotifications - 1),
            })
          }
          onPlus={() =>
            void updatePreferences({
              maxDailyNotifications: Math.min(
                DEFAULT_NOTIFICATION_CONFIG.maxNotificationsPerDay,
                preferences.maxDailyNotifications + 1,
              ),
            })
          }
        />
      </View>

      <Text style={styles.section}>Location</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Home, the place we watch</Text>
        <LocationPicker selected={preferences.homeLocation} onSelect={setHome} />
        <Text style={styles.label}>Destination, if you're heading out</Text>
        <LocationPicker selected={preferences.destinationLocation} onSelect={setDestination} />
        <View style={styles.segment}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void setActiveSlot('home')}
            style={[styles.segmentItem, activeSlot === 'home' ? styles.segmentOn : null]}
          >
            <Text style={[styles.segmentText, activeSlot === 'home' ? styles.segmentTextOn : null]}>Watch home</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!preferences.destinationLocation}
            onPress={() => void setActiveSlot('destination')}
            style={[styles.segmentItem, activeSlot === 'destination' ? styles.segmentOn : null]}
          >
            <Text style={[styles.segmentText, activeSlot === 'destination' ? styles.segmentTextOn : null]}>Watch destination</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.section}>Sentinel bench</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          Test the real notification path, or run a simulated sky through the engine. Simulated forecasts are labelled and never replace the live reading on Today.
        </Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void sendTestNotification()}>
          <Text style={styles.buttonText}>Send a test notification</Text>
        </Pressable>
        <Text style={styles.label}>Simulated rain forecast</Text>
        <View style={styles.scenarios}>
          {SIMULATION_SCENARIOS.map((item) => {
            const on = scenario === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => setScenario(item.id)}
                style={[styles.chip, on ? styles.chipOn : null]}
              >
                <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Row label="Dry run" hint="Compute the decision without sending">
          <Switch value={dryRun} onValueChange={setDryRun} trackColor={{ true: theme.amber, false: '#2A3B52' }} thumbColor={theme.cream} />
        </Row>
        <Pressable accessibilityRole="button" style={styles.button} disabled={running} onPress={() => void onSimulate()}>
          <Text style={styles.buttonText}>{running ? 'Running…' : dryRun ? 'Run dry simulation' : 'Run simulation and deliver'}</Text>
        </Pressable>
        {lastEvaluation ? (
          <View style={styles.traceBox}>
            <Text style={styles.traceAction}>{lastEvaluation.action}</Text>
            <Text style={styles.traceBody}>{lastEvaluation.explanation}</Text>
            <Text style={styles.traceMeta}>
              shouldNotify {String(lastEvaluation.shouldNotify)} · cancel {String(lastEvaluation.shouldCancelExisting)} · dry run{' '}
              {String(lastEvaluation.dryRun)}
            </Text>
            {lastEvaluation.cancellationIds.length ? (
              <Text style={styles.traceMeta}>Cancel ids: {lastEvaluation.cancellationIds.join(', ')}</Text>
            ) : null}
            {lastEvaluation.debugTrace.map((line, index) => (
              <Text key={`${index}-${line.slice(0, 24)}`} style={styles.traceLine}>
                {index + 1}. {line}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>The decision trace will land here.</Text>
        )}
        <Text style={styles.label}>Queued ids</Text>
        {scheduled.length === 0 ? <Text style={styles.hint}>Nothing scheduled.</Text> : null}
        {scheduled.map((item) => (
          <Text key={item.id} style={styles.history}>
            {item.id} · {item.eventSignature} · {item.scheduledForIso}
          </Text>
        ))}
        <Text style={styles.label}>Notification history</Text>
        {history.length === 0 ? <Text style={styles.hint}>No alerts sent yet.</Text> : null}
        {history.slice(0, 8).map((item) => (
          <Text key={item.id} style={styles.history}>
            {item.sentAtIso.slice(0, 16)} · {item.action} · {item.eventSignature}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={onMinus} style={styles.step}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={onPlus} style={styles.step}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },
  kicker: {
    color: theme.postbox,
    fontFamily: font.body,
    fontSize: 12,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: { color: theme.cream, fontFamily: font.display, fontSize: 34, lineHeight: 40 },
  section: { color: theme.cream, fontFamily: font.display, fontSize: 24, marginTop: 8 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { color: theme.cream, fontFamily: font.body, fontSize: 15 },
  label: { color: theme.cream, fontFamily: font.body, fontSize: 15, marginTop: 4 },
  hint: { color: theme.muted, fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentOn: { backgroundColor: theme.cream, borderColor: theme.cream },
  segmentText: { color: theme.cream, fontFamily: font.body, fontSize: 13, textTransform: 'capitalize' },
  segmentTextOn: { color: theme.ink, fontWeight: '700' },
  button: { backgroundColor: theme.postbox, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: theme.cream, fontFamily: font.body, fontWeight: '700' },
  scenarios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: theme.cream, borderColor: theme.cream },
  chipText: { color: theme.cream, fontFamily: font.body, fontSize: 12 },
  chipTextOn: { color: theme.ink },
  traceBox: {
    backgroundColor: theme.bg,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  traceAction: { color: theme.amber, fontFamily: font.body, fontWeight: '700' },
  traceBody: { color: theme.cream, fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  traceMeta: { color: theme.faint, fontFamily: font.body, fontSize: 12 },
  traceLine: { color: theme.muted, fontFamily: font.body, fontSize: 12, lineHeight: 17 },
  history: { color: theme.muted, fontFamily: font.body, fontSize: 12, lineHeight: 17 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: theme.cream, fontSize: 20, lineHeight: 22 },
  stepValue: { color: theme.cream, fontFamily: font.body, fontSize: 16, minWidth: 58, textAlign: 'center' },
});
