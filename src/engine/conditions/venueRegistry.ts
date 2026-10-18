import type { VenueProfile, MatchFormatKey } from './types';
import { SeededRng } from './rng';
import { PitchType } from '../../types/match';

/**
 * Ground registry. Ground dimensions and outfield speed are first-class
 * gameplay inputs — short boundaries and fast outfields genuinely score more
 * runs, and that is modelled downstream rather than asserted as a fixed total.
 */
export const VENUE_REGISTRY: readonly VenueProfile[] = [
  {
    id: 'wankhede',
    name: 'Wankhede Stadium, Mumbai',
    country: 'India',
    boundaryLengthM: 66,
    boundaryWidthM: 60,
    altitudeM: 14,
    surfaceType: 'Black Soil',
    grassCoverage: 0.15,
    outfieldSpeed: 1.1,
    dewTendency: 0.8,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Evening dew is a real factor; short square boundaries.',
  },
  {
    id: 'chidambaram',
    name: 'MA Chidambaram Stadium, Chennai',
    country: 'India',
    boundaryLengthM: 68,
    boundaryWidthM: 62,
    altitudeM: 6,
    surfaceType: 'Red Soil',
    grassCoverage: 0.1,
    outfieldSpeed: 1.0,
    dewTendency: 0.35,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Humid coastal air; spin gripped as the game progressed.',
  },
  {
    id: 'chinnaswamy',
    name: 'M. Chinnaswamy Stadium, Bengaluru',
    country: 'India',
    boundaryLengthM: 63,
    boundaryWidthM: 58,
    altitudeM: 920,
    surfaceType: 'Loam',
    grassCoverage: 0.2,
    outfieldSpeed: 1.15,
    dewTendency: 0.5,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'High altitude thins the air — the ball carries further.',
  },
  {
    id: 'eden',
    name: 'Eden Gardens, Kolkata',
    country: 'India',
    boundaryLengthM: 68,
    boundaryWidthM: 64,
    altitudeM: 9,
    surfaceType: 'Loam',
    grassCoverage: 0.18,
    outfieldSpeed: 1.05,
    dewTendency: 0.7,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Big square boundaries; dew often decides evening games.',
  },
  {
    id: 'narendra-modi',
    name: 'Narendra Modi Stadium, Ahmedabad',
    country: 'India',
    boundaryLengthM: 70,
    boundaryWidthM: 65,
    altitudeM: 53,
    surfaceType: 'Clay',
    grassCoverage: 0.12,
    outfieldSpeed: 0.95,
    dewTendency: 0.6,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Large outfield; surface often holds up for strokeplay.',
  },
  {
    id: 'sawai-mansingh',
    name: 'Sawai Mansingh Stadium, Jaipur',
    country: 'India',
    boundaryLengthM: 67,
    boundaryWidthM: 62,
    altitudeM: 430,
    surfaceType: 'Clay',
    grassCoverage: 0.15,
    outfieldSpeed: 1.0,
    dewTendency: 0.4,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Dry heat helps spin as the surface bakes.',
  },
  {
    id: 'arun-jaitley',
    name: 'Arun Jaitley Stadium, Delhi',
    country: 'India',
    boundaryLengthM: 68,
    boundaryWidthM: 63,
    altitudeM: 216,
    surfaceType: 'Loam',
    grassCoverage: 0.12,
    outfieldSpeed: 1.0,
    dewTendency: 0.55,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Smoggy evenings can dull the surface a touch.',
  },
  {
    id: 'ekana',
    name: 'BRSABV Ekana Cricket Stadium, Lucknow',
    country: 'India',
    boundaryLengthM: 72,
    boundaryWidthM: 68,
    altitudeM: 120,
    surfaceType: 'Clay',
    grassCoverage: 0.2,
    outfieldSpeed: 0.9,
    dewTendency: 0.5,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Biggest square in the league; slow surface aids spinners.',
  },
  {
    id: 'rgi',
    name: 'Rajiv Gandhi International Cricket Stadium, Hyderabad',
    country: 'India',
    boundaryLengthM: 68,
    boundaryWidthM: 64,
    altitudeM: 540,
    surfaceType: 'Red Soil',
    grassCoverage: 0.15,
    outfieldSpeed: 1.05,
    dewTendency: 0.45,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Red-soil surface offers true bounce early on.',
  },
  {
    id: 'pca',
    name: 'PCA Stadium, Mohali',
    country: 'India',
    boundaryLengthM: 70,
    boundaryWidthM: 65,
    altitudeM: 320,
    surfaceType: 'Grass',
    grassCoverage: 0.4,
    outfieldSpeed: 1.0,
    dewTendency: 0.3,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Cool evenings help seamers with the new ball.',
  },
  {
    id: 'gaddafi',
    name: 'Gaddafi Stadium, Lahore',
    country: 'Pakistan',
    boundaryLengthM: 70,
    boundaryWidthM: 64,
    altitudeM: 210,
    surfaceType: 'Loam',
    grassCoverage: 0.15,
    outfieldSpeed: 1.0,
    dewTendency: 0.5,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Flat and true early; spin arrives in the second innings.',
  },
  {
    id: 'premadasa',
    name: 'R. Premadasa Stadium, Colombo',
    country: 'Sri Lanka',
    boundaryLengthM: 68,
    boundaryWidthM: 63,
    altitudeM: 7,
    surfaceType: 'Loam',
    grassCoverage: 0.18,
    outfieldSpeed: 1.0,
    dewTendency: 0.45,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Humid and slow; spinners get genuine grip.',
  },
  {
    id: 'sher-e-bangla',
    name: 'Sher-e-Bangla National Cricket Stadium, Dhaka',
    country: 'Bangladesh',
    boundaryLengthM: 66,
    boundaryWidthM: 60,
    altitudeM: 10,
    surfaceType: 'Loam',
    grassCoverage: 0.2,
    outfieldSpeed: 0.95,
    dewTendency: 0.4,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Slow and tacky; dew is rare, grip is plentiful.',
  },
  {
    id: 'dubai',
    name: 'Dubai International Cricket Stadium, Dubai',
    country: 'UAE',
    boundaryLengthM: 68,
    boundaryWidthM: 64,
    altitudeM: 5,
    surfaceType: 'Hard',
    grassCoverage: 0.15,
    outfieldSpeed: 1.0,
    dewTendency: 0.25,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'True bounce, low dew, and a big outfield to defend.',
  },
  {
    id: 'scg',
    name: 'Sydney Cricket Ground, Sydney',
    country: 'Australia',
    boundaryLengthM: 75,
    boundaryWidthM: 70,
    altitudeM: 20,
    surfaceType: 'Grass',
    grassCoverage: 0.35,
    outfieldSpeed: 1.05,
    dewTendency: 0.2,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Large square; spin grips late on day four and five.',
  },
];

