import { Player } from '../../../types/common';
import { ScoringZoneName } from '../../scoring/ScoringZones';
import {
  ODIDeliveryRecord,
  ODIPhase,
  ODIBattingStrategy,
  ODIBowlingStrategy,
  ODIDeliveryLength,
  ODIDeliveryLine,
  ODIShotType,
  ODIWicketType,
  ODIInningsData,
  ODIMatchSummary,
  ODIBatterScorecardLine,
  ODIBowlerScorecardLine,
  ODIFallOfWicket,
  ODIPartnership,
} from './ODIDeliveryModel';
import { wicketPreservationEngine } from './WicketPreservationEngine';
import { safeNumber, safeRating, safeProbability } from '../../utils/safeMath';
import { Action3DSequence, adaptDeliveryTo3DSequence } from '../../../components/Delivery3DActionAdapter';
import { isEligibleBowler, getValidBowlingPool, canBowlerBowlAnotherOver, clampProbability } from '../../rules/bowlerEligibility';

export type ODIPlaybackSpeed = 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export interface ODIPlaybackCallbacks {
  onStateUpdate?: (summary: ODIMatchSummary) => void;
  onDeliveryStart?: (record: ODIDeliveryRecord, seq: Action3DSequence) => void;
  onDeliveryStep?: (step: string, subtext: string) => void;
  onDeliveryComplete?: (record: ODIDeliveryRecord) => void;
  onOverComplete?: (overNumber: number, summary: string) => void;
  onPhaseChange?: (phase: ODIPhase, description: string) => void;
  onFieldChange?: (bowlerName: string, strategy: string, plan: string, changes: string[]) => void;
  onMilestone?: (title: string, subtitle: string, badge?: string) => void;
  onInningsComplete?: (inningsIndex: number, inningsSummary: ODIInningsData) => void;
  onMatchComplete?: (result: string, description: string) => void;
}

export class ODIMatchPlaybackController {
  private matchId: string;
  private currentInningsIndex: 0 | 1 = 0; // 0 = 1st Innings, 1 = 2nd Innings

  private team1: { id: string; name: string; shortName: string; squad: Player[] };
  private team2: { id: string; name: string; shortName: string; squad: Player[] };

  private innings: [ODIInningsData, ODIInningsData];
  private strikerId: string | null = null;
  private nonStrikerId: string | null = null;
  private bowlerId: string | null = null;
  private lastOverBowlerId: string | null = null;
  private currentBattingCursor: number = 2; // Next incoming batter

  private currentFieldPreset: string = 'POWERPLAY';
  private currentFieldPlan: string = 'ATTACKING RING (2 OUTSIDE)';
  private isPaused: boolean = false;
  private isSimulating: boolean = false;
  private isFastSimulating: boolean = false;
  private speed: ODIPlaybackSpeed = 1.0;

  private callbacks: ODIPlaybackCallbacks = {};
  private activeDeliverySequence: Action3DSequence | null = null;
  private lastExecutedDelivery: ODIDeliveryRecord | null = null;
  private matchResult: 'IN_PROGRESS' | 'TEAM_1_WIN' | 'TEAM_2_WIN' | 'TIE' | 'NO_RESULT' = 'IN_PROGRESS';
  private resultDescription: string = '';

  constructor(
    matchId: string,
    team1: { id: string; name: string; shortName: string; squad: Player[] },
    team2: { id: string; name: string; shortName: string; squad: Player[] },
    battingFirstTeamId: string,
    callbacks?: ODIPlaybackCallbacks
  ) {
    this.matchId = matchId;
    this.team1 = team1;
    this.team2 = team2;
    if (callbacks) this.callbacks = callbacks;

    const batTeam = battingFirstTeamId === team1.id ? team1 : team2;
    const bowlTeam = batTeam.id === team1.id ? team2 : team1;

    this.innings = [
      this.createEmptyInnings(1, batTeam.id, bowlTeam.id, batTeam.name, bowlTeam.name),
      this.createEmptyInnings(2, bowlTeam.id, batTeam.id, bowlTeam.name, batTeam.name),
    ];

    this.setupInningsParticipants(0);
  }

  public setCallbacks(callbacks: ODIPlaybackCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setSpeed(speed: ODIPlaybackSpeed): void {
    this.speed = speed;
  }

  public getSpeed(): ODIPlaybackSpeed {
    return this.speed;
  }

  public setFastSimulating(isFast: boolean): void {
    this.isFastSimulating = isFast;
  }

  public isFastSim(): boolean {
    return this.isFastSimulating;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.runPlaybackLoop();
    }
  }

  public isMatchFinished(): boolean {
    return this.matchResult !== 'IN_PROGRESS';
  }

  public getCurrentSequence(): Action3DSequence | null {
    return this.activeDeliverySequence;
  }

  public getLastDelivery(): ODIDeliveryRecord | null {
    return this.lastExecutedDelivery;
  }

  private createEmptyInnings(
    num: 1 | 2,
    batId: string,
    bowlId: string,
    batName: string,
    bowlName: string
  ): ODIInningsData {
    return {
      inningsNumber: num,
      battingTeamId: batId,
      bowlingTeamId: bowlId,
      battingTeamName: batName,
      bowlingTeamName: bowlName,
      score: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      legalBalls: 0,
      maxOvers: 50,
      maxBalls: 300,
      isAllOut: false,
      isCompleted: false,
      statusText: num === 1 ? '1st Innings (50 Overs)' : '2nd Innings (Target Chase)',
      batters: {},
      bowlers: {},
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      fallOfWickets: [],
      partnerships: [],
      deliveries: [],
    };
  }

