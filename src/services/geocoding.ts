import type { LocationCoords } from '../types/weather';

const SEARCH_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/reverse';

interface GeoResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
  country?: string;
}

function toLocation(result: GeoResult): LocationCoords | null {
  if (typeof result.name !== 'string' || result.name.length === 0) return null;
  if (typeof result.latitude !== 'number' || typeof result.longitude !== 'number') return null;
  if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) return null;
  return {
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    region: typeof result.admin1 === 'string' ? result.admin1 : undefined,
    country: typeof result.country === 'string' ? result.country : undefined,
  };
}

export function parseGeocodingResults(payload: unknown): LocationCoords[] {
  if (!payload || typeof payload !== 'object') return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const places: LocationCoords[] = [];
  for (const result of results) {
    if (!result || typeof result !== 'object') continue;
    const place = toLocation(result as GeoResult);
    if (place) places.push(place);
  }
  return places;
}

export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    name: query,
    count: '5',
    language: 'en',
    format: 'json',
  });
  return `${SEARCH_ENDPOINT}?${params.toString()}`;
}

export async function searchLocations(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LocationCoords[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const response = await fetchImpl(buildSearchUrl(trimmed), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Place search failed (HTTP ${response.status})`);
  }
  return parseGeocodingResults(await response.json());
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch = fetch,
): Promise<LocationCoords> {
  const fallback: LocationCoords = {
    name: 'Your location',
    latitude,
    longitude,
  };
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      language: 'en',
      format: 'json',
    });
    const response = await fetchImpl(`${REVERSE_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return fallback;
    const places = parseGeocodingResults(await response.json());
    const first = places[0];
    if (!first) return fallback;
    return { ...first, latitude, longitude };
  } catch {
    return fallback;
  }
}
