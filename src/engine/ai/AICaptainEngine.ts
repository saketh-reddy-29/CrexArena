import { Player } from '../../types/common';
import { PitchType } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';
import { BowlerFieldStrategyEngine, FieldConfiguration } from '../strategy/BowlerFieldStrategyEngine';
import { getFieldingPhase } from '../fielding/FieldingRestrictionEngine';
import { BowlingPlanEngine, DetailedBowlingPlan } from './BowlingPlanEngine';
import { BattingIntent, BatterDecisionEngine } from './BatterDecisionEngine';

export type CaptainActionType =
  | 'KEEP_BOWLER'
  | 'CHANGE_BOWLER'
  | 'CHANGE_FIELD'
  | 'CHANGE_BOWLING_PLAN'
  | 'CHANGE_BATTING_INTENT'
  | 'NO_CHANGE';

export interface AICaptainInput {
  format: ArenaFormat;
  teamId: string;
  inningsState: {
    score: number;
    wickets: number;
    balls: number;
    target?: number;
    partnershipRuns?: number;
    partnershipBalls?: number;
    recentBalls?: string[];
  };
  matchSituation?: any;
  availableBowlers: Player[];
  currentBowler?: Player | null;
  previousOverBowlerId?: string | null;
  striker?: Player | null;
  nonStriker?: Player | null;
  bowlingHistory?: Record<string, { balls: number; runs: number; wickets: number }>;
  battingHistory?: Record<string, { balls: number; runs: number; dots: number }>;
  currentField?: FieldConfiguration | null;
  scoringZones?: Array<{ zone: string; runsScored: number }>;
  pitchState?: { pitchType: PitchType };
  ballCondition?: { ageOvers: number; condition: number };
  playerForm?: Record<string, number>;
  userControlMode?: 'MANUAL' | 'AI_RECOMMENDATIONS' | 'FULL_AUTO';
  decisionTrigger?: 'OVER_END' | 'WICKET_FALL' | 'BOUNDARY_CLUSTER' | 'PARTNERSHIP_BREAK' | 'MANUAL_REQUEST';
}

export interface CaptainDecision {
  actionType: CaptainActionType;
  selectedBowlerId?: string;
  selectedBowlerName?: string;
  bowlingPlan?: {
    line: string;
    length: string;
    variation: string;
    intent: string;
    planType?: string;
    summary?: string;
  };
  fieldConfiguration?: FieldConfiguration;
  fieldPresetKey?: string;
  battingIntent?: BattingIntent;
  observation: string;
  tradeOff?: string;
  reasoning: string;
  confidence: number; // 0 - 100
}

export class AICaptainEngine {
  /**
   * Evaluates the match state and returns an authoritative, explainable tactical captain decision.
   */
  public static decideCaptainAction(input: AICaptainInput): CaptainDecision {
    const {
      format,
      inningsState,
      availableBowlers,
      currentBowler,
      previousOverBowlerId,
      striker,
      nonStriker,
      currentField,
      pitchState,
      decisionTrigger,
    } = input;

    const overs = Math.floor(inningsState.balls / 6);
    const ballInOver = inningsState.balls % 6;
    const isOverEnd = ballInOver === 0 && inningsState.balls > 0;
    const isWicketFall = decisionTrigger === 'WICKET_FALL';
    const pitch = pitchState?.pitchType || PitchType.BALANCED;

    const recentBalls = inningsState.recentBalls || [];
    const last6 = recentBalls.slice(-6);
    const boundariesInLast6 = last6.filter((b) => b === '4' || b === '6').length;
    const isBoundaryCluster = boundariesInLast6 >= 2;

    // Phase boundaries come from the authoritative rules layer (single source of
    // truth shared with the field engine), using the over currently being bowled
    // (0-based completed overs + 1). Never hardcode format windows here.
    const activePhase = getFieldingPhase(format, overs + 1);
    const isDeath = activePhase.key === 'DEATH';
    const isPowerplay = activePhase.key === 'POWERPLAY';
    const isTest = format === 'TEST';

    // ── 1. DECISION POINT: Wicket Fall (Attack New Batter) ──
    if (isWicketFall) {
      const attackPreset = isTest ? 'ATTACKING_PACE' : isPowerplay ? 'ATTACKING_PACE' : 'MIDDLE_SQUEEZE';
      const attackField = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format,
        bowler: currentBowler || null,
        striker: striker || null,
        nonStriker: nonStriker || null,
        overs,
        balls: inningsState.balls,
        wickets: inningsState.wickets,
        runs: inningsState.score,
        target: inningsState.target,
        pitch,
        manualPresetKey: attackPreset,
        previousConfig: currentField,
      });

