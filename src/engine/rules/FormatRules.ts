import { FormatConfiguration, RulesEngine, FormatType } from './RulesEngine';

export const IPL2026Config: FormatConfiguration = {
  type: 'IPL',
  squad: {
    minSize: 18,
    maxSize: 25,
    maxOverseasInXI: 4,
    auction: true,
    impactPlayer: true,
    league: true,
  },
  innings: {
    maxInnings: 2,
    oversPerInnings: 20,
    powerplayEnabled: true,
    followOn: false,
    declaration: false,
  },
  match: {
    playingXI: 11,
    ballPolicy: { ballsAtStart: 1 },
    draw: false,
    tieBreaker: 'NRR',
  },
  points: {
    win: 2,
    loss: 0,
    draw: 0, // not applicable
    tie: 1, // simplified, usually Super Over resolves it
    noResult: 1,
  }
};

export const T20I2025Config: FormatConfiguration = {
  type: 'T20',
  squad: {
    minSize: 15,
    maxSize: 18,
    maxOverseasInXI: 11, // no overseas limit for international
    auction: false,
    impactPlayer: false,
    league: false,
  },
  innings: {
    maxInnings: 2,
    oversPerInnings: 20,
    powerplayEnabled: true,
    followOn: false,
    declaration: false,
  },
  match: {
    playingXI: 11,
    ballPolicy: { ballsAtStart: 1 },
    draw: false,
    tieBreaker: 'SUPER_OVER',
  },
  points: { win: 2, loss: 0, draw: 0, tie: 1, noResult: 1 }
};

export const ODI2025Config: FormatConfiguration = {
  type: 'ODI',
  squad: {
    minSize: 15,
    maxSize: 18,
    maxOverseasInXI: 11,
    auction: false,
    impactPlayer: false,
    league: false,
  },
  innings: {
    maxInnings: 2,
    oversPerInnings: 50,
    powerplayEnabled: true,
    followOn: false,
    declaration: false,
  },
  match: {
    playingXI: 11,
    // Modern ODI rules: one ball used per innings for the final 16 overs
    ballPolicy: { ballsAtStart: 2, ballsForFinal16Overs: 1 },
    draw: false,
    tieBreaker: 'NRR',
  },
  points: { win: 2, loss: 0, draw: 0, tie: 1, noResult: 1 }
};

export const Test2025Config: FormatConfiguration = {
  type: 'TEST',
  squad: {
    minSize: 15,
    maxSize: 18,
    maxOverseasInXI: 11,
    auction: false,
    impactPlayer: false,
    league: false,
  },
  innings: {
    maxInnings: 4,
    oversPerInnings: null, // Unlimited
    powerplayEnabled: false,
    followOn: true,
    declaration: true,
  },
  match: {
    playingXI: 11,
    ballPolicy: { ballsAtStart: 1 }, // Actually changes after 80 overs, but simplifying
    draw: true,
    tieBreaker: 'NONE',
  },
  points: {
    win: 12, // Standard WTC points
    loss: 0,
    draw: 4,
    tie: 6,
    noResult: 0,
  }
};

// Ready-to-use engines
export const IPLRules = new RulesEngine(IPL2026Config);
export const T20IRules = new RulesEngine(T20I2025Config);
export const ODIRules = new RulesEngine(ODI2025Config);
export const TestRules = new RulesEngine(Test2025Config);

export function getRulesEngineForFormat(format: FormatType): RulesEngine {
  switch (format) {
    case 'IPL': return IPLRules;
    case 'T20': return T20IRules;
    case 'ODI': return ODIRules;
    case 'TEST': return TestRules;
    default: return T20IRules;
  }
}
