import { runRateEngine, RunRateMetrics } from './RunRateEngine';
import { scoreAccelerationEngine, AccelerationDecision } from './ScoreAccelerationEngine';
import { partnershipEngine, PartnershipState } from './PartnershipEngine';
import { battingRiskEngine, BattingRiskMetrics } from './BattingRiskEngine';
import { bowlerStrategyEngine, BowlerStrategyDecision } from './BowlerStrategyEngine';
import { fieldStrategyEngine, DynamicFieldLayout } from './FieldStrategyEngine';

export interface DynamicMatchStrategy {
  format: string;
  overs: number;
  balls: number;
  score: number;
  wickets: number;
  runRateMetrics: RunRateMetrics;
  acceleration: AccelerationDecision;
  partnership: PartnershipState;
  battingRisk: BattingRiskMetrics;
  bowlerStrategy: BowlerStrategyDecision;
  fieldLayout: DynamicFieldLayout;
}

export class CaptainStrategyEngine {
  /**
   * Generates a complete dynamic strategy state for the match
   */
  public evaluateDelivery(
    format: string,
    overs: number,
    balls: number,
    score: number,
    wickets: number,
    maxOvers: number = 20,
    target: number | null = null,
    innings: number = 1,
    batter: any = {},
    bowler: any = {},
    partnershipRuns: number = 0,
    partnershipBalls: number = 0,
    recentBallsRuns: number[] = [],
    boundaryHotspot: 'COVER' | 'MIDWICKET' | 'STRAIGHT' | 'NONE' = 'NONE',
    isDeclarationPush: boolean = false
  ): DynamicMatchStrategy {
    // 1. Run Rate Metrics
    const runRateMetrics = runRateEngine.calculate(
      format,
      overs,
      balls,
      score,
      wickets,
      maxOvers,
      target,
      innings
    );

    // 2. Batter Settledness
    const ballsFaced = batter.ballsFaced || 0;
    const settledness = Math.min(100, ballsFaced * (format.toUpperCase() === 'TEST' ? 3.0 : 6.0));

    // 3. Score Acceleration State
    const acceleration = scoreAccelerationEngine.evaluate(
      format,
      overs,
      wickets,
      runRateMetrics,
      settledness,
      isDeclarationPush
    );

    // 4. Partnership Analysis
    const partnership = partnershipEngine.evaluate(partnershipRuns, partnershipBalls, format);

    // 5. Batting Risk & Reward
    const battingRisk = battingRiskEngine.calculateRisk(
      format,
      overs,
      wickets,
      acceleration.state,
      settledness,
      batter.form || 100,
      bowler.bowlingRating || bowler.rating || 50,
      runRateMetrics.requiredRunRate
    );

    // 6. Bowler Strategy & Tactics
    const bowlerStrategy = bowlerStrategyEngine.evaluate(
      format,
      overs,
      wickets,
      bowler.bowlingStyle || 'Fast',
      recentBallsRuns,
      ballsFaced <= 5,
      partnershipRuns
    );

    // 7. Field Layout & 3D Coordinates
    const isSpinner = (bowler.bowlingStyle || '').toLowerCase().includes('spin');
    const fieldLayout = fieldStrategyEngine.evaluate(
      format,
      overs,
      wickets,
      runRateMetrics.currentRunRate,
      runRateMetrics.requiredRunRate,
      isSpinner,
      boundaryHotspot,
      partnershipRuns
    );

    return {
      format,
      overs,
      balls,
      score,
      wickets,
      runRateMetrics,
      acceleration,
      partnership,
      battingRisk,
      bowlerStrategy,
      fieldLayout,
    };
  }
}

export const captainStrategyEngine = new CaptainStrategyEngine();
