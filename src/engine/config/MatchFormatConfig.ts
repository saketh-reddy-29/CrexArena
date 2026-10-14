import { ArenaFormat } from '../models/ArenaState';

export interface PowerplayPhaseConfig {
  name: string;
  startOver: number;
  endOver: number;
  maxOutsideCircle: number;
  mandatoryCatchers?: number;
  description: string;
}

export interface RunDistributionWeights {
  dot: number;
  one: number;
  two: number;
  three: number;
  four: number;
  six: number;
}

export interface TestSessionSchedule {
  day: number;
  session: 'Morning' | 'Afternoon' | 'Evening';
  startOver: number;
  endOver: number;
  newBallAvailableOver?: number;
}

export interface MatchFormatConfig {
  format: ArenaFormat;
  displayName: string;
  oversPerInnings: number; // 20, 50, or Infinity for Test
  maxInnings: number; // 2 for limited overs, 4 for Test
  maxOversPerBowler: number; // 4 for T20, 10 for ODI, Infinity for Test
  minBowlersRequired: number; // 5 for limited overs
  maxBouncersPerOver: number; // 2 for T20/ODI/Test (under ICC rules)
  drsReviewsPerInnings: number; // 2 for T20/ODI, 3 per 80 ov for Test
  drsResetOvers?: number; // 80 for Test
  followOnLeadRequirement?: number; // 200 for Test
  declarationAllowed: boolean;
  baseWicketProbability: number; // T20 ~0.028, ODI ~0.022, TEST ~0.016
  minWicketProbability: number;
  maxWicketProbability: number;
  baseRunDistribution: RunDistributionWeights;
  powerplayPhases: PowerplayPhaseConfig[];
  ballPolicy: {
    ballsAtStart: number;
    ballsForFinalOvers?: number;
    newBallOvers?: number;
  };
  fieldBoundaryRadius: number; // Canonical 268 in 600x600 space
  innerCircleRadius: { rx: number; ry: number }; // 160 x 190
}

export const T20_FORMAT_CONFIG: MatchFormatConfig = {
  format: 'T20',
  displayName: 'Twenty20 International / League',
  oversPerInnings: 20,
  maxInnings: 2,
  maxOversPerBowler: 4,
  minBowlersRequired: 5,
  maxBouncersPerOver: 2,
  drsReviewsPerInnings: 2,
  declarationAllowed: false,
  baseWicketProbability: 0.028,
  minWicketProbability: 0.010,
  maxWicketProbability: 0.110,
  baseRunDistribution: {
    dot: 34,
    one: 36,
    two: 10,
    three: 1.5,
    four: 12.5,
    six: 6.0,
  },
  powerplayPhases: [
    {
      name: 'Powerplay (P1)',
      startOver: 0,
      endOver: 6,
      maxOutsideCircle: 2,
      description: 'Mandatory powerplay: max 2 fielders outside 30-yard circle',
    },
    {
      name: 'Middle Overs',
      startOver: 6,
      endOver: 15,
      maxOutsideCircle: 5,
      description: 'Middle overs: max 5 fielders outside 30-yard circle',
    },
    {
      name: 'Death Overs',
      startOver: 15,
      endOver: 20,
      maxOutsideCircle: 5,
      description: 'Death overs: max 5 fielders outside 30-yard circle',
    },
  ],
  ballPolicy: {
    ballsAtStart: 1,
  },
  fieldBoundaryRadius: 268,
  innerCircleRadius: { rx: 160, ry: 190 },
};

export const ODI_FORMAT_CONFIG: MatchFormatConfig = {
  format: 'ODI',
  displayName: 'One Day International (50 Overs)',
  oversPerInnings: 50,
  maxInnings: 2,
  maxOversPerBowler: 10,
  minBowlersRequired: 5,
  maxBouncersPerOver: 2,
  drsReviewsPerInnings: 2,
  declarationAllowed: false,
  baseWicketProbability: 0.022,
  minWicketProbability: 0.008,
  maxWicketProbability: 0.085,
  baseRunDistribution: {
    dot: 44,
    one: 38,
    two: 8.5,
    three: 1.5,
    four: 6.5,
    six: 1.5,
  },
  powerplayPhases: [
    {
      name: 'Powerplay 1 (P1)',
      startOver: 0,
      endOver: 10,
      maxOutsideCircle: 2,
      mandatoryCatchers: 2,
      description: 'Mandatory powerplay: max 2 fielders outside 30-yard circle',
    },
    {
      name: 'Powerplay 2 (P2)',
      startOver: 10,
      endOver: 40,
      maxOutsideCircle: 4,
      description: 'Middle powerplay: max 4 fielders outside 30-yard circle',
    },
    {
      name: 'Powerplay 3 (P3)',
      startOver: 40,
      endOver: 50,
      maxOutsideCircle: 5,
      description: 'Death powerplay: max 5 fielders outside 30-yard circle',
    },
  ],
  ballPolicy: {
    ballsAtStart: 2, // 2 new balls from each end in ODIs
  },
  fieldBoundaryRadius: 268,
  innerCircleRadius: { rx: 160, ry: 190 },
};

export const TEST_FORMAT_CONFIG: MatchFormatConfig = {
  format: 'TEST',
  displayName: 'Test Match (5 Days, 4 Innings)',
  oversPerInnings: Infinity,
  maxInnings: 4,
  maxOversPerBowler: Infinity,
  minBowlersRequired: 2,
  maxBouncersPerOver: 2,
  drsReviewsPerInnings: 3,
  drsResetOvers: 80,
  followOnLeadRequirement: 200,
  declarationAllowed: true,
  baseWicketProbability: 0.016,
  minWicketProbability: 0.005,
  maxWicketProbability: 0.075,
  baseRunDistribution: {
    dot: 68,
    one: 21,
    two: 4.5,
    three: 1.0,
    four: 5.0,
    six: 0.5,
  },
  powerplayPhases: [
    {
      name: 'Test Field Configuration',
      startOver: 0,
      endOver: 9999,
      maxOutsideCircle: 9, // No boundary cap in Test cricket
      description: 'Test fielding: slips cordon, close catchers and tactical boundaries without ring restrictions',
    },
  ],
  ballPolicy: {
    ballsAtStart: 1,
    newBallOvers: 80, // New ball available every 80 overs in Test cricket
  },
  fieldBoundaryRadius: 268,
  innerCircleRadius: { rx: 160, ry: 190 },
};

export const IPL_FORMAT_CONFIG: MatchFormatConfig = {
  ...T20_FORMAT_CONFIG,
  format: 'IPL',
  displayName: 'Indian Premier League (IPL)',
};

export const FORMAT_CONFIG_REGISTRY: Record<string, MatchFormatConfig> = {
  T20: T20_FORMAT_CONFIG,
  ODI: ODI_FORMAT_CONFIG,
  TEST: TEST_FORMAT_CONFIG,
  IPL: IPL_FORMAT_CONFIG,
};

export function getMatchFormatConfig(format: ArenaFormat | string = 'T20'): MatchFormatConfig {
  const normalized = (format || 'T20').toUpperCase();
  return FORMAT_CONFIG_REGISTRY[normalized] || T20_FORMAT_CONFIG;
}
