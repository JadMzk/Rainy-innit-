import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '../state/AppState';
import { font, theme } from '../theme/theme';
import type { LocationCoords } from '../types/weather';
import { LocationPicker } from './LocationPicker';
import { UmbrellaMark } from './WeatherGlyph';

export function OnboardingModal() {
  const { ready, onboarded, completeOnboarding } = useAppState();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<LocationCoords | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  if (!ready || onboarded) return null;

  async function finish(enableNotifications: boolean) {
    if (!place) return;
    setSaving(true);
    try {
      await completeOnboarding(place, enableNotifications);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Rainy innit</Text>
        {step === 0 ? (
          <View style={styles.block}>
            <UmbrellaMark size={84} />
            <Text style={styles.title}>Know when it's gonna rain. Innit.</Text>
            <Text style={styles.body}>
              One question, answered before you leave the house. Rainy innit watches the next few hours and tells you whether the brolly is worth the bother. A nudge, not a weather encyclopedia.
            </Text>
            <Pressable accessibilityRole="button" style={styles.primary} onPress={() => setStep(1)}>
              <Text style={styles.primaryText}>Alright, let's set it up</Text>
            </Pressable>
          </View>
        ) : null}
        {step === 1 ? (
          <View style={styles.block}>
            <Text style={styles.title}>Where should we watch?</Text>
            <Text style={styles.body}>
              A UK city is plenty. You can search further afield, or let the phone share a fix. We only need it while you're using the app.
            </Text>
            <LocationPicker selected={place} onSelect={setPlace} />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !place }}
              style={[styles.primary, !place ? styles.disabled : null]}
              disabled={!place}
              onPress={() => setStep(2)}
            >
              <Text style={styles.primaryText}>{place ? `Watch ${place.name}` : 'Pick a place first'}</Text>
            </Pressable>
          </View>
        ) : null}
        {step === 2 ? (
          <View style={styles.block}>
            <Text style={styles.title}>A tap on the shoulder.</Text>
            <Text style={styles.body}>
              Alerts stay local to this phone. Two a day at most, quiet after 10, and you can tell us to ignore drizzle. We'll ask the system for permission next — or you can just open the app and look.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.primary}
              disabled={saving}
              onPress={() => void finish(true)}
            >
              <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Allow umbrella alerts'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.secondary} disabled={saving} onPress={() => void finish(false)}>
              <Text style={styles.secondaryText}>Not now. I'll check the app.</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.bg,
    zIndex: 20,
    paddingHorizontal: 22,
  },
  content: { gap: 18, paddingBottom: 24 },
  brand: {
    color: theme.postbox,
    fontFamily: font.body,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '700',
  },
  block: { gap: 16 },
  title: {
    color: theme.cream,
    fontFamily: font.display,
    fontSize: 34,
    lineHeight: 40,
  },
  body: {
    color: theme.muted,
    fontFamily: font.body,
    fontSize: 16,
    lineHeight: 23,
  },
  primary: {
    backgroundColor: theme.postbox,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: theme.cream, fontFamily: font.body, fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: theme.muted, fontFamily: font.body, fontSize: 15 },
  disabled: { opacity: 0.45 },
});
