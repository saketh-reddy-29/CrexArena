import type {
  MatchConditionsModel,
  MatchFormatKey,
  PitchProfile,
  WeatherProfile,
  VenueProfile,
} from './types';
import { boundaryFactorFromVenue } from './venueRegistry';
import { deteriorationFromProfile } from './pitchProfile';
import { drawRiskFromWeather, expectedLostOvers, swingAssistFromWeather } from './weatherProfile';
import { clamp, round } from './rng';

export interface DeriveConditionsInput {
  venue: VenueProfile;
  pitch: PitchProfile;
  weather: WeatherProfile;
  format: MatchFormatKey;
  /** Test day (1..5). Ignored for limited-overs formats. */
  day?: number;
}

/**
 * Compose the coarse venue/pitch/weather profiles into the small, bounded
 * per-delivery multipliers consumed by the match engine. Every value is a
 * refinement — it never overrides the engine's own PitchType/WeatherCondition
 * handling, it layers venue dimensions, outfield pace, dew and Test
 * deterioration on top.
 */
export function deriveEffectiveConditions(input: DeriveConditionsInput): MatchConditionsModel {
  const { venue, pitch, weather, format } = input;
  const day = format === 'TEST' ? clamp(Math.round(input.day ?? 1), 1, 5) : 1;

  // Boundary factor: short grounds allow more boundaries; altitude adds carry.
  const altitudeBonus = venue.altitudeM >= 500 ? 0.03 : venue.altitudeM >= 200 ? 0.015 : 0;
  const boundaryFactor = round(clamp(boundaryFactorFromVenue(venue) + altitudeBonus, 0.82, 1.22), 3);

  // Outfield: speed multiplier; a wet outfield slows the ball down.
  const outfieldFactor = round(clamp(venue.outfieldSpeed - weather.rainProbability * 0.08, 0.8, 1.2), 3);

  const seamAssist = round(
    clamp((pitch.seamMovement / 100) * 0.6 + pitch.grassCoverage * 0.2 + pitch.moisture * 0.2, 0, 1),
    3,
  );

  const swingAssist = round(
    clamp(swingAssistFromWeather(weather) * 0.7 + (pitch.swingAssist / 100) * 0.3, 0, 1),
    3,
  );

  const spinAssist = round(
    clamp((pitch.spinAssist / 100) * 0.7 + pitch.roughness * 0.2 + pitch.cracks * 0.1, 0, 1),
    3,
  );

  const paceBounce = round(clamp((pitch.pace / 100) * 0.5 + (pitch.bounce / 100) * 0.5, 0, 1), 3);

  // Dew matters most in day/night limited-overs games; Tests are barely affected.
  const dewGripPenalty = round(
    clamp(weather.isDayNight ? weather.dewLikelihood * 0.6 : weather.dewLikelihood * 0.2, 0, 0.5),
    3,
  );

  const battingDifficulty = round(clamp(pitch.battingDifficulty / 100, 0, 1), 3);

  const det = deteriorationFromProfile(pitch, day, format);
  const deterioration = round(clamp((det.extraSeam + det.extraSpin + det.extraUnevenBounce) / 1.2, 0, 1), 3);

  return {
    format,
    day,
    boundaryFactor,
    outfieldFactor,
    seamAssist,
    swingAssist,
    spinAssist,
    paceBounce,
    dewGripPenalty,
    battingDifficulty,
    deterioration,
    expectedLostOvers: expectedLostOvers(weather, format),
    drawRisk: drawRiskFromWeather(weather, format, day),
  };
}

/** Compact one-line summary for a live-match conditions HUD. */
export function summarizeConditionsForLive(model: MatchConditionsModel): string {
  const bits: string[] = [];
  bits.push(`Boundaries x${model.boundaryFactor.toFixed(2)}`);
  bits.push(`Outfield x${model.outfieldFactor.toFixed(2)}`);
  if (model.seamAssist >= 0.5) bits.push('Seam-friendly');
  if (model.swingAssist >= 0.5) bits.push('Swinging');
  if (model.spinAssist >= 0.55) bits.push('Turn on offer');
  if (model.dewGripPenalty >= 0.3) bits.push('Dew grip loss');
  if (model.deterioration >= 0.3) bits.push(`Deteriorating (Day ${model.day})`);
  if (model.expectedLostOvers > 0) bits.push(`~${model.expectedLostOvers} overs at risk`);
  return bits.join(' · ');
}
