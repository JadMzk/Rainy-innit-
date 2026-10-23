import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { UK_CITY_PRESETS } from '../services/cities';
import { readDeviceLocation } from '../services/deviceLocation';
import { searchLocations } from '../services/geocoding';
import type { LocationCoords } from '../types/weather';
import { font, theme } from '../theme/theme';

interface LocationPickerProps {
  selected?: LocationCoords;
  onSelect: (place: LocationCoords) => void;
}

export function LocationPicker({ selected, onSelect }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationCoords[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSearch() {
    setSearching(true);
    setMessage(null);
    try {
      const places = await searchLocations(query);
      setResults(places);
      if (places.length === 0) setMessage('No places under that name. Try a city.');
    } catch {
      setMessage("The place search didn't answer. The city shortcuts still work.");
    } finally {
      setSearching(false);
    }
  }

  async function onGps() {
    setLocating(true);
    setMessage(null);
    const place = await readDeviceLocation();
    setLocating(false);
    if (!place) {
      setMessage('No location fix. Pick a city instead — London is a fine default.');
      return;
    }
    onSelect(place);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {UK_CITY_PRESETS.map((city) => {
          const on = selected?.name === city.name && Math.abs((selected.latitude ?? 0) - city.latitude) < 0.02;
          return (
            <Pressable
              key={city.name}
              accessibilityRole="button"
              accessibilityLabel={`Use ${city.name}`}
              onPress={() => onSelect(city)}
              style={[styles.chip, on ? styles.chipOn : null]}
            >
              <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{city.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a town"
          placeholderTextColor={theme.faint}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void onSearch()}
          accessibilityLabel="Search for a town"
        />
        <Pressable accessibilityRole="button" onPress={() => void onSearch()} style={styles.searchButton}>
          {searching ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.searchButtonText}>Search</Text>}
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void onGps()} style={styles.gps}>
        {locating ? <ActivityIndicator color={theme.cream} /> : <Text style={styles.gpsText}>Use this phone's location</Text>}
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {results.map((place) => (
        <Pressable
          key={`${place.name}-${place.latitude}-${place.longitude}`}
          accessibilityRole="button"
          onPress={() => onSelect(place)}
          style={styles.result}
        >
          <Text style={styles.resultName}>{place.name}</Text>
          <Text style={styles.resultMeta}>{[place.region, place.country].filter(Boolean).join(', ')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: { backgroundColor: theme.cream, borderColor: theme.cream },
  chipText: { color: theme.cream, fontFamily: font.body, fontSize: 14 },
  chipTextOn: { color: theme.ink },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: theme.bg,
    color: theme.text,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: theme.cream,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  searchButtonText: { color: theme.ink, fontFamily: font.body, fontWeight: '700' },
  gps: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    paddingVertical: 12,
    alignItems: 'center',
  },
  gpsText: { color: theme.cream, fontFamily: font.body, fontSize: 15 },
  message: { color: theme.amber, fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  result: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  resultName: { color: theme.text, fontFamily: font.body, fontSize: 16 },
  resultMeta: { color: theme.muted, fontFamily: font.body, fontSize: 13 },
});