      return {
        actionType: 'CHANGE_FIELD',
        fieldConfiguration: attackField,
        fieldPresetKey: attackPreset,
        observation: 'A wicket has just fallen. New incoming batter is unsettled at the crease.',
        tradeOff: 'Brings ring catchers close for the early edge, opening outfield boundary spaces.',
        reasoning: `AI CAPTAIN: Bringing in close catchers to exert immediate pressure on the incoming batter.`,
        confidence: 88,
      };
    }

    // ── 2. DECISION POINT: End of Over (Bowler Selection) ──
    if (isOverEnd || decisionTrigger === 'OVER_END') {
      const eligible = availableBowlers.filter((b) => b.id !== previousOverBowlerId && b.id !== currentBowler?.id);
      const chosenBowler = this.selectBestBowler(eligible.length > 0 ? eligible : availableBowlers, input);

      if (chosenBowler && chosenBowler.id !== currentBowler?.id) {
        const plan = BowlingPlanEngine.selectBowlingPlan(chosenBowler, striker || availableBowlers[0], {
          format,
          overs,
          balls: inningsState.balls,
          wickets: inningsState.wickets,
          target: inningsState.target,
          pitch,
        });

        const newField = BowlerFieldStrategyEngine.generateFieldConfiguration({
          format,
          bowler: chosenBowler,
          striker: striker || null,
          nonStriker: nonStriker || null,
          overs,
          balls: inningsState.balls,
          wickets: inningsState.wickets,
          runs: inningsState.score,
          target: inningsState.target,
          pitch,
          weather: pitchState ? (pitchState as any).weather : undefined,
          manualPresetKey: plan.recommendedFieldPreset,
          previousConfig: currentField,
        });

        const isSpinner = this.isSpinner(chosenBowler);
        return {
          actionType: 'CHANGE_BOWLER',
          selectedBowlerId: chosenBowler.id,
          selectedBowlerName: chosenBowler.name,
          bowlingPlan: {
            line: plan.line,
            length: plan.length,
            variation: plan.variation,
            intent: plan.intent,
            planType: plan.planType,
            summary: plan.summary,
          },
          fieldConfiguration: newField,
          fieldPresetKey: plan.recommendedFieldPreset,
          observation: isDeath
            ? 'Entering high-pressure death overs phase requiring specialized execution.'
            : isSpinner
              ? 'Middle overs pitch conditions offering grip and grip-turn for spin.'
              : 'End of over requires fresh bowling change to break batter rhythm.',
          tradeOff: isSpinner
            ? 'Brings attacking turn against the right-hander but requires tight boundary sweeping.'
            : 'Offers genuine pace and stump attack but risks boundary concessions if line is missed.',
          reasoning: `AI CAPTAIN: Bringing on ${chosenBowler.name} to bowl the next over (${plan.summary}).`,
          confidence: Math.round(72 + Math.random() * 14),
        };
      }
    }

    // ── 2. DECISION POINT: Boundary Cluster (Tactical Field Shift) ──
    if (isBoundaryCluster) {
      const presetKey = isDeath ? 'DEATH_YORKER_SHIELD' : 'MIDDLE_SQUEEZE';
      const updatedField = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format,
        bowler: currentBowler || null,
        striker: striker || null,
        nonStriker: nonStriker || null,
        overs,
        balls: inningsState.balls,
        wickets: inningsState.wickets,
        runs: inningsState.score,
        target: inningsState.target,
        pitch,
        manualPresetKey: presetKey,
        previousConfig: currentField,
      });

      return {
        actionType: 'CHANGE_FIELD',
        fieldConfiguration: updatedField,
        fieldPresetKey: presetKey,
        observation: `Batter has struck ${boundariesInLast6} boundaries in the last 6 deliveries.`,
        tradeOff: 'Places deep protection on the boundary rope, protecting boundaries while conceding singles.',
        reasoning: `AI CAPTAIN: Pushing fielders back to the boundary rope to stem the flow of boundaries.`,
        confidence: 84,
      };
    }

    // ── 3. Standard Plan Refresh / Maintain Plan ──
    if (currentBowler && striker) {
      const plan = BowlingPlanEngine.selectBowlingPlan(currentBowler, striker, {
        format,
        overs,
        balls: inningsState.balls,
        wickets: inningsState.wickets,
        target: inningsState.target,
        pitch,
      });

      return {
        actionType: 'KEEP_BOWLER',
        selectedBowlerId: currentBowler.id,
        selectedBowlerName: currentBowler.name,
        bowlingPlan: {
          line: plan.line,
          length: plan.length,
          variation: plan.variation,
          intent: plan.intent,
          planType: plan.planType,
          summary: plan.summary,
        },
        observation: 'Match situation stable; current bowling plan aligns with field layout.',
        tradeOff: 'Maintains disciplined pressure without unnecessary fielder disruption.',
        reasoning: `AI CAPTAIN: Backing ${currentBowler.name} with ${plan.summary}.`,
        confidence: 76,
      };
    }

    return {
      actionType: 'NO_CHANGE',
      observation: 'Field configuration and bowler remain tactically sound.',
      reasoning: 'AI CAPTAIN: Maintaining current field setup.',
      confidence: 70,
    };
  }

  /**
   * Helper: Scores available bowlers to select the tactically optimal choice.
   */
  private static selectBestBowler(candidates: Player[], input: AICaptainInput): Player | undefined {
    if (candidates.length === 0) return undefined;

    const { format, inningsState, bowlingHistory, currentBowler } = input;
    const overs = Math.floor(inningsState.balls / 6);
    const maxOversPerBowler = format === 'TEST' ? 999 : format === 'ODI' ? 10 : 4;
    const activePhase = getFieldingPhase(format, overs + 1);
    const isDeath = activePhase.key === 'DEATH';
    const isPowerplay = activePhase.key === 'POWERPLAY';

    const scored = candidates.map((bowler) => {
      let score = bowler.stats?.bowling ?? (bowler.rating || 75);
      const bowledBalls = bowlingHistory?.[bowler.id]?.balls || 0;
      const bowledOvers = Math.floor(bowledBalls / 6);

      // Strict format quota check
      if (bowledOvers >= maxOversPerBowler) {
        return { bowler, score: -999 };
      }

      const isSpinner = this.isSpinner(bowler);

      // Phase preferences
      if (isDeath) {
        // Death overs: prioritize death bowlers, penalize spinners unless exceptional
        const name = bowler.name.toLowerCase();
        const isDeathSpec = ['bumrah', 'starc', 'rabada', 'shami', 'natarajan', 'pathirana', 'arshdeep', 'ferguson'].some(t => name.includes(t));
        if (isDeathSpec) score += 25;
        if (isSpinner) score -= 18;
      } else if (isPowerplay) {
        // Powerplay: swing and seam pacers
        if (!isSpinner) score += 12;
        else score -= 10;
        score -= bowledOvers * 4;
      } else {
        // Middle overs: spinners & strike rotation stranglers
        if (isSpinner) score += 16;
        score -= bowledOvers * 5;
      }

      return { bowler, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.bowler || candidates[0];
  }

  private static isSpinner(bowler: Player): boolean {
    const style = bowler.bowlingStyle?.toLowerCase() || '';
    const name = bowler.name.toLowerCase();
    return style.includes('spin') || style.includes('leg') || style.includes('off') || style.includes('slow') ||
      ['rashid', 'noor', 'varun', 'chahal', 'kuldeep', 'bishnoi', 'jadeja', 'krunal', 'axar', 'narine', 'ashwin'].some(t => name.includes(t));
  }
}
