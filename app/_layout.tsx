import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OnboardingModal } from '../src/components/OnboardingModal';
import { AppStateProvider, useAppState } from '../src/state/AppState';
import { font, frame, theme } from '../src/theme/theme';

function Toast() {
  const { toast, dismissToast } = useAppState();
  if (!toast) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notice" onPress={dismissToast} style={styles.toast}>
      <Text style={styles.toastText}>{toast}</Text>
    </Pressable>
  );
}

function Shell() {
  return (
    <View style={frame.outer}>
      <View style={frame.inner}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <OnboardingModal />
        <Toast />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    backgroundColor: theme.cream,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 30,
  },
  toastText: {
    color: theme.ink,
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 19,
  },
});
