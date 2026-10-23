import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { theme } from '../../src/theme/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.cream,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: {
          backgroundColor: '#0A1628',
          borderTopColor: theme.line,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          letterSpacing: 0.4,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="umbrella-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="forecast"
        options={{
          title: 'Forecast',
          tabBarIcon: ({ color, size }) => <Ionicons name="rainy-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="options-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
