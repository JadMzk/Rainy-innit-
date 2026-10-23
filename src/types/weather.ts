/**
 * Shared weather contracts.
 *
 * Live observations and forecast points are different kinds of evidence.
 * `isLiveObservation` and `isForecast` are literal types so a forecast hour
 * cannot be passed off as something we measured.
 */

export interface LocationCoords {
  latitude: number;
  longitude: number;
  name: string;
  region?: string;
  country?: string;
}

export interface CurrentObservation {
  timestamp: string;
  temperatureC: number;
  apparentTemperatureC: number;
  weatherCode: number;
  conditionLabel: string;
  isRainingNow: boolean;
  /** Preceding-hour precipitation total from the live observation, mm. */
  currentPrecipitationMm: number;
  /**
   * Chance of rain for the current hour. Open-Meteo's current endpoint does
   * not provide probability of precipitation, so this value is copied from the
   * matching hourly forecast. It is not a live measurement.
   */
  currentRainProbabilityPct: number;
  windSpeedKmh: number;
  isLiveObservation: true;
}

export type IntensityLevel = 'none' | 'light' | 'moderate' | 'heavy';

export interface HourlyForecastPoint {
  timeIso: string;
  hourLabel: string;
  temperatureC: number;
  precipitationProbabilityPct: number;
  precipitationMm: number;
  rainMm: number;
  showersMm: number;
  weatherCode: number;
  conditionLabel: string;
  intensityLevel: IntensityLevel;
  isForecast: true;
}

export interface DailyForecastPoint {
  dateIso: string;
  dayLabel: string;
  weatherCode: number;
  conditionLabel: string;
  tempMinC: number;
  tempMaxC: number;
  maxPrecipitationProbabilityPct: number;
  totalPrecipitationMm: number;
  isForecast: true;
}

/**
 * A production forecast bundle. `provider` is only ever `open-meteo` here.
 * Simulated bundles live in `SimulatedWeatherBundle` and cannot be assigned
 * to this type without dropping the discriminant.
 */
export interface WeatherBundle {
  location: LocationCoords;
  fetchedAtIso: string;
  provider: 'open-meteo';
  current: CurrentObservation;
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
  modelConfidence: 'high' | 'medium' | 'low';
  /** IANA name from Open-Meteo, e.g. Europe/London. */
  timezone: string;
  /** Seconds to add to UTC to get local wall time. */
  utcOffsetSeconds: number;
}

export interface SimulatedWeatherBundle extends Omit<WeatherBundle, 'provider'> {
  provider: 'simulation';
  simulationScenario: string;
  /** Always includes the word SIMULATED so it cannot be mistaken for live weather. */
  simulationLabel: string;
}

export type ForecastBundle = WeatherBundle | SimulatedWeatherBundle;

export type UmbrellaRecommendationState =
  | 'TAKE_UMBRELLA'
  | 'NO_UMBRELLA_NEEDED'
  | 'FORECAST_UNCERTAIN';

export interface UmbrellaDecision {
  state: UmbrellaRecommendationState;
  headline: string;
  britishSubtext: string;
  reason: string;
  nextRainWindow?: {
    startTimeIso: string;
    startLabel: string;
    peakProbabilityPct: number;
    expectedMm: number;
    intensity: string;
  };
  confidence: 'high' | 'medium' | 'low';
  evaluatedAtIso: string;
}

export class WeatherDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherDataError';
  }
}
