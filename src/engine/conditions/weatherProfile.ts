import type { WeatherProfile, MatchFormatKey, WeatherReport } from './types';
import type { VenueProfile } from './types';
import { SeededRng, clamp, round } from './rng';
import { WeatherCondition } from '../../types/match';

const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

const MONTH_ISH_TEMP: [number, number] = [16, 40];

export interface WeatherGenOptions {
  /** Local start hour (0-23). Day/night games lean to dew later. */
  startHour?: number;
  /** Force day/night. Defaults to a seeded choice favouring limited-overs. */
  isDayNight?: boolean;
}

/**
 * Deterministically generate a seeded weather forecast. The result is clearly
 * flagged as simulated — this engine never claims live weather data.
 */
export function generateWeatherProfile(
  seed: number | string,
  venue: VenueProfile,
  format: MatchFormatKey,
  options: WeatherGenOptions = {},
): WeatherProfile {
  const rng = new SeededRng(`${typeof seed === 'string' ? seed : seed}::weather`);

  const isDayNight = options.isDayNight ?? (format === 'TEST' ? false : rng.chance(0.65));
  const startHour = options.startHour ?? (isDayNight ? 18 : 11);

  const baseTemp = format === 'TEST' ? rng.range(MONTH_ISH_TEMP[0], MONTH_ISH_TEMP[1] - 2) : rng.range(MONTH_ISH_TEMP[0] + 2, MONTH_ISH_TEMP[1]);
  const temperatureC = round(baseTemp + (venue.altitudeM >= 500 ? -3 : 0), 0);

  const humidity = round(clamp(0.3 + venue.dewTendency * 0.3 + rng.range(0, 0.35), 0.2, 0.95), 3);
  const cloudCover = round(clamp(rng.range(0, 0.4) + (humidity - 0.5) * 0.6 + rng.range(0, 0.3), 0, 1), 3);
  const windKph = round(rng.range(2, 26), 0);
  const windDirection = rng.pick(WIND_DIRECTIONS);

  // Rain is seeded and independent of gameplay; higher for Tests and humid
  // coastal venues. It is used to estimate draw risk, never to rewrite scores.
  const rainBase = format === 'TEST' ? 0.3 : format === 'ODI' ? 0.18 : 0.1;
  const rainProbability = round(clamp(rainBase + cloudCover * 0.4 + (humidity - 0.6) * 0.2 + rng.noise(0.12), 0, 0.92), 3);

  const dewLikelihood = round(
    clamp(venue.dewTendency * (isDayNight ? 1 : 0.35) + cloudCover * 0.1 + (humidity - 0.6) * 0.15, 0, 1),
    3,
  );

  const profile: WeatherProfile = {
    temperatureC,
    humidity,
    cloudCover,
    windKph,
    windDirection,
    rainProbability,
    dewLikelihood,
    isDayNight,
    isSimulated: true,
    forecastText: '',
  };
  profile.forecastText = describeWeather(profile, format).detail;

  return profile;
}

/**
 * Map a rich weather profile to the legacy WeatherCondition enum the engine
 * already understands. Dew wins for evening fixtures; otherwise cloud then
 * humidity then clear.
 */
export function weatherProfileToCondition(profile: WeatherProfile): WeatherCondition {
  if (profile.isDayNight && profile.dewLikelihood >= 0.5) return WeatherCondition.DEW;
  if (profile.cloudCover >= 0.55) return WeatherCondition.CLOUDY;
  if (profile.humidity >= 0.72) return WeatherCondition.HUMID;
  return WeatherCondition.SUNNY;
}

/** Atmospheric swing assistance (0..1) from cloud and humidity. */
export function swingAssistFromWeather(profile: WeatherProfile): number {
  return clamp(profile.cloudCover * 0.6 + profile.humidity * 0.3 + Math.min(0.1, profile.windKph / 300), 0, 1);
}

/**
 * Overs expected to be lost to weather. Only Tests genuinely lose time; for
 * limited overs this is reported for information but the format is not cut.
 */
export function expectedLostOvers(profile: WeatherProfile, format: MatchFormatKey): number {
  if (format !== 'TEST') return 0;
  return Math.round(profile.rainProbability * 60); // up to ~60 overs across 5 days
}

/** Draw-risk estimate for Tests (weather + loss of time). 0 for limited overs. */
export function drawRiskFromWeather(profile: WeatherProfile, format: MatchFormatKey, day = 1): number {
  if (format !== 'TEST') return 0;
  const weatherRisk = profile.rainProbability * 0.7;
  const timeRisk = clamp((day - 3) * 0.05, 0, 0.15);
  return round(clamp(weatherRisk + timeRisk, 0, 0.9), 3);
}

/** Human-readable weather report. */
export function describeWeather(profile: WeatherProfile, format: MatchFormatKey): WeatherReport {
  const swing = swingAssistFromWeather(profile);
  const swingNote =
    swing >= 0.6
      ? 'Overcast and humid — the ball should swing.'
      : swing >= 0.4
        ? 'Some atmospheric assistance for the seamers.'
        : 'Little movement expected through the air.';
  const dewNote =
    format === 'TEST'
      ? 'Dew is not a significant factor in the long format.'
      : profile.dewLikelihood >= 0.6
        ? 'Heavy dew likely later — gripping the ball will be hard.'
        : profile.dewLikelihood >= 0.35
          ? 'Light dew possible in the evening.'
          : 'Dew unlikely to be a factor.';

  const cloud = Math.round(profile.cloudCover * 100);
  const humidity = Math.round(profile.humidity * 100);
  const headline =
    profile.rainProbability >= 0.5
      ? 'Rain around — interruptions possible'
      : profile.cloudCover >= 0.6
        ? 'Overcast skies'
        : profile.isDayNight && profile.dewLikelihood >= 0.5
          ? 'Clear evening with dew expected'
          : 'Fine and clear';

  const detail =
    `${headline}. ${Math.round(profile.temperatureC)}°C, ${humidity}% humidity, ${cloud}% cloud, ` +
    `wind ${profile.windKph} kph from the ${profile.windDirection}. ` +
    `Chance of rain ${Math.round(profile.rainProbability * 100)}%. (Simulated forecast.)`;

  return {
    headline,
    detail,
    temperatureC: profile.temperatureC,
    humidity: profile.humidity,
    cloudCover: profile.cloudCover,
    windKph: profile.windKph,
    rainProbability: profile.rainProbability,
    dewLikelihood: profile.dewLikelihood,
    isSimulated: true,
    swingNote,
    dewNote,
  };
}
