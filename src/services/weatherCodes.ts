import type { IntensityLevel } from '../types/weather';

/**
 * Intensity bands follow the public UK slight / moderate / heavy split:
 * light (slight) under 0.5 mm/h, moderate from 0.5 up to 4 mm/h, heavy from 4.
 * The drizzle preference uses the same 0.5 mm/h edge via config.
 */
export function intensityFromMm(mm: number): IntensityLevel {
  if (!Number.isFinite(mm) || mm < 0.1) return 'none';
  if (mm < 0.5) return 'light';
  if (mm < 4) return 'moderate';
  return 'heavy';
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

export function isSnowCode(code: number): boolean {
  return SNOW_CODES.has(code);
}

export function isRainCode(code: number): boolean {
  return RAIN_CODES.has(code);
}

export function conditionLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Clear';
    case 1:
      return 'Mainly clear';
    case 2:
      return 'Partly cloudy';
    case 3:
      return 'Overcast';
    case 45:
      return 'Fog';
    case 48:
      return 'Freezing fog';
    case 51:
      return 'Light drizzle';
    case 53:
      return 'Drizzle';
    case 55:
      return 'Heavy drizzle';
    case 56:
      return 'Freezing drizzle';
    case 57:
      return 'Dense freezing drizzle';
    case 61:
      return 'Light rain';
    case 63:
      return 'Rain';
    case 65:
      return 'Heavy rain';
    case 66:
      return 'Freezing rain';
    case 67:
      return 'Heavy freezing rain';
    case 71:
      return 'Light snow';
    case 73:
      return 'Snow';
    case 75:
      return 'Heavy snow';
    case 77:
      return 'Snow grains';
    case 80:
      return 'Light showers';
    case 81:
      return 'Showers';
    case 82:
      return 'Heavy showers';
    case 85:
      return 'Light snow showers';
    case 86:
      return 'Heavy snow showers';
    case 95:
      return 'Thunderstorm';
    case 96:
      return 'Thunderstorm with hail';
    case 99:
      return 'Thunderstorm with heavy hail';
    default:
      return `Weather code ${code}`;
  }
}

export function isRainingFromObservation(
  weatherCode: number,
  precipitationMm: number,
  rainMm: number,
  showersMm: number,
): boolean {
  if (isSnowCode(weatherCode) && rainMm + showersMm < 0.1) return false;
  if (rainMm + showersMm >= 0.1) return true;
  if (isRainCode(weatherCode)) return true;
  return precipitationMm >= 0.1 && !isSnowCode(weatherCode);
}
