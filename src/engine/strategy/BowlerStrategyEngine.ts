import { BowlingTactic } from '../../components/CricketActionVisualizer';

export type BowlerTacticalPlan =
  | 'OUTSWING_ATTACK'
  | 'INSWING_STUMPS'
  | 'YORKER_DEATH'
  | 'WIDE_YORKER_CONTAIN'
  | 'SLOWER_VARIATION'
  | 'BOUNCER_SURPRISE'
  | 'OFF_BREAK_TURN'
  | 'LEG_BREAK_TRAP'
  | 'DOOSRA_DECEPTION'
  | 'GOOGLY_STRIKE';

export interface BowlerStrategyDecision {
  mode: 'RUN_CONTROL' | 'WICKET_ATTACK' | 'DEATH_CONTAINMENT';
  recommendedTactic: BowlingTactic;
  plan: BowlerTacticalPlan;
  boundaryPressureDetected: boolean;
  fieldAdjustment: 'NONE' | 'COVER_PROTECTION' | 'MIDWICKET_PROTECTION' | 'DEATH_RING' | 'RING_PRESSURE';
  targetLineLengthDescription: string;
}

export class BowlerStrategyEngine {
  /**
   * Generates dynamic bowling tactics and responses to batter momentum
   */
  public evaluate(
    format: string,
    overs: number,
    wickets: number,
    bowlerStyle: string = 'Fast',
    recentBallsRuns: number[] = [],
    isNewBatter: boolean = false,
    partnershipRuns: number = 0
  ): BowlerStrategyDecision {
    const fmt = format.toUpperCase();
    const isSpinner = bowlerStyle.toLowerCase().includes('spin');

    // 1. Boundary Pressure Detection (e.g. 8+ runs in last 3 balls)
    const last3Runs = recentBallsRuns.slice(-3).reduce((a, b) => a + b, 0);
    const boundaryPressureDetected = last3Runs >= 8;

    // 2. Mode Determination
    let mode: 'RUN_CONTROL' | 'WICKET_ATTACK' | 'DEATH_CONTAINMENT' = 'RUN_CONTROL';
    if (isNewBatter || (fmt === 'TEST' && overs < 15) || wickets > 7) {
      mode = 'WICKET_ATTACK';
    } else if ((fmt === 'T20' && overs >= 16) || (fmt === 'ODI' && overs >= 42)) {
      mode = 'DEATH_CONTAINMENT';
    } else if (boundaryPressureDetected) {
      mode = 'RUN_CONTROL';
    } else {
      mode = 'RUN_CONTROL';
    }

    // 3. Select Recommended Tactic & Plan
    let recommendedTactic: BowlingTactic = 'OUTSWING';
    let plan: BowlerTacticalPlan = 'OUTSWING_ATTACK';
    let fieldAdjustment: 'NONE' | 'COVER_PROTECTION' | 'MIDWICKET_PROTECTION' | 'DEATH_RING' | 'RING_PRESSURE' = 'NONE';
    let description = 'Good length outside off-stump';

    if (isSpinner) {
      if (mode === 'WICKET_ATTACK') {
        recommendedTactic = 'GOOGLY';
        plan = 'GOOGLY_STRIKE';
        description = 'Googly attacking the stumps to exploit new batter';
      } else if (partnershipRuns > 50) {
        recommendedTactic = 'DOOSRA';
        plan = 'DOOSRA_DECEPTION';
        description = 'Doosra turning away to break established partnership';
      } else {
        recommendedTactic = 'OFF_BREAK';
        plan = 'OFF_BREAK_TURN';
        description = 'Tossing it up outside off to generate spin and drift';
      }
    } else {
      // Pace bowler
      if (mode === 'DEATH_CONTAINMENT') {
        if (boundaryPressureDetected) {
          recommendedTactic = 'SLOWER_BALL';
          plan = 'SLOWER_VARIATION';
          fieldAdjustment = 'DEATH_RING';
          description = 'Off-cutter / back of hand slower ball outside off';
        } else {
          recommendedTactic = 'YORKER';
          plan = 'YORKER_DEATH';
          fieldAdjustment = 'DEATH_RING';
          description = 'Toecrushing yorker targeting base of middle and off';
        }
      } else if (mode === 'WICKET_ATTACK') {
        recommendedTactic = 'OUTSWING';
        plan = 'OUTSWING_ATTACK';
        description = 'Channel of uncertainty outside off inviting the drive';
      } else if (boundaryPressureDetected) {
        recommendedTactic = 'BOUNCER';
        plan = 'BOUNCER_SURPRISE';
        fieldAdjustment = 'COVER_PROTECTION';
        description = 'Aggressive short pitch ball into the ribcage to break rhythm';
      } else {
        recommendedTactic = 'INSWING';
        plan = 'INSWING_STUMPS';
        description = 'Full and swinging in towards the pads';
      }
    }

    return {
      mode,
      recommendedTactic,
      plan,
      boundaryPressureDetected,
      fieldAdjustment,
      targetLineLengthDescription: description,
    };
  }
}

export const bowlerStrategyEngine = new BowlerStrategyEngine();