  private setupInningsParticipants(inningsIdx: 0 | 1): void {
    const currentInning = this.innings[inningsIdx];
    const battingSquad = this.getSquad(currentInning.battingTeamId);
    const bowlingSquad = this.getSquad(currentInning.bowlingTeamId);

    // Openers
    this.strikerId = battingSquad[0]?.id || null;
    this.nonStrikerId = battingSquad[1]?.id || null;
    this.currentBattingCursor = 2;

    // Batters setup
    battingSquad.forEach((p) => {
      if (!currentInning.batters[p.id]) {
        currentInning.batters[p.id] = {
          id: p.id,
          name: p.name,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          out: false,
          dismissalInfo: 'not out',
          intent: 'BUILDING',
          scoringZonesMap: {},
        };
      }
    });

    // Opening bowler (strictly eligible bowlers only, prioritizing pace)
    const bowlingPool = getValidBowlingPool(bowlingSquad, 2);
    const pacer = bowlingPool.find((p) => !p.bowlingStyle?.toLowerCase().includes('spin')) || bowlingPool[0];
    this.bowlerId = pacer?.id || null;
    this.lastOverBowlerId = null;

    // Bowlers setup
    bowlingSquad.forEach((p) => {
      if (!currentInning.bowlers[p.id]) {
        currentInning.bowlers[p.id] = {
          id: p.id,
          name: p.name,
          overs: 0,
          balls: 0,
          maidens: 0,
          runs: 0,
          wickets: 0,
          economy: 0,
          dots: 0,
          boundaries: 0,
          currentSpellOvers: 0,
        };
      }
    });

    // Initial Partnership
    if (this.strikerId && this.nonStrikerId) {
      const s = battingSquad.find((p) => p.id === this.strikerId);
      const ns = battingSquad.find((p) => p.id === this.nonStrikerId);
      currentInning.partnerships.push({
        batter1Id: s?.id || '',
        batter1Name: s?.name || '',
        batter2Id: ns?.id || '',
        batter2Name: ns?.name || '',
        runs: 0,
        balls: 0,
        wicketNumber: 1,
        active: true,
      });
    }

    this.currentFieldPreset = 'POWERPLAY';
    this.currentFieldPlan = 'ATTACKING RING (2 OUTSIDE)';
  }

  private getSquad(teamId: string): Player[] {
    const team = teamId === this.team1.id ? this.team1 : this.team2;
    return team.squad.slice(0, 11);
  }

  public getPhase(overs: number): ODIPhase {
    if (overs < 10) return 'POWERPLAY';
    if (overs < 40) return 'MIDDLE_OVERS';
    return 'DEATH_OVERS';
  }

  /**
   * Main asynchronous continuous ODI match loop
   */
  public async startContinuousMatch(): Promise<void> {
    if (this.isSimulating) return;
    this.isSimulating = true;
    this.isPaused = false;
    await this.runPlaybackLoop();
  }

  private async runPlaybackLoop(): Promise<void> {
    while (!this.isMatchFinished() && !this.isPaused) {
      const currentInning = this.innings[this.currentInningsIndex];
      if (currentInning.isCompleted) {
        await this.handleInningsTransition();
        if (this.isMatchFinished()) break;
        continue;
      }

      await this.prepareDelivery();
      await this.prepareField();
      await this.prepareBowler();
      await this.prepareBatters();

      const delivery = this.simulateDelivery();
      await this.playDelivery(delivery);
      await this.applyResult(delivery);
      await this.updateScorecard();
      await this.processCelebration(delivery);
      await this.processMilestones(delivery);

      await this.checkInningsState();
      await this.prepareNextDelivery();
    }
  }

  /**
   * Plays a single delivery on demand (e.g. Next Ball button)
   */
  public async playNextBallManual(): Promise<ODIDeliveryRecord | null> {
    if (this.isMatchFinished()) return null;

    const currentInning = this.innings[this.currentInningsIndex];
    if (currentInning.isCompleted) {
      await this.handleInningsTransition();
      if (this.isMatchFinished()) return null;
    }

    await this.prepareDelivery();
    await this.prepareField();
    await this.prepareBowler();
    await this.prepareBatters();

    const delivery = this.simulateDelivery();
    await this.playDelivery(delivery);
    await this.applyResult(delivery);
    await this.updateScorecard();
    await this.processCelebration(delivery);
    await this.processMilestones(delivery);

    await this.checkInningsState();
    await this.prepareNextDelivery();

    return delivery;
  }

  private async prepareDelivery(): Promise<void> {
    this.callbacks.onDeliveryStep?.('FIELD_SETUP', 'Setting field cordon for ODI phase');
    if (!this.isFastSimulating) {
      await this.delay(100 / this.speed);
    }
  }

