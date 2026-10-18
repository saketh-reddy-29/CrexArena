import type { PitchProfile, PitchSurface, MatchFormatKey } from './types';
import type { VenueProfile } from './types';
import type { PitchReport } from './types';
import { SeededRng, clamp, round } from './rng';
import { PitchType } from '../../types/match';

interface SurfaceBaseline {
  pace: number;
  bounce: number;
  seamMovement: number;
  swingAssist: number;
  spinAssist: number;
  grip: number;
  hardness: number;
  grassCoverage: number;
  moisture: number;
  cracks: number;
  roughness: number;
  battingDifficulty: number;
  deteriorationRate: number;
}

const SURFACE_BASELINE: Record<PitchSurface, SurfaceBaseline> = {
  Batting: { pace: 60, bounce: 58, seamMovement: 25, swingAssist: 25, spinAssist: 35, grip: 35, hardness: 76, grassCoverage: 0.10, moisture: 0.35, cracks: 0.10, roughness: 0.15, battingDifficulty: 28, deteriorationRate: 0.30 },
  Green: { pace: 70, bounce: 62, seamMovement: 75, swingAssist: 62, spinAssist: 30, grip: 35, hardness: 65, grassCoverage: 0.60, moisture: 0.60, cracks: 0.05, roughness: 0.10, battingDifficulty: 62, deteriorationRate: 0.35 },
  Dry: { pace: 45, bounce: 50, seamMovement: 30, swingAssist: 28, spinAssist: 68, grip: 70, hardness: 70, grassCoverage: 0.10, moisture: 0.20, cracks: 0.50, roughness: 0.55, battingDifficulty: 55, deteriorationRate: 0.55 },
  Slow: { pace: 38, bounce: 40, seamMovement: 35, swingAssist: 30, spinAssist: 60, grip: 62, hardness: 50, grassCoverage: 0.12, moisture: 0.40, cracks: 0.30, roughness: 0.45, battingDifficulty: 60, deteriorationRate: 0.45 },
  'Hard Bouncy': { pace: 82, bounce: 82, seamMovement: 45, swingAssist: 45, spinAssist: 30, grip: 30, hardness: 88, grassCoverage: 0.25, moisture: 0.30, cracks: 0.20, roughness: 0.20, battingDifficulty: 52, deteriorationRate: 0.40 },
  Balanced: { pace: 58, bounce: 55, seamMovement: 45, swingAssist: 45, spinAssist: 45, grip: 45, hardness: 68, grassCoverage: 0.20, moisture: 0.40, cracks: 0.20, roughness: 0.28, battingDifficulty: 45, deteriorationRate: 0.40 },
};

function surfaceWeights(format: MatchFormatKey, venue: VenueProfile): Array<[PitchSurface, number]> {
  const base: Record<PitchSurface, number> = {
    Batting: 2,
    Green: 1.5,
    Dry: 1.5,
    Slow: 1.5,
    'Hard Bouncy': 1.2,
    Balanced: 2.5,
  };
  if (format === 'TEST') {
    base.Green += 1.5;
    base.Dry += 1.5;
    base.Batting -= 0.8;
  } else if (format === 'T20' || format === 'IPL') {
    base.Batting += 1.5;
    base.Slow -= 0.5;
  } else if (format === 'ODI') {
    base.Batting += 0.6;
    base.Balanced += 0.5;
  }
  // Venue influences: big grounds and high altitude carry pace/bounce; humid
  // coastal grounds reward spinners and get slower.
  if (venue.boundaryLengthM >= 72) base.Batting += 0.6;
  if (venue.altitudeM >= 500) {
    base['Hard Bouncy'] += 0.8;
    base.Green += 0.4;
  }
  if (venue.grassCoverage >= 0.35) base.Green += 0.7;
  if (venue.surfaceType === 'Red Soil' || venue.surfaceType === 'Clay') base.Dry += 0.6;
  const entries = Object.entries(base) as Array<[PitchSurface, number]>;
  return entries.map(([s, w]) => [s, Math.max(0.1, w)] as [PitchSurface, number]);
}

/**
 * Deterministically generate a match pitch profile. Two pitches of the same
 * surface differ because every attribute is sampled independently around the
 * surface baseline.
 */
