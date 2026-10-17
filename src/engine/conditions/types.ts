import type { PitchType, WeatherCondition } from '../../types/match';

/**
 * Formats the conditions engine understands. Mirrors ArenaFormat but kept as a
 * narrow string union so the engine stays free of store imports.
 */
export type MatchFormatKey = 'T20' | 'ODI' | 'TEST' | 'IPL';

/** Descriptive pitch surfaces. These are profiles, never fixed outcomes. */
export type PitchSurface =
  | 'Batting'
  | 'Green'
  | 'Dry'
  | 'Slow'
  | 'Hard Bouncy'
  | 'Balanced';

/**
 * A configured venue. Ground dimensions and outfield speed are first-class
 * gameplay inputs — short boundaries and fast outfields genuinely score more.
 */
export interface VenueProfile {
  id: string;
  name: string;
  country: string;
  /** Straight boundary length in metres (typical ~65-75). */
  boundaryLengthM: number;
  /** Square boundary length in metres (typical ~58-70). */
  boundaryWidthM: number;
  altitudeM: number;
  surfaceType: 'Hard' | 'Grass' | 'Clay' | 'Loam' | 'Red Soil' | 'Black Soil';
  grassCoverage: number; // 0..1
  /** Outfield pace multiplier. >1 = fast outfield that races away. */
  outfieldSpeed: number; // 0.85..1.20
  /** How often evening dew is a factor here (0..1). */
  dewTendency: number; // 0..1
  typicalPitch: PitchType;
  historicalNote?: string;
  isNeutral?: boolean;
}

/**
 * A match-specific pitch profile. Two pitches of the same surface can have
 * quite different attributes because each dimension is sampled independently.
 */
export interface PitchProfile {
  id: string;
  surface: PitchSurface;
  /** Pace carried off the surface (0-100). */
  pace: number;
  /** Height of bounce (0-100). */
  bounce: number;
  /** Lateral seam movement (0-100). */
  seamMovement: number;
  /** Base swing assistance the surface offers (0-100). */
  swingAssist: number;
  /** Spin and turn on offer (0-100). */
  spinAssist: number;
  /** Grip for finger/spinners (0-100). */
  grip: number;
  /** Surface hardness (0-100). */
  hardness: number;
  /** Grass left on top (0-1). */
  grassCoverage: number;
  /** Surface moisture (0-1). */
  moisture: number;
  /** Cracking (0-1, higher in later Test days). */
  cracks: number;
  /** Rough patches for spin to exploit (0-1). */
  roughness: number;
  /** Overall batting difficulty (0-100, higher = harder to bat). */
  battingDifficulty: number;
  /** How quickly the pitch degrades per Test day (0-1). */
  deteriorationRate: number;
  reportText: string;
}

/**
 * A deterministic, seeded weather forecast. Clearly marked as simulated — the
 * game never invents or claims live weather data.
 */
export interface WeatherProfile {
  temperatureC: number;
  humidity: number; // 0..1
  cloudCover: number; // 0..1
  windKph: number;
  windDirection: string;
  rainProbability: number; // 0..1
  dewLikelihood: number; // 0..1
  /** Only meaningful for limited-overs day/night games. */
  isDayNight: boolean;
  /** Always true — conditions are simulated, not fetched live. */
  isSimulated: true;
  forecastText: string;
}

/**
 * Derived per-delivery condition multipliers. All values are small, bounded
 * refinements layered on top of the existing coarse PitchType/WeatherCondition
 * logic in MatchEngine (so nothing is applied twice in the same way).
 */
export interface MatchConditionsModel {
  format: MatchFormatKey;
  /** Test day (1..5); 1 for limited overs. */
  day: number;
  /** >1 short boundaries → more boundaries reach the rope. */
  boundaryFactor: number;
  /** >1 fast outfield → ground shots travel further/faster. */
  outfieldFactor: number;
  /** Extra seam movement from surface + atmosphere (0..1). */
  seamAssist: number;
  /** Extra swing from atmospheric conditions (0..1). */
  swingAssist: number;
  /** Extra spin from surface + roughness (0..1). */
  spinAssist: number;
  /** Pace/bounce carried (0..1). */
  paceBounce: number;
  /** Dew-related grip loss for bowlers later in a day-night game (0..1). */
  dewGripPenalty: number;
  /** Overall batting difficulty (0..1). */
  battingDifficulty: number;
  /** Test deterioration: extra turn/uneven bounce later in the match (0..1). */
  deterioration: number;
  /** Overs expected to be lost to weather (Test). */
  expectedLostOvers: number;
  /** Draw probability estimate driven by weather + time left (Test, 0..1). */
  drawRisk: number;
}

/** Ground/boundary summary for the UI. */
export interface GroundReport {
  name: string;
  country: string;
  boundarySummary: string;
  outfieldSummary: string;
  altitudeNote?: string;
  surfaceNote?: string;
  historicalNote?: string;
}

export interface PitchReport {
  surface: PitchSurface;
  headline: string;
  detail: string;
  pace: number;
  bounce: number;
  seamMovement: number;
  spinAssist: number;
  battingDifficulty: number;
  /** Short human-readable trait list, e.g. ["Dry", "Turn expected later"]. */
  traits: string[];
}

export interface WeatherReport {
  headline: string;
  detail: string;
  temperatureC: number;
  humidity: number;
  cloudCover: number;
  windKph: number;
  rainProbability: number;
  dewLikelihood: number;
  isSimulated: boolean;
  swingNote: string;
  dewNote: string;
}

/** One transparent contributing factor behind a toss recommendation. */
export interface TossFactor {
  label: string;
  /** Signed contribution: positive favours BAT first, negative favours BOWL first. */
  contribution: number;
  detail: string;
}

/** A decision-support estimate — NOT a win probability. */
export interface TossRecommendation {
  format: MatchFormatKey;
  recommendation: 'BAT' | 'BOWL';
  batFirstScore: number;
  bowlFirstScore: number;
  /** Strength of the recommendation, 0..1. Decision support only. */
  confidence: number;
  /** Strongest factors influencing the call, in order. */
  rationale: string[];
  /** One-line explanation of the opposite choice. */
  alternative: string;
  factors: TossFactor[];
}

/**
 * The full persisted conditions bundle stored on a fixture before play starts.
 * Refreshing, watching or skipping the match reuses this exact object.
 */
export interface MatchConditionReport {
  seed: number;
  venue: VenueProfile;
  pitch: PitchProfile;
  weather: WeatherProfile;
  model: MatchConditionsModel;
  /** Legacy enums kept in sync so existing UI/engines still work. */
  legacyPitchType: PitchType;
  legacyWeatherCondition: WeatherCondition;
  createdAt: number;
}
