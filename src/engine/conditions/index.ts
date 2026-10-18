import type { MatchConditionReport, MatchFormatKey } from './types';
import { resolveVenue } from './venueRegistry';
import { generatePitchProfile, pitchProfileToPitchType } from './pitchProfile';
import { generateWeatherProfile, weatherProfileToCondition } from './weatherProfile';
import { deriveEffectiveConditions } from './conditionsModel';
import type { WeatherGenOptions } from './weatherProfile';

export * from './types';
export * from './rng';
export * from './venueRegistry';
export * from './pitchProfile';
export * from './weatherProfile';
export * from './conditionsModel';
export * from './tossRecommendation';

/**
 * Build the full, deterministic conditions bundle for a fixture.
 *
 * The same (seed, format, venue) triple always produces the same report, which
 * is what lets a fixture's pitch, weather and toss report survive a refresh or
 * a spectator skip without regenerating.
 */
export function buildMatchConditionsReport(
  seed: number,
  format: MatchFormatKey,
  venueName?: string,
  day = 1,
  weatherOptions?: WeatherGenOptions,
): MatchConditionReport {
  const venue = resolveVenue(seed, venueName);
  const pitch = generatePitchProfile(seed, format, venue);
  const weather = generateWeatherProfile(seed, venue, format, weatherOptions);
  const model = deriveEffectiveConditions({ venue, pitch, weather, format, day });

  return {
    seed,
    venue,
    pitch,
    weather,
    model,
    legacyPitchType: pitchProfileToPitchType(pitch),
    legacyWeatherCondition: weatherProfileToCondition(weather),
    createdAt: Date.now(),
  };
}

/**
 * Derive the conditions model for a specific Test day without regenerating the
 * underlying pitch or weather — deterioration only advances, it never re-rolls.
 */
export function matchConditionsForDay(report: MatchConditionReport, day: number) {
  return deriveEffectiveConditions({
    venue: report.venue,
    pitch: report.pitch,
    weather: report.weather,
    format: report.model.format,
    day,
  });
}