  private async prepareField(): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];
    const over = Math.floor(currentInning.legalBalls / 6);
    const phase = this.getPhase(over);
    const bowler = this.getSquad(currentInning.bowlingTeamId).find((p) => p.id === this.bowlerId);
    const isSpinner = bowler?.bowlingStyle?.toLowerCase().includes('spin') || false;

    let preset = 'POWERPLAY';
    let plan = 'ATTACKING RING (2 OUTSIDE)';
    let changes: string[] = ['Slip → In Place', 'Gully → Added', 'Deep Cover → 30yd Ring'];

    if (phase === 'MIDDLE_OVERS') {
      preset = isSpinner ? 'SPIN_TRAP' : 'BALANCED';
      plan = isSpinner ? 'SPIN PRESSURE & 4 DEEP' : 'MIDDLE ACCUMULATION CONTROL (4 DEEP)';
      changes = ['Deep Cover → Boundary Protect', 'Long On → Deep', 'Slip → 30yd Ring'];
    } else if (phase === 'DEATH_OVERS') {
      preset = 'DEATH_OVERS';
      plan = 'DEATH BOUNDARY LOCKDOWN (5 DEEP)';
      changes = ['Deep Point → Added', 'Deep Mid-Wicket → Boundary', 'Long Off → Deep'];
    }

    if (this.currentFieldPreset !== preset) {
      this.currentFieldPreset = preset;
      this.currentFieldPlan = plan;
      this.callbacks.onFieldChange?.(bowler?.name || 'Bowler', phase, plan, changes);
    }
  }

  private async prepareBowler(): Promise<void> {
    this.callbacks.onDeliveryStep?.('BOWLER_READY', 'Bowler ready at top of mark');
    if (!this.isFastSimulating) {
      await this.delay(80 / this.speed);
    }
  }

  private async prepareBatters(): Promise<void> {
    this.callbacks.onDeliveryStep?.('BATTER_READY', 'Striker taking guard');
    if (!this.isFastSimulating) {
      await this.delay(80 / this.speed);
    }
  }

  /**
   * Generates authoritative ODI Delivery Result
   */
  public simulateDelivery(): ODIDeliveryRecord {
    const currentInning = this.innings[this.currentInningsIndex];
    const battingSquad = this.getSquad(currentInning.battingTeamId);
    const bowlingSquad = this.getSquad(currentInning.bowlingTeamId);

    const striker = battingSquad.find((p) => p.id === this.strikerId) || battingSquad[0];
    const nonStriker = battingSquad.find((p) => p.id === this.nonStrikerId) || battingSquad[1];
    
    const bowlingPool = getValidBowlingPool(bowlingSquad, 1);
    let bowler = bowlingSquad.find((p) => p.id === this.bowlerId);
    if (!bowler || !isEligibleBowler(bowler)) {
      bowler = bowlingPool[0];
      this.bowlerId = bowler?.id || null;
    }
    if (!bowler) {
      bowler = bowlingSquad[0];
    }

    const overNum = Math.floor(currentInning.legalBalls / 6);
    const ballInOver = (currentInning.legalBalls % 6) + 1;
    const deliveryId = `ODI_INNINGS_${this.currentInningsIndex + 1}_OVER_${overNum}_BALL_${ballInOver}`;
    const ballDisplay = `${overNum}.${ballInOver}`;
    const phase = this.getPhase(overNum);

    const isSpinner = bowler.bowlingStyle?.toLowerCase().includes('spin') || false;
    const strikerLine = currentInning.batters[striker.id];
    const ballsFaced = strikerLine?.balls || 0;
    
    // Settledness curve (Phase 10 & 11)
    let settledness = 0;
    if (ballsFaced <= 5) settledness = ballsFaced * 4.0;
    else if (ballsFaced <= 15) settledness = 20 + (ballsFaced - 5) * 3.5;
    else if (ballsFaced <= 30) settledness = 55 + (ballsFaced - 15) * 2.0;
    else settledness = Math.min(100, 85 + (ballsFaced - 30) * 0.5);

    const activePship = currentInning.partnerships.find((p) => p.active);
    const target = this.getTarget();
    const runsRequired = target ? Math.max(0, target - currentInning.score) : null;
    const ballsRemaining = Math.max(0, 300 - currentInning.legalBalls);
    const oversRemaining = ballsRemaining / 6;
    const requiredRate = target && ballsRemaining > 0 ? (runsRequired! / (ballsRemaining / 6)) : null;
    const currentRunRate = currentInning.legalBalls > 0 ? (currentInning.score / (currentInning.legalBalls / 6)) : 0;

    // 1. Evaluate Wicket Preservation & Intent via WicketPreservationEngine
    const decision = wicketPreservationEngine.evaluate({
      wicketsLost: currentInning.wickets,
      wicketsRemaining: 10 - currentInning.wickets,
      oversRemaining,
      ballsRemaining,
      target,
      runsRequired,
      requiredRate,
      currentRunRate,
      phase,
      batterBallsFaced: ballsFaced,
      batterSettledness: settledness,
      partnershipRuns: activePship?.runs || 0,
      partnershipBalls: activePship?.balls || 0,
    });

    const intent = decision.intent;

    // 2. Determine Length & Line based on Phase & Bowler Style
    let lengths: ODIDeliveryLength[] = ['GOOD_LENGTH', 'GOOD_LENGTH', 'FULL', 'SHORT'];
    let lines: ODIDeliveryLine[] = ['OUTSIDE_OFF', 'ON_STUMPS', 'INSWING', 'OUTSWING'];

    if (phase === 'DEATH_OVERS') {
      lengths = ['YORKER', 'YORKER', 'WIDE_OUTSIDE_OFF' as any, 'SLOWER_BALL', 'SHORT', 'GOOD_LENGTH'];
      lines = ['WIDE_OUTSIDE_OFF', 'ON_STUMPS', 'OUTSIDE_OFF'];
    } else if (isSpinner) {
      lengths = ['GOOD_LENGTH', 'FULL', 'GOOD_LENGTH', 'SHORT'];
      lines = ['OFF_BREAK', 'LEG_BREAK', 'OUTSIDE_OFF', 'ON_STUMPS'];
    }

    const chosenLength = (lengths[Math.floor(Math.random() * lengths.length)] || 'GOOD_LENGTH') as ODIDeliveryLength;
    const chosenLine = (lines[Math.floor(Math.random() * lines.length)] || 'OUTSIDE_OFF') as ODIDeliveryLine;

    // 3. Wicket Probability (calibrated to realistic 50-over ODI: ~2.4% - 2.8% per ball)
    const bowlerRating = safeNumber(bowler.bowlingRating || bowler.rating, 75);
    const batterRating = safeNumber(striker.technique || striker.rating, 75);

    const baseRisk = 0.024 * decision.wicketRiskMultiplier;
    const skillDiff = (bowlerRating - batterRating) * 0.00012;
    const settlednessBonus = (settledness / 100) * 0.008;

    const baseWicketProb = baseRisk + skillDiff - settlednessBonus;
    const wicketProb = clampProbability(Math.max(0.008, Math.min(0.055, baseWicketProb)));

    // Exactly ONE wicket roll per legal delivery
    const isWicket = Math.random() < wicketProb;
    let wicketType: ODIWicketType | null = null;
    let dismissalFielder: string | null = null;
    let runs = 0;
    let result: 'DOT' | 'SINGLE' | 'TWO' | 'THREE' | 'FOUR' | 'SIX' | 'WICKET' = 'DOT';
    let shot: ODIShotType = 'FORWARD_DEFENCE';
    let targetZone: ScoringZoneName = 'COVER';

    if (isWicket) {
      result = 'WICKET';
      if (chosenLength === 'YORKER' || (chosenLine === 'ON_STUMPS' && Math.random() > 0.65)) {
        wicketType = 'BOWLED';
        shot = chosenLength === 'YORKER' ? 'DIG_OUT_YORKER' : 'FORWARD_DEFENCE';
        targetZone = 'PITCH';
      } else if (chosenLine === 'ON_STUMPS' || chosenLine === 'LEG_STUMP') {
        wicketType = 'LBW';
        shot = 'FORWARD_DEFENCE';
        targetZone = 'PITCH';
      } else if (chosenLine === 'OUTSIDE_OFF' || chosenLine === 'OUTSWING') {
        wicketType = Math.random() > 0.4 ? 'CAUGHT_BEHIND' : 'CAUGHT';
        dismissalFielder = wicketType === 'CAUGHT_BEHIND' ? 'Wicketkeeper' : 'Point';
        shot = 'EDGE';
        targetZone = wicketType === 'CAUGHT_BEHIND' ? 'WICKET_KEEPER' : 'POINT';
      } else if (isSpinner && chosenLength === 'FULL' && Math.random() > 0.6) {
        wicketType = 'STUMPED';
        dismissalFielder = 'Wicketkeeper';
        shot = 'FORWARD_DEFENCE';
        targetZone = 'WICKET_KEEPER';
      } else {
        wicketType = 'CAUGHT';
        const catchers = ['Long-Off', 'Long-On', 'Deep Mid-Wicket', 'Deep Cover', 'Cover', 'Mid-Wicket'];
        dismissalFielder = catchers[Math.floor(Math.random() * catchers.length)];
        shot = 'LOFTED_SIX';
        targetZone = dismissalFielder.toUpperCase().replace('-', '_') as ScoringZoneName;
      }
    } else {
      // Run Outcome selection from decision weights
      const totalWeight = decision.dotWeight + decision.singleWeight + decision.twoWeight + decision.fourWeight + decision.sixWeight;
      let roll = Math.random() * totalWeight;

      if (roll < decision.dotWeight) {
        runs = 0;
        result = 'DOT';
        if (chosenLine === 'WIDE_OUTSIDE_OFF' || (chosenLine === 'OUTSIDE_OFF' && chosenLength === 'GOOD_LENGTH' && phase === 'POWERPLAY')) {
          shot = 'LEAVE';
          targetZone = 'WICKET_KEEPER';
        } else if (chosenLength === 'SHORT') {
          shot = 'BACKFOOT_DEFENCE';
          targetZone = 'POINT';
        } else if (chosenLength === 'YORKER') {
          shot = 'DIG_OUT_YORKER';
          targetZone = 'PITCH';
        } else {
          shot = 'FORWARD_DEFENCE';
          targetZone = 'COVER';
        }
      } else if (roll < decision.dotWeight + decision.singleWeight) {
        runs = 1;
        result = 'SINGLE';
        shot = chosenLine === 'LEG_STUMP' ? 'FLICK' : chosenLine === 'OUTSIDE_OFF' ? 'SQUARE_CUT' : 'STRAIGHT_DRIVE';
        targetZone = chosenLine === 'LEG_STUMP' ? 'SQUARE_LEG' : chosenLine === 'OUTSIDE_OFF' ? 'POINT' : 'MID_OFF';
      } else if (roll < decision.dotWeight + decision.singleWeight + decision.twoWeight) {
        runs = 2;
        result = 'TWO';
        shot = chosenLength === 'SHORT' ? 'PULL_SHOT' : 'COVER_DRIVE';
        targetZone = chosenLength === 'SHORT' ? 'DEEP_MIDWICKET' : 'DEEP_COVER';
      } else if (roll < decision.dotWeight + decision.singleWeight + decision.twoWeight + decision.fourWeight) {
        runs = 4;
        result = 'FOUR';
        shot = chosenLine === 'OUTSIDE_OFF' ? 'COVER_DRIVE' : chosenLength === 'SHORT' ? 'PULL_SHOT' : 'STRAIGHT_DRIVE';
        targetZone = chosenLine === 'OUTSIDE_OFF' ? 'EXTRA_COVER' : chosenLength === 'SHORT' ? 'DEEP_SQUARE_LEG' : 'LONG_OFF';
      } else {
        runs = 6;
        result = 'SIX';
        shot = 'LOFTED_SIX';
        targetZone = 'LONG_ON';
      }
    }

    // 4. Trajectory coordinates calculation
    const bounceZ = chosenLength === 'YORKER' ? 8.6 : chosenLength === 'FULL' ? 6.8 : chosenLength === 'SHORT' ? 0.5 : 4.2;
    const bounceX = chosenLine === 'OUTSIDE_OFF' || chosenLine === 'WIDE_OUTSIDE_OFF' ? 0.45 : chosenLine === 'LEG_STUMP' ? -0.4 : 0.15;
    const apexHeight = chosenLength === 'SHORT' ? 1.4 : chosenLength === 'YORKER' ? 0.2 : 0.85;

    let targetX = 14;
    let targetZ = 12;
    let shotAngleDeg = -45;

    if (shot === 'COVER_DRIVE') { shotAngleDeg = -55; targetX = -28; targetZ = 5; }
    else if (shot === 'SQUARE_CUT' || shot === 'LATE_CUT') { shotAngleDeg = -95; targetX = -24; targetZ = 12; }
    else if (shot === 'STRAIGHT_DRIVE' || shot === 'ON_DRIVE') { shotAngleDeg = 0; targetX = 0; targetZ = -26; }
    else if (shot === 'PULL_SHOT' || shot === 'HOOK_SHOT') { shotAngleDeg = 75; targetX = 26; targetZ = 6; }
    else if (shot === 'FLICK' || shot === 'GLANCE') { shotAngleDeg = 110; targetX = 18; targetZ = 16; }
    else if (shot === 'LEAVE' || shot === 'EDGE') { shotAngleDeg = -120; targetX = -2; targetZ = 14; }
    else if (shot === 'LOFTED_SIX') { shotAngleDeg = 15; targetX = 12; targetZ = -38; }

    const isAerial = runs === 6 || (isWicket && wicketType === 'CAUGHT');

    const trajectory = {
      startPos: { x: -0.8, y: 1.8, z: -18 },
      bouncePos: { x: bounceX, y: 0.04, z: bounceZ },
      contactPos: { x: 0, y: 0.55, z: 9.5 },
      targetPos: { x: targetX, y: 0.08, z: targetZ },
      isAerial,
      apexHeight: runs === 6 ? 12.0 : apexHeight,
      swingFactor: chosenLine === 'OUTSWING' ? -4.5 : chosenLine === 'INSWING' ? 4.5 : 0,
      seamDeviation: chosenLine === 'OFF_BREAK' ? 0.35 : chosenLine === 'LEG_BREAK' ? -0.35 : 0,
      shotAngleDeg,
    };

    const stepMessages = [
      `BOWLER RUN-UP: ${bowler.name}`,
      `BALL RELEASE: ${chosenLength.replace('_', ' ')} ${chosenLine.replace('_', ' ')}`,
      `BALL IN FLIGHT`,
      `BOUNCE: Pitch contact`,
      `BATTER ACTION: ${striker.name} plays ${shot.replace('_', ' ')}`,
      `BALL TO ${targetZone.replace('_', ' ')}`,
      isWicket ? `WICKET: ${wicketType?.replace('_', ' ')}!` : runs >= 4 ? `BOUNDARY: ${runs === 6 ? 'SIX' : 'FOUR'}!` : `FIELDER REACTION: ${runs} run${runs === 1 ? '' : 's'}`,
      `SCORECARD UPDATED`,
    ];

    const commentaryText = isWicket
      ? `WICKET! ${bowler.name} breaks through! ${striker.name} is ${wicketType?.toLowerCase().replace('_', ' ')} for ${strikerLine?.runs || 0} (${strikerLine?.balls || 0}b).`
      : runs === 4
      ? `FOUR! Superb ${shot.toLowerCase().replace('_', ' ')} by ${striker.name}, piercing the field toward ${targetZone.toLowerCase().replace('_', ' ')}.`
      : runs === 6
      ? `SIX! ${striker.name} clears the ropes over ${targetZone.toLowerCase().replace('_', ' ')} with authority!`
      : runs > 0
      ? `${striker.name} places it into the pocket at ${targetZone.toLowerCase().replace('_', ' ')} for ${runs} run${runs > 1 ? 's' : ''}.`
      : `${striker.name} taps defensively into the off-side. Dot ball.`;

    const record: ODIDeliveryRecord = {
      deliveryId,
      matchId: this.matchId,
      inningsId: (this.currentInningsIndex + 1) as 1 | 2,
      over: overNum,
      ball: ballInOver,
      ballDisplay,
      phase,
      striker,
      nonStriker,
      bowler,
      fieldConfiguration: this.currentFieldPreset,
      deliveryType: `${chosenLength} ${chosenLine}`,
      line: chosenLine,
      length: chosenLength,
      intent,
      shot,
      targetZone,
      result,
      runs,
      extras: 0,
      wicket: isWicket,
      wicketType,
      dismissalFielder,
      fielderName: dismissalFielder,
      trajectory,
      timestamp: Date.now(),
      commentaryText,
      stepMessages,
    };

    return record;
  }

  private async playDelivery(delivery: ODIDeliveryRecord): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];
    const strikerLine = currentInning.batters[delivery.striker.id];
    const bowlerLine = currentInning.bowlers[delivery.bowler.id];
    const activePship = currentInning.partnerships.find((p) => p.active);

    const seq = adaptDeliveryTo3DSequence(
      {
        runs: delivery.runs,
        isWicket: delivery.wicket,
        wicketType: delivery.wicketType || undefined,
        isExtra: false,
        bowlingTactic: delivery.line === 'INSWING' ? 'INSWING' : delivery.line === 'OFF_BREAK' ? 'OFF_BREAK' : 'OUTSWING',
      } as any,
      'OUTSWING',
      {
        strikerScore: (strikerLine?.runs || 0) + delivery.runs,
        strikerName: delivery.striker.name,
        bowlerWickets: (bowlerLine?.wickets || 0) + (delivery.wicket ? 1 : 0),
        bowlerName: delivery.bowler.name,
        partnershipRuns: (activePship?.runs || 0) + delivery.runs,
        partnershipBalls: (activePship?.balls || 0) + 1,
        target: this.getTarget(),
        currentScore: currentInning.score + delivery.runs,
        isTestFormat: false,
        targetPos: delivery.trajectory.targetPos,
        shotName: delivery.shot,
      }
    );

    this.activeDeliverySequence = seq;
    this.lastExecutedDelivery = delivery;

    this.callbacks.onDeliveryStart?.(delivery, seq);

    if (!this.isFastSimulating) {
      const stepDuration = (seq.baseDurationMs / seq.stepMessages?.length || 7) / this.speed;
      for (let i = 0; i < delivery.stepMessages.length; i++) {
        this.callbacks.onDeliveryStep?.(
          i === 0 ? 'BOWLER_RUNUP' : i === 1 ? 'BALL_FLIGHT' : i === 2 ? 'BOUNCE' : i === 3 ? 'CONTACT' : i === 4 ? 'BALL_TRAVEL' : 'RESULT',
          delivery.stepMessages[i]
        );
        await this.delay(stepDuration);
        if (this.isPaused) break;
      }
    }
  }

  private async applyResult(delivery: ODIDeliveryRecord): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];

    // 1. Batter stats
    const strikerLine = currentInning.batters[delivery.striker.id];
    if (strikerLine) {
      strikerLine.runs += delivery.runs;
      strikerLine.balls += 1;
      if (delivery.runs === 4) strikerLine.fours += 1;
      if (delivery.runs === 6) strikerLine.sixes += 1;
      strikerLine.strikeRate = strikerLine.balls > 0 ? (strikerLine.runs / strikerLine.balls) * 100 : 0;
      strikerLine.scoringZonesMap[delivery.targetZone] = (strikerLine.scoringZonesMap[delivery.targetZone] || 0) + delivery.runs;

      if (delivery.wicket) {
        strikerLine.out = true;
        strikerLine.dismissalInfo = delivery.wicketType === 'CAUGHT'
          ? `c ${delivery.dismissalFielder} b ${delivery.bowler.name}`
          : delivery.wicketType === 'CAUGHT_BEHIND'
          ? `c †Wicketkeeper b ${delivery.bowler.name}`
          : delivery.wicketType === 'LBW'
          ? `lbw b ${delivery.bowler.name}`
          : delivery.wicketType === 'BOWLED'
          ? `b ${delivery.bowler.name}`
          : `st †Wicketkeeper b ${delivery.bowler.name}`;
      }
    }

    // 2. Bowler stats
    const bowlerLine = currentInning.bowlers[delivery.bowler.id];
    if (bowlerLine) {
      bowlerLine.runs += delivery.runs;
      bowlerLine.balls += 1;
      if (delivery.wicket && delivery.wicketType !== 'RUN_OUT') {
        bowlerLine.wickets += 1;
      }
      if (delivery.runs === 0) bowlerLine.dots += 1;
      if (delivery.runs >= 4) bowlerLine.boundaries += 1;

      const completeOvers = Math.floor(bowlerLine.balls / 6);
      const remBalls = bowlerLine.balls % 6;
      bowlerLine.overs = Number(`${completeOvers}.${remBalls}`);
      const ovFrac = completeOvers + remBalls / 6;
      bowlerLine.economy = ovFrac > 0 ? bowlerLine.runs / ovFrac : 0;
    }

    // 3. Innings totals
    currentInning.score += delivery.runs;
    currentInning.legalBalls += 1;
    currentInning.balls = currentInning.legalBalls % 6;
    currentInning.overs = Math.floor(currentInning.legalBalls / 6);

    // 4. Partnership
    const activePship = currentInning.partnerships.find((p) => p.active);
    if (activePship) {
      activePship.runs += delivery.runs;
      activePship.balls += 1;
    }

    // 5. Fall of Wicket
    if (delivery.wicket) {
      currentInning.wickets += 1;
      const fow: ODIFallOfWicket = {
        wicketNumber: currentInning.wickets,
        score: currentInning.score,
        over: delivery.ballDisplay,
        batterId: delivery.striker.id,
        batterName: delivery.striker.name,
        bowlerId: delivery.bowler.id,
        bowlerName: delivery.bowler.name,
        dismissal: strikerLine?.dismissalInfo || 'Out',
      };
      currentInning.fallOfWickets.push(fow);

      if (activePship) {
        activePship.active = false;
      }

      if (currentInning.wickets < 10) {
        const battingSquad = this.getSquad(currentInning.battingTeamId);
        const nextBatter = battingSquad[this.currentBattingCursor];
        this.currentBattingCursor += 1;
        this.strikerId = nextBatter?.id || null;

        if (this.strikerId && this.nonStrikerId) {
          const s = battingSquad.find((p) => p.id === this.strikerId);
          const ns = battingSquad.find((p) => p.id === this.nonStrikerId);
          currentInning.partnerships.push({
            batter1Id: s?.id || '',
            batter1Name: s?.name || '',
            batter2Id: ns?.id || '',
            batter2Name: ns?.name || '',
            runs: 0,
            balls: 0,
            wicketNumber: currentInning.wickets + 1,
            active: true,
          });
        }
      }
    }

    // 6. Strike rotation
    if (delivery.runs % 2 === 1 && !delivery.wicket) {
      const tmp = this.strikerId;
      this.strikerId = this.nonStrikerId;
      this.nonStrikerId = tmp;
    }

    // Persist
    currentInning.deliveries.push(delivery);
    this.callbacks.onDeliveryComplete?.(delivery);
  }

  private async updateScorecard(): Promise<void> {
    this.callbacks.onStateUpdate?.(this.getSummary());
  }

  private async processCelebration(delivery: ODIDeliveryRecord): Promise<void> {
    if (this.isFastSimulating) return;

    if (delivery.wicket) {
      this.callbacks.onMilestone?.('WICKET!', `${delivery.bowler.name} claims the wicket of ${delivery.striker.name}!`, 'WICKET');
    }
  }

  private async processMilestones(delivery: ODIDeliveryRecord): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];
    const strikerLine = currentInning.batters[delivery.striker.id];
    const bowlerLine = currentInning.bowlers[delivery.bowler.id];
    const activePship = currentInning.partnerships.find((p) => p.active);

    if (strikerLine) {
      const prevRuns = strikerLine.runs - delivery.runs;
      if (prevRuns < 50 && strikerLine.runs >= 50 && strikerLine.runs < 100) {
        this.callbacks.onMilestone?.('ODI HALF CENTURY! 50*', `${strikerLine.name} reaches a brilliant 50!`, 'FIFTY');
      } else if (prevRuns < 100 && strikerLine.runs >= 100 && strikerLine.runs < 150) {
        this.callbacks.onMilestone?.('MAGNIFICENT ODI CENTURY! 100*', `${strikerLine.name} celebrates a sensational 100!`, 'CENTURY');
      }
    }

    if (bowlerLine && bowlerLine.wickets === 5 && delivery.wicket) {
      this.callbacks.onMilestone?.('5-WICKET HAUL!', `${bowlerLine.name} takes 5 wickets in the match!`, '5 WICKETS');
    }

    if (activePship) {
      const prevRuns = activePship.runs - delivery.runs;
      if (prevRuns < 50 && activePship.runs >= 50 && activePship.runs < 100) {
        this.callbacks.onMilestone?.('50 PARTNERSHIP', `50-run stand between ${activePship.batter1Name} & ${activePship.batter2Name}!`, '50 STAND');
      } else if (prevRuns < 100 && activePship.runs >= 100) {
        this.callbacks.onMilestone?.('100 PARTNERSHIP', `Sensational 100-run ODI partnership!`, '100 STAND');
      }
    }

    // Phase transition milestones
    if (currentInning.legalBalls === 60) {
      this.callbacks.onPhaseChange?.('MIDDLE_OVERS', 'POWERPLAY COMPLETE (Overs 1-10) → Moving to Middle Overs');
    } else if (currentInning.legalBalls === 240) {
      this.callbacks.onPhaseChange?.('DEATH_OVERS', 'MIDDLE OVERS COMPLETE (Overs 11-40) → Death Overs Acceleration');
    }
  }

  private async checkInningsState(): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];

    // All out at 10 wickets
    if (currentInning.wickets >= 10) {
      currentInning.isAllOut = true;
      currentInning.isCompleted = true;
      currentInning.statusText = `${currentInning.battingTeamName} All Out (${currentInning.score}/${currentInning.wickets})`;
      this.callbacks.onInningsComplete?.(this.currentInningsIndex, currentInning);
      return;
    }

    // 50 overs complete
    if (currentInning.legalBalls >= 300) {
      currentInning.isCompleted = true;
      currentInning.statusText = `${currentInning.battingTeamName} Innings Complete (${currentInning.score}/${currentInning.wickets})`;
      this.callbacks.onInningsComplete?.(this.currentInningsIndex, currentInning);
      return;
    }

    // 2nd innings chase target reached
    if (this.currentInningsIndex === 1) {
      const target = this.getTarget();
      if (target && currentInning.score >= target) {
        currentInning.isCompleted = true;
        this.determineMatchResult();
        return;
      }
    }
  }

  private async prepareNextDelivery(): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];

    // End of over logic
    if (currentInning.balls === 0 && currentInning.legalBalls > 0) {
      const overNum = Math.floor(currentInning.legalBalls / 6);
      this.callbacks.onOverComplete?.(overNum, `Over ${overNum} complete: ${currentInning.score}/${currentInning.wickets}`);

      // Strike changes
      const tmp = this.strikerId;
      this.strikerId = this.nonStrikerId;
      this.nonStrikerId = tmp;

      // Bowler change with max 10 overs (60 balls) restriction
      this.lastOverBowlerId = this.bowlerId;
      const bowlingSquad = this.getSquad(currentInning.bowlingTeamId);
      const bowlingPool = getValidBowlingPool(bowlingSquad, 2);
      const candidates = bowlingPool.filter((p) => {
        const line = currentInning.bowlers[p.id];
        const overs = Math.floor((line?.balls || 0) / 6);
        return p.id !== this.lastOverBowlerId && canBowlerBowlAnotherOver(p, overs, 'ODI');
      });
      const validPool = candidates.length > 0 ? candidates : bowlingPool.filter((p) => p.id !== this.lastOverBowlerId);
      const nextBowler = validPool[Math.floor(Math.random() * validPool.length)] || validPool[0] || bowlingPool[0];

      if (nextBowler && !isEligibleBowler(nextBowler)) {
        throw new Error(`[CRITICAL] Batter erroneously selected as bowler: ${nextBowler.name}`);
      }
      this.bowlerId = nextBowler?.id || null;
    }
  }

  private async handleInningsTransition(): Promise<void> {
    if (this.currentInningsIndex === 0) {
      this.currentInningsIndex = 1;
      this.setupInningsParticipants(1);
    } else {
      this.determineMatchResult();
    }
  }

  private determineMatchResult(): void {
    const inn1 = this.innings[0];
    const inn2 = this.innings[1];
    const target = inn1.score + 1;

    if (inn2.score >= target) {
      const wicketsRemaining = 10 - inn2.wickets;
      this.matchResult = inn2.battingTeamId === this.team1.id ? 'TEAM_1_WIN' : 'TEAM_2_WIN';
      this.resultDescription = `${inn2.battingTeamName} won by ${wicketsRemaining} wickets!`;
    } else if (inn2.isAllOut || inn2.legalBalls >= 300) {
      if (inn2.score === inn1.score) {
        this.matchResult = 'TIE';
        this.resultDescription = 'Match tied!';
      } else {
        const margin = inn1.score - inn2.score;
        this.matchResult = inn1.battingTeamId === this.team1.id ? 'TEAM_1_WIN' : 'TEAM_2_WIN';
        this.resultDescription = `${inn1.battingTeamName} won by ${margin} runs!`;
      }
    }

    this.callbacks.onMatchComplete?.(this.matchResult, this.resultDescription);
  }

  public getTarget(): number | null {
    if (this.currentInningsIndex === 1) {
      return this.innings[0].score + 1;
    }
    return null;
  }

  public getSummary(): ODIMatchSummary {
    const currentInning = this.innings[this.currentInningsIndex];
    const target = this.getTarget();
    const runsRequired = target ? Math.max(0, target - currentInning.score) : null;
    const ballsRemaining = Math.max(0, 300 - currentInning.legalBalls);
    const oversRemaining = ballsRemaining / 6;
    const requiredRate = target && ballsRemaining > 0 ? (runsRequired! / (ballsRemaining / 6)) : null;
    const currentRunRate = currentInning.legalBalls > 0 ? (currentInning.score / (currentInning.legalBalls / 6)) : 0;
    const projectedScore = currentRunRate * 50;

    const over = Math.floor(currentInning.legalBalls / 6);
    const currentPhase = this.getPhase(over);
    const phaseName = currentPhase === 'POWERPLAY' ? 'Powerplay (Overs 1–10)' : currentPhase === 'MIDDLE_OVERS' ? 'Middle Overs (Overs 11–40)' : 'Death Overs (Overs 41–50)';
    const phaseDescription = currentPhase === 'POWERPLAY' ? 'Controlled Aggression & 2 Fielders Outside' : currentPhase === 'MIDDLE_OVERS' ? 'Strike Rotation & Wicket Preservation (4 Outside)' : 'Boundary Attack & Death Execution (5 Outside)';

    return {
      matchId: this.matchId,
      currentInningsIndex: this.currentInningsIndex,
      currentPhase,
      phaseName,
      phaseDescription,
      innings: this.innings,
      strikerId: this.strikerId,
      nonStrikerId: this.nonStrikerId,
      bowlerId: this.bowlerId,
      lastOverBowlerId: this.lastOverBowlerId,
      currentRunRate,
      requiredRunRate: requiredRate,
      target,
      runsRequired,
      ballsRemaining,
      oversRemaining,
      projectedScore,
      fieldPreset: this.currentFieldPreset,
      fieldStrategyPlan: this.currentFieldPlan,
      fieldChanges: ['Deep Cover', 'Long On', 'Mid-Wicket'],
      result: this.matchResult,
      resultDescription: this.resultDescription,
    };
  }

  public getReplayDeliveries(inningsIndex: number): ODIDeliveryRecord[] {
    return this.innings[inningsIndex]?.deliveries || [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
