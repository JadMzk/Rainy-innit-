import { Platform } from 'react-native';

import type { LocationCoords } from '../types/weather';
import { reverseGeocode } from './geocoding';

export async function readDeviceLocation(): Promise<LocationCoords | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void reverseGeocode(position.coords.latitude, position.coords.longitude).then(resolve, () =>
            resolve({
              name: 'Your location',
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          );
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }

  try {
    const Location = await import('expo-location');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return reverseGeocode(position.coords.latitude, position.coords.longitude);
  } catch {
    return null;
  }
}