export function generatePitchProfile(seed: number | string, format: MatchFormatKey, venue: VenueProfile): PitchProfile {
  const rng = new SeededRng(`${typeof seed === 'string' ? seed : seed}::pitch`);
  const surface = rng.weighted(surfaceWeights(format, venue));
  const b = SURFACE_BASELINE[surface];

  const attr = (value: number, spread: number, min = 0, max = 100) =>
    round(clamp(value + rng.noise(spread), min, max), 1);
  const unit = (value: number, spread: number) =>
    round(clamp(value + rng.noise(spread), 0, 1), 3);

  const profile: PitchProfile = {
    id: `${venue.id}-${surface.toLowerCase().replace(/\s+/g, '-')}`,
    surface,
    pace: attr(b.pace, 8),
    bounce: attr(b.bounce, 8),
    seamMovement: attr(b.seamMovement, 9),
    swingAssist: attr(b.swingAssist, 8),
    spinAssist: attr(b.spinAssist, 9),
    grip: attr(b.grip, 9),
    hardness: attr(b.hardness, 8),
    grassCoverage: unit(b.grassCoverage, 0.08),
    moisture: unit(b.moisture, 0.1),
    cracks: unit(b.cracks, 0.08),
    roughness: unit(b.roughness, 0.08),
    battingDifficulty: attr(b.battingDifficulty, 7),
    deteriorationRate: round(clamp(b.deteriorationRate + rng.noise(0.08), 0.1, 0.9), 3),
    reportText: '',
  };

  profile.reportText = describePitch(profile).detail;
  return profile;
}

/** Map a rich surface to the legacy PitchType enum the engine already knows. */
export function pitchProfileToPitchType(profile: PitchProfile): PitchType {
  switch (profile.surface) {
    case 'Batting':
      return PitchType.BATTING;
    case 'Green':
      return PitchType.PACE;
    case 'Hard Bouncy':
      return PitchType.PACE;
    case 'Dry':
      return PitchType.SPIN;
    case 'Slow':
      return PitchType.SLOW;
    default:
      return PitchType.BALANCED;
  }
}

export interface DeteriorationEffect {
  /** Extra seam movement on offer (0..0.4). */
  extraSeam: number;
  /** Extra turn on offer (0..0.4). */
  extraSpin: number;
  /** Uneven bounce / variable bounce (0..0.4). */
  extraUnevenBounce: number;
  /** Additional batting difficulty (0..0.4). */
  extraBattingDifficulty: number;
}

/**
 * Test-match pitch deterioration. Day 1 has no penalty; later days degrade at
 * the profile's own rate. Limited-overs games return a zero effect.
 */
export function deteriorationFromProfile(profile: PitchProfile, day: number, format: MatchFormatKey): DeteriorationEffect {
  if (format !== 'TEST' || day <= 1) {
    return { extraSeam: 0, extraSpin: 0, extraUnevenBounce: 0, extraBattingDifficulty: 0 };
  }
  const progress = clamp((day - 1) / 4, 0, 1); // day 5 = full
  const rate = profile.deteriorationRate;
  return {
    extraSeam: round(clamp(0.28 * rate * progress, 0, 0.4), 3),
    extraSpin: round(clamp((0.24 + profile.cracks * 0.3) * rate * progress, 0, 0.4), 3),
    extraUnevenBounce: round(clamp((0.18 + profile.cracks * 0.25) * rate * progress, 0, 0.4), 3),
    extraBattingDifficulty: round(clamp(0.32 * rate * progress, 0, 0.4), 3),
  };
}

/** Human-readable pitch report. */
export function describePitch(profile: PitchProfile): PitchReport {
  const traits: string[] = [];
  if (profile.grassCoverage >= 0.4) traits.push('Grassy');
  if (profile.seamMovement >= 60) traits.push('Seam movement');
  if (profile.swingAssist >= 55) traits.push('Swing in the air');
  if (profile.spinAssist >= 58) traits.push('Turn expected');
  if (profile.bounce >= 70) traits.push('True bounce');
  if (profile.bounce <= 42) traits.push('Low bounce');
  if (profile.battingDifficulty <= 35) traits.push('Excellent for batting');
  if (profile.battingDifficulty >= 60) traits.push('Hard work for batters');
  if (profile.deteriorationRate >= 0.5) traits.push('Degrades over time');
  if (traits.length === 0) traits.push('Even contest');

  const head: Record<PitchSurface, string> = {
    Batting: 'A belter of a batting surface',
    Green: 'A green, seaming surface',
    Dry: 'A dry surface that will take turn',
    Slow: 'A slow, low surface',
    'Hard Bouncy': 'A hard surface with true pace and bounce',
    Balanced: 'A balanced surface offering a fair contest',
  };

  const detail = [
    `${head[profile.surface]}.`,
    `Pace ${Math.round(profile.pace)}, bounce ${Math.round(profile.bounce)}, seam ${Math.round(profile.seamMovement)}, turn ${Math.round(profile.spinAssist)}.`,
    profile.battingDifficulty <= 35
      ? 'Batters should cash in early.'
      : profile.battingDifficulty >= 60
        ? 'Bowlers will fancy this one.'
        : 'Honours look even between bat and ball.',
  ].join(' ');

  return {
    surface: profile.surface,
    headline: head[profile.surface],
    detail,
    pace: profile.pace,
    bounce: profile.bounce,
    seamMovement: profile.seamMovement,
    spinAssist: profile.spinAssist,
    battingDifficulty: profile.battingDifficulty,
    traits,
  };
}