/** Case-insensitive fuzzy venue lookup used when a fixture carries a venue name. */
export function getVenueByName(name: string): VenueProfile | null {
  if (!name) return null;
  const q = name.toLowerCase().trim();
  // Exact (case-insensitive) match first.
  const exact = VENUE_REGISTRY.find(v => v.name.toLowerCase() === q);
  if (exact) return exact;
  // Substring match on either direction, then token overlap.
  const loose = VENUE_REGISTRY.find(v => v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase()));
  if (loose) return loose;
  const qTokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  let best: VenueProfile | null = null;
  let bestScore = 0;
  for (const v of VENUE_REGISTRY) {
    const vTokens = v.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const score = qTokens.filter(t => vTokens.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return bestScore >= 2 ? best : null;
}

/** Build a synthetic venue profile when a fixture references an unknown ground. */
export function synthesizeVenue(seed: number, name?: string): VenueProfile {
  const rng = new SeededRng(seed);
  const boundaryLengthM = rng.int(62, 74);
  const boundaryWidthM = rng.int(56, 70);
  const outfieldSpeed = Number(rng.range(0.9, 1.15).toFixed(3));
  const grassCoverage = Number(rng.range(0.08, 0.4).toFixed(3));
  const dewTendency = Number(rng.range(0.2, 0.75).toFixed(3));
  return {
    id: 'synthetic',
    name: name || 'Unnamed Ground',
    country: 'Unknown',
    boundaryLengthM,
    boundaryWidthM,
    altitudeM: rng.int(5, 600),
    surfaceType: rng.weighted([
      ['Loam', 3],
      ['Clay', 2],
      ['Red Soil', 2],
      ['Black Soil', 1],
      ['Hard', 1],
      ['Grass', 1],
    ]),
    grassCoverage,
    outfieldSpeed,
    dewTendency,
    typicalPitch: PitchType.BALANCED,
    historicalNote: 'Ground profile estimated from regional characteristics.',
  };
}

/**
 * Resolve a venue from a fixture's venue string, falling back to a seeded
 * synthetic profile so conditions remain deterministic per fixture.
 */
export function resolveVenue(seed: number, venueName?: string): VenueProfile {
  return (venueName ? getVenueByName(venueName) : null) ?? synthesizeVenue(seed, venueName);
}

/** Pick a venue deterministically for a given seed and format. */
export function selectVenueForMatch(seed: number, _format: MatchFormatKey): VenueProfile {
  const rng = new SeededRng(seed);
  return VENUE_REGISTRY[rng.int(0, VENUE_REGISTRY.length - 1)];
}

/**
 * Boundary factor derived from real ground dimensions.
 * Shorter-than-canonical boundaries raise the factor above 1 (more reach),
 * larger ones lower it below 1. Canonical straight = 68 m.
 */
export function boundaryFactorFromVenue(venue: VenueProfile): number {
  const avg = (venue.boundaryLengthM + venue.boundaryWidthM) / 2;
  // 58 m → ~1.15, 68 m → 1.00, 75 m → ~0.90
  return Math.min(1.18, Math.max(0.85, 68 / avg));
}

/** Human-readable boundary summary. */
export function describeGround(venue: VenueProfile): string {
  const { boundaryLengthM, boundaryWidthM } = venue;
  let size: string;
  if (boundaryLengthM <= 64 && boundaryWidthM <= 60) size = 'very small';
  else if (boundaryLengthM <= 68 && boundaryWidthM <= 63) size = 'compact';
  else if (boundaryLengthM <= 70 && boundaryWidthM <= 66) size = 'standard';
  else size = 'spacious';
  const straight = `${boundaryLengthM} m straight`;
  const square = `${boundaryWidthM} m square`;
  const outfield =
    venue.outfieldSpeed >= 1.1
      ? 'A lightning-fast outfield races boundaries away.'
      : venue.outfieldSpeed >= 1.0
        ? 'A firm, true outfield.'
        : 'A slow outfield that saps the pace of ground shots.';
  return `Ground is ${size} — ${straight}, ${square}. ${outfield}`;
}
