import { Player } from '../../../types/common';
import { ScoringZoneName } from '../../scoring/ScoringZones';
import {
  TestDeliveryRecord,
  TestDeliveryLength,
  TestDeliveryLine,
  TestShotType,
  TestBattingIntent,
  TestWicketType,
  TestInningsData,
  TestMatchSummary,
  TestBatterScorecardLine,
  TestBowlerScorecardLine,
  TestFallOfWicket,
  TestPartnership,
} from './TestDeliveryModel';
import { testBattingAI } from './testBattingAI';
import { safeNumber, safeRating, safeProbability } from '../../utils/safeMath';
import { fieldStrategyEngine } from '../../strategy/FieldStrategyEngine';
import { Action3DSequence, adaptDeliveryTo3DSequence } from '../../../components/Delivery3DActionAdapter';

export type PlaybackSpeed = 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export interface TestPlaybackCallbacks {
  onStateUpdate?: (summary: TestMatchSummary) => void;
  onDeliveryStart?: (record: TestDeliveryRecord, seq: Action3DSequence) => void;
  onDeliveryStep?: (step: string, subtext: string) => void;
  onDeliveryComplete?: (record: TestDeliveryRecord) => void;
  onOverComplete?: (overNumber: number, summary: string) => void;
  onFieldChange?: (bowlerName: string, strategy: string, plan: string, changes: string[]) => void;
  onSessionBreak?: (breakType: 'LUNCH' | 'TEA' | 'STUMPS', message: string) => void;
  onMilestone?: (title: string, subtitle: string, badge?: string) => void;
  onInningsComplete?: (inningsIndex: number, inningsSummary: TestInningsData) => void;
  onMatchComplete?: (result: string, description: string) => void;
}

export class TestMatchPlaybackController {
  private matchId: string;
  private day: number = 1;
  private session: 'MORNING' | 'AFTERNOON' | 'EVENING' = 'MORNING';
  private sessionOvers: number = 0;
  private oversToday: number = 0;
  private currentInningsIndex: number = 0; // 0 = 1st, 1 = 2nd, 2 = 3rd, 3 = 4th

  private team1: { id: string; name: string; shortName: string; squad: Player[] };
  private team2: { id: string; name: string; shortName: string; squad: Player[] };

  private innings: TestInningsData[] = [];
  private strikerId: string | null = null;
  private nonStrikerId: string | null = null;
  private bowlerId: string | null = null;
  private lastOverBowlerId: string | null = null;
  private currentBattingCursor: number = 2; // Index of next incoming batter

  private ballAge: number = 0; // in overs
  private oversSinceNewBall: number = 0;
  private newBallAvailable: boolean = false;

  private pitch = {
    pace: 68,
    bounce: 72,
    seam: 55,
    swing: 60,
    spin: 40,
    deterioration: 5,
  };

  private currentFieldPreset: string = 'ATTACKING_TEST';
  private isPaused: boolean = false;
  private isSimulating: boolean = false;
  private isFastSimulating: boolean = false;
  private speed: PlaybackSpeed = 1.0;

  private callbacks: TestPlaybackCallbacks = {};
  private activeDeliverySequence: Action3DSequence | null = null;
  private lastExecutedDelivery: TestDeliveryRecord | null = null;
  private matchResult: 'IN_PROGRESS' | 'TEAM_1_WIN' | 'TEAM_2_WIN' | 'DRAW' | 'TIE' = 'IN_PROGRESS';
  private resultDescription: string = '';

  // Step ticker state for real-time delivery animation
  private currentStepMessage: string = 'READY';

  constructor(
    matchId: string,
    team1: { id: string; name: string; shortName: string; squad: Player[] },
    team2: { id: string; name: string; shortName: string; squad: Player[] },
    battingFirstTeamId: string,
    callbacks?: TestPlaybackCallbacks
  ) {
    this.matchId = matchId;
    this.team1 = team1;
    this.team2 = team2;
    if (callbacks) this.callbacks = callbacks;

    const batTeam = battingFirstTeamId === team1.id ? team1 : team2;
    const bowlTeam = batTeam.id === team1.id ? team2 : team1;

    // Initialize 4 innings structures
    this.innings = [
      this.createEmptyInnings(1, batTeam.id, bowlTeam.id, batTeam.name, bowlTeam.name),
      this.createEmptyInnings(2, bowlTeam.id, batTeam.id, bowlTeam.name, batTeam.name),
      this.createEmptyInnings(3, batTeam.id, bowlTeam.id, batTeam.name, bowlTeam.name),
      this.createEmptyInnings(4, bowlTeam.id, batTeam.id, bowlTeam.name, batTeam.name),
    ];

    this.setupInningsParticipants(0);
  }

  public setCallbacks(callbacks: TestPlaybackCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
  }

  public getSpeed(): PlaybackSpeed {
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

  public getLastDelivery(): TestDeliveryRecord | null {
    return this.lastExecutedDelivery;
  }

  private createEmptyInnings(
    num: 1 | 2 | 3 | 4,
    batId: string,
    bowlId: string,
    batName: string,
    bowlName: string
  ): TestInningsData {
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
      isDeclared: false,
      isAllOut: false,
      isCompleted: false,
      statusText: num === 1 ? '1st Innings' : `${num}th Innings`,
      batters: {},
      bowlers: {},
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      fallOfWickets: [],
      partnerships: [],
      deliveries: [],
    };
  }

  private setupInningsParticipants(inningsIdx: number): void {
    const currentInning = this.innings[inningsIdx];
    const battingSquad = this.getSquad(currentInning.battingTeamId);
    const bowlingSquad = this.getSquad(currentInning.bowlingTeamId);

    // Set opening batters
    this.strikerId = battingSquad[0]?.id || null;
    this.nonStrikerId = battingSquad[1]?.id || null;
    this.currentBattingCursor = 2;

    // Initialize batter scorecard lines
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
          intent: 'SURVIVAL',
          scoringZonesMap: {},
        };
      }
    });

    // Opening bowler
    const paceBowler = bowlingSquad.find(
      (p) => !p.bowlingStyle?.toLowerCase().includes('spin') && (p.role === 'BOWLER' || p.role === 'ALL_ROUNDER')
    ) || bowlingSquad[0];

    this.bowlerId = paceBowler?.id || bowlingSquad[0]?.id || null;
    this.lastOverBowlerId = null;

    // Initialize bowler lines
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
          currentSpellRuns: 0,
          currentSpellWickets: 0,
        };
      }
    });

    // Initial partnership
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

    // Reset ball condition
    this.ballAge = 0;
    this.oversSinceNewBall = 0;
    this.newBallAvailable = false;
  }

  private getSquad(teamId: string): Player[] {
    const team = teamId === this.team1.id ? this.team1 : this.team2;
    return team.squad.slice(0, 11);
  }

  /**
   * Main asynchronous test match execution loop
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
      await this.checkSessionState();
      await this.checkDayState();
      await this.prepareNextDelivery();
    }
  }

  /**
   * Plays a single delivery on demand (e.g. Next Ball button)
   */
  public async playNextBallManual(): Promise<TestDeliveryRecord | null> {
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
    await this.checkSessionState();
    await this.checkDayState();
    await this.prepareNextDelivery();

    return delivery;
  }

  /**
   * Step 1: Prepare Delivery
   */
  private async prepareDelivery(): Promise<void> {
    this.currentStepMessage = 'FIELD READY';
    this.callbacks.onDeliveryStep?.('FIELD_SETUP', 'Setting up pitch & field cordon');
    if (!this.isFastSimulating) {
      await this.delay(120 / this.speed);
    }
  }

  /**
   * Step 2: Prepare Field based on Bowler & Match Condition
   */
  private async prepareField(): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];
    const bowler = this.getSquad(currentInning.bowlingTeamId).find((p) => p.id === this.bowlerId);
    const isSpinner = bowler?.bowlingStyle?.toLowerCase().includes('spin') || false;

    // Select dynamic tactical field
    let preset = 'ATTACKING_TEST';
    let plan = 'SLIP CORDON & ATTACK';
    let changes: string[] = ['2nd Slip → Added', 'Gully → Added', 'Deep Cover → Moved In'];

    if (isSpinner) {
      preset = 'SPIN_TRAP';
      plan = 'SPIN WEB & CLOSE CATCHERS';
      changes = ['Silly Point → Added', 'Short Leg → Added', 'Slip → In Place', 'Long On → Deep Protect'];
    } else if (currentInning.score > 250 && currentInning.wickets < 3) {
      preset = 'BALANCED';
      plan = 'CONTAINMENT & PATIENCE';
      changes = ['Deep Fine Leg → Deep', 'Cover → Ring Cover', 'Mid Off → Straight'];
    }

    if (this.currentFieldPreset !== preset) {
      this.currentFieldPreset = preset;
      this.callbacks.onFieldChange?.(bowler?.name || 'Bowler', 'Test Tactics', plan, changes);
    }
  }

  /**
   * Step 3: Prepare Bowler
   */
  private async prepareBowler(): Promise<void> {
    this.currentStepMessage = 'BOWLER READY';
    this.callbacks.onDeliveryStep?.('BOWLER_READY', 'Bowler taking mark at top of run-up');
    if (!this.isFastSimulating) {
      await this.delay(100 / this.speed);
    }
  }

  /**
   * Step 4: Prepare Batters & Intent
   */
  private async prepareBatters(): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];
    const strikerLine = currentInning.batters[this.strikerId || ''];
    if (strikerLine) {
      const ballsFaced = strikerLine.balls;
      strikerLine.intent = testBattingAI.getBattingIntentCategory(ballsFaced) as TestBattingIntent;
    }
    this.currentStepMessage = 'BATTERS READY';
    this.callbacks.onDeliveryStep?.('BATTER_READY', 'Striker taking guard');
    if (!this.isFastSimulating) {
      await this.delay(100 / this.speed);
    }
  }

  /**
   * Step 5: Simulate Delivery Outcome (One Engine Result)
   */
  public simulateDelivery(): TestDeliveryRecord {
    const currentInning = this.innings[this.currentInningsIndex];
    const battingSquad = this.getSquad(currentInning.battingTeamId);
    const bowlingSquad = this.getSquad(currentInning.bowlingTeamId);

    const striker = battingSquad.find((p) => p.id === this.strikerId) || battingSquad[0];
    const nonStriker = battingSquad.find((p) => p.id === this.nonStrikerId) || battingSquad[1];
    const bowler = bowlingSquad.find((p) => p.id === this.bowlerId) || bowlingSquad[0];

    const overNum = Math.floor(currentInning.legalBalls / 6);
    const ballInOver = (currentInning.legalBalls % 6) + 1;
    const deliveryId = `TEST_INNINGS_${this.currentInningsIndex + 1}_OVER_${overNum}_BALL_${ballInOver}`;
    const ballDisplay = `${overNum}.${ballInOver}`;

    const isSpinner = bowler.bowlingStyle?.toLowerCase().includes('spin') || false;
    const strikerLine = currentInning.batters[striker.id];
    const ballsFaced = strikerLine?.balls || 0;
    const intent: TestBattingIntent = testBattingAI.getBattingIntentCategory(ballsFaced) as TestBattingIntent;

    // 1. Determine Delivery Length & Line
    const lengths: TestDeliveryLength[] = isSpinner
      ? ['FULL', 'GOOD_LENGTH', 'GOOD_LENGTH', 'SHORT']
      : ['GOOD_LENGTH', 'GOOD_LENGTH', 'FULL', 'SHORT', 'BOUNCER', 'YORKER'];
    const lines: TestDeliveryLine[] = isSpinner
      ? ['SPIN', 'ARM_BALL', 'DRIFTING_SPIN', 'OUTSIDE_OFF', 'ON_STUMPS']
      : ['OUTSIDE_OFF', 'ON_STUMPS', 'LEG_STUMP', 'SWINGING', 'SEAMING', 'WIDE_OUTSIDE_OFF'];

    const chosenLength = lengths[Math.floor(Math.random() * lengths.length)];
    const chosenLine = lines[Math.floor(Math.random() * lines.length)];

    // 2. Wicket Probability Calculation (calibrated to Test realism ~2.8% per ball)
    const bowlerRating = safeRating(bowler.bowlingRating || bowler.rating || 75);
    const batterRating = safeRating(striker.technique || striker.rating || 75);
    const settledness = testBattingAI.calculateSettledness(ballsFaced);

    const pitchBonus = (this.pitch.seam + this.pitch.deterioration + (isSpinner ? this.pitch.spin : 0)) * 0.08;
    const newBallBonus = this.ballAge < 12 ? 14 : 0;
    const intentRisk = intent === 'SURVIVAL' ? -15 : intent === 'ACCELERATE' ? 25 : intent === 'SETTLING' ? -8 : 0;

    const baseThreat = (bowlerRating * 0.35 + pitchBonus + newBallBonus + intentRisk) - (batterRating * 0.25 + settledness * 0.3);
    const wicketProb = safeProbability(0.012 + Math.max(0, baseThreat) * 0.00065, 0.005, 0.085);

    const isWicket = Math.random() < wicketProb;
    let wicketType: TestWicketType | null = null;
    let dismissalFielder: string | null = null;
    let runs = 0;
    let result: 'DOT' | 'SINGLE' | 'TWO' | 'THREE' | 'FOUR' | 'SIX' | 'WICKET' = 'DOT';
    let shot: TestShotType = 'FORWARD_DEFENCE';
    let targetZone: ScoringZoneName = 'COVER';

    if (isWicket) {
      result = 'WICKET';
      if (chosenLength === 'YORKER' || (chosenLine === 'ON_STUMPS' && Math.random() > 0.6)) {
        wicketType = 'BOWLED';
        shot = 'FORWARD_DEFENCE';
        targetZone = 'PITCH';
      } else if (chosenLine === 'ON_STUMPS' || chosenLine === 'LEG_STUMP') {
        wicketType = 'LBW';
        shot = 'FORWARD_DEFENCE';
        targetZone = 'PITCH';
      } else if (chosenLine === 'OUTSIDE_OFF' || chosenLine === 'SWINGING') {
        wicketType = isSpinner ? 'CAUGHT_SLIP' : 'CAUGHT_BEHIND';
        dismissalFielder = isSpinner ? '1st Slip' : 'Wicketkeeper';
        shot = 'EDGE';
        targetZone = isSpinner ? 'FIRST_SLIP' : 'WICKET_KEEPER';
      } else if (isSpinner && chosenLength === 'FULL' && Math.random() > 0.5) {
        wicketType = 'STUMPED';
        dismissalFielder = 'Wicketkeeper';
        shot = 'FORWARD_DEFENCE';
        targetZone = 'WICKET_KEEPER';
      } else {
        wicketType = 'CAUGHT';
        const catchers = ['Cover', 'Mid-Off', 'Mid-On', 'Gully', 'Mid-Wicket', 'Square Leg', 'Fine Leg'];
        dismissalFielder = catchers[Math.floor(Math.random() * catchers.length)];
        shot = chosenLength === 'SHORT' ? 'PULL_SHOT' : 'COVER_DRIVE';
        targetZone = dismissalFielder.toUpperCase().replace('-', '_') as ScoringZoneName;
      }
    } else {
      // Run distribution based on Intent & Shot Selection
      const intentNum = testBattingAI.decideIntent(
        {
          day: this.day,
          session: this.session,
          innings: this.currentInningsIndex + 1,
          score: currentInning.score,
          wickets: currentInning.wickets,
          overs: currentInning.overs,
          balls: currentInning.balls,
          batterBallsFaced: ballsFaced,
          batterSettledness: settledness,
          ballAge: this.ballAge,
          pitchCondition: this.pitch.seam,
          pitchDeterioration: this.pitch.deterioration,
          bowlerSpellOvers: 2,
          bowlerFatigue: 10,
          batterFatigue: 5,
          batterConcentration: 85,
          battingIntent: intent,
        },
        striker,
        bowler
      );

      const shotChoices = testBattingAI.getShotSelection(intentNum);
      const totalW = shotChoices.reduce((s, c) => s + c.weight, 0);
      let roll = Math.random() * totalW;
      let selectedRun = 0;
      for (const sc of shotChoices) {
        roll -= sc.weight;
        if (roll <= 0) {
          selectedRun = sc.runs;
          break;
        }
      }

      runs = selectedRun;
      if (runs === 0) {
        result = 'DOT';
        if (chosenLine === 'WIDE_OUTSIDE_OFF' || (chosenLine === 'OUTSIDE_OFF' && chosenLength === 'GOOD_LENGTH')) {
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
      } else if (runs === 1) {
        result = 'SINGLE';
        shot = chosenLine === 'LEG_STUMP' ? 'FLICK' : chosenLine === 'OUTSIDE_OFF' ? 'SQUARE_CUT' : 'STRAIGHT_DRIVE';
        targetZone = chosenLine === 'LEG_STUMP' ? 'SQUARE_LEG' : 'COVER';
      } else if (runs === 2) {
        result = 'TWO';
        shot = chosenLength === 'SHORT' ? 'PULL_SHOT' : 'COVER_DRIVE';
        targetZone = chosenLength === 'SHORT' ? 'DEEP_MIDWICKET' : 'DEEP_COVER';
      } else if (runs === 3) {
        result = 'THREE';
        shot = 'COVER_DRIVE';
        targetZone = 'DEEP_EXTRA_COVER';
      } else if (runs === 4) {
        result = 'FOUR';
        shot = chosenLine === 'OUTSIDE_OFF' ? 'COVER_DRIVE' : chosenLength === 'SHORT' ? 'PULL_SHOT' : 'STRAIGHT_DRIVE';
        targetZone = chosenLine === 'OUTSIDE_OFF' ? 'EXTRA_COVER' : chosenLength === 'SHORT' ? 'DEEP_MIDWICKET' : 'LONG_OFF';
      } else if (runs === 6) {
        result = 'SIX';
        shot = 'LOFTED_SIX';
        targetZone = 'LONG_ON';
      }
    }

    // 3. Coordinate Trajectory Mapping
    const bounceZ = chosenLength === 'YORKER' ? 8.6 : chosenLength === 'FULL' ? 6.8 : chosenLength === 'SHORT' ? 0.5 : chosenLength === 'BOUNCER' ? -1.8 : 4.2;
    const bounceX = chosenLine === 'OUTSIDE_OFF' || chosenLine === 'WIDE_OUTSIDE_OFF' ? 0.45 : chosenLine === 'LEG_STUMP' ? -0.4 : chosenLine === 'ON_STUMPS' ? 0 : 0.2;
    const apexHeight = chosenLength === 'BOUNCER' ? 1.7 : chosenLength === 'SHORT' ? 1.3 : chosenLength === 'YORKER' ? 0.2 : 0.85;

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
      swingFactor: chosenLine === 'SWINGING' ? 4.5 : 0,
      seamDeviation: chosenLine === 'SEAMING' ? 0.35 : chosenLine === 'SPIN' ? 0.4 : 0,
      shotAngleDeg,
    };

    // 4. Sequential Step Messages
    const stepMessages = [
      `BOWLER RUN-UP: ${bowler.name}`,
      `BALL RELEASE: ${chosenLength.replace('_', ' ')} ${chosenLine.replace('_', ' ')}`,
      `BALL BOUNCE: ${chosenLength.replace('_', ' ')} pitch contact`,
      `BATTER ACTION: ${striker.name} plays ${shot.replace('_', ' ')}`,
      `BALL TRAVEL: Moving toward ${targetZone.replace('_', ' ')}`,
      isWicket ? `WICKET: ${wicketType?.replace('_', ' ')}!` : runs >= 4 ? `BOUNDARY: ${runs === 6 ? 'SIX' : 'FOUR'}!` : `FIELDING: ${runs} run${runs === 1 ? '' : 's'}`,
      `SCORECARD UPDATE`,
    ];

    const commentaryText = isWicket
      ? `${bowler.name} strikes! ${striker.name} is ${wicketType?.toLowerCase().replace('_', ' ')} for ${strikerLine?.runs || 0} (${strikerLine?.balls || 0}b).`
      : runs === 4
      ? `Glorious ${shot.toLowerCase().replace('_', ' ')} by ${striker.name}! Races away to the ${targetZone.toLowerCase().replace('_', ' ')} fence for FOUR.`
      : runs === 6
      ? `Huge hit! ${striker.name} launches it high over ${targetZone.toLowerCase().replace('_', ' ')} for SIX!`
      : runs > 0
      ? `${striker.name} works it into the gap at ${targetZone.toLowerCase().replace('_', ' ')} for ${runs} run${runs > 1 ? 's' : ''}.`
      : `${striker.name} defends solid in front of off-stump. Dot ball.`;

    const record: TestDeliveryRecord = {
      deliveryId,
      matchId: this.matchId,
      inningsId: this.currentInningsIndex + 1,
      over: overNum,
      ball: ballInOver,
      ballDisplay,
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

  /**
   * Step 6: 3D Visualization Pipeline
   */
  private async playDelivery(delivery: TestDeliveryRecord): Promise<void> {
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
        bowlingTactic: delivery.line === 'SWINGING' ? 'OUTSWING' : delivery.line === 'SPIN' ? 'OFF_BREAK' : 'OUTSWING',
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
        isTestFormat: true,
        targetPos: delivery.trajectory.targetPos,
        shotName: delivery.shot,
      }
    );

    this.activeDeliverySequence = seq;
    this.lastExecutedDelivery = delivery;

    this.callbacks.onDeliveryStart?.(delivery, seq);

    // Emit live sequential text feed across duration
    if (!this.isFastSimulating) {
      const stepDuration = (seq.baseDurationMs / seq.stepMessages?.length || 7) / this.speed;
      for (let i = 0; i < delivery.stepMessages.length; i++) {
        this.currentStepMessage = delivery.stepMessages[i];
        this.callbacks.onDeliveryStep?.(
          i === 0 ? 'BOWLER_RUNUP' : i === 1 ? 'BALL_FLIGHT' : i === 2 ? 'BOUNCE' : i === 3 ? 'CONTACT' : i === 4 ? 'BALL_TRAVEL' : 'RESULT',
          delivery.stepMessages[i]
        );
        await this.delay(stepDuration);
        if (this.isPaused) break;
      }
    } else {
      await this.delay(40);
    }
  }

  /**
   * Step 7: Apply Result to Authoritative State
   */
  private async applyResult(delivery: TestDeliveryRecord): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];

    // 1. Batter score update
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

    // 2. Bowler score update
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

    // 4. Partnership update
    const activePship = currentInning.partnerships.find((p) => p.active);
    if (activePship) {
      activePship.runs += delivery.runs;
      activePship.balls += 1;
    }

    // 5. Fall of Wicket if out
    if (delivery.wicket) {
      currentInning.wickets += 1;
      const fow: TestFallOfWicket = {
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

      // Incoming new batter if wickets < 10
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

    // Ball age and pitch wear
    this.ballAge = Number((this.ballAge + 1 / 6).toFixed(2));
    this.oversSinceNewBall += 1 / 6;
    if (this.oversSinceNewBall >= 80) {
      this.newBallAvailable = true;
    }
    this.pitch.deterioration = Math.min(100, this.pitch.deterioration + 0.02);

    // Save record to authoritative history
    currentInning.deliveries.push(delivery);
    this.callbacks.onDeliveryComplete?.(delivery);
  }

  /**
   * Step 8: Update Live Scorecard
   */
  private async updateScorecard(): Promise<void> {
    this.currentStepMessage = 'SCORECARD UPDATED';
    this.callbacks.onStateUpdate?.(this.getSummary());
  }

  /**
   * Step 9: Process Celebrations
   */
  private async processCelebration(delivery: TestDeliveryRecord): Promise<void> {
    if (this.isFastSimulating) return;

    if (delivery.wicket) {
      this.callbacks.onMilestone?.('WICKET!', `${delivery.bowler.name} claims the wicket of ${delivery.striker.name}!`, 'WICKET');
    }
  }

  /**
   * Step 10: Process Milestones (Batters 50/100, Bowlers 5-fer, Partnerships)
   */
  private async processMilestones(delivery: TestDeliveryRecord): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];
    const strikerLine = currentInning.batters[delivery.striker.id];
    const bowlerLine = currentInning.bowlers[delivery.bowler.id];
    const activePship = currentInning.partnerships.find((p) => p.active);

    if (strikerLine) {
      const prevRuns = strikerLine.runs - delivery.runs;
      if (prevRuns < 50 && strikerLine.runs >= 50 && strikerLine.runs < 100) {
        this.callbacks.onMilestone?.('HALF CENTURY! 50*', `${strikerLine.name} raises the bat for a fine 50!`, 'FIFTY');
      } else if (prevRuns < 100 && strikerLine.runs >= 100 && strikerLine.runs < 150) {
        this.callbacks.onMilestone?.('MAGNIFICENT CENTURY! 100*', `${strikerLine.name} celebrates a magnificent Test 100!`, 'CENTURY');
      } else if (prevRuns < 150 && strikerLine.runs >= 150 && strikerLine.runs < 200) {
        this.callbacks.onMilestone?.('150 RUNS! 150*', `${strikerLine.name} reaches 150! Outstanding batting!`, '150');
      } else if (prevRuns < 200 && strikerLine.runs >= 200) {
        this.callbacks.onMilestone?.('DOUBLE CENTURY! 200*', `${strikerLine.name} reaches a monumental 200!`, '200');
      }
    }

    if (bowlerLine && bowlerLine.wickets === 5 && delivery.wicket) {
      this.callbacks.onMilestone?.('5-WICKET HAUL!', `${bowlerLine.name} takes 5 wickets in the innings!`, '5 WICKETS');
    }

    if (activePship) {
      const prevRuns = activePship.runs - delivery.runs;
      if (prevRuns < 50 && activePship.runs >= 50 && activePship.runs < 100) {
        this.callbacks.onMilestone?.('50 PARTNERSHIP', `Crucial 50-run stand between ${activePship.batter1Name} & ${activePship.batter2Name}!`, '50 STAND');
      } else if (prevRuns < 100 && activePship.runs >= 100) {
        this.callbacks.onMilestone?.('100 PARTNERSHIP', `Sensational 100-run partnership!`, '100 STAND');
      }
    }
  }

  /**
   * Step 11: Check Innings Completion or Declaration
   */
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

    // 4th innings chase target reached
    if (this.currentInningsIndex === 3) {
      const target = this.getTarget();
      if (target && currentInning.score >= target) {
        currentInning.isCompleted = true;
        this.determineMatchResult();
        return;
      }
    }

    // Declaration heuristic in 3rd innings with high lead (>450)
    if (this.currentInningsIndex === 2 && currentInning.overs >= 65) {
      const lead = this.getLead();
      if (lead && lead > 420) {
        currentInning.isDeclared = true;
        currentInning.isCompleted = true;
        currentInning.statusText = `${currentInning.battingTeamName} Declared (${currentInning.score}/${currentInning.wickets}d)`;
        this.callbacks.onInningsComplete?.(this.currentInningsIndex, currentInning);
      }
    }
  }

  /**
   * Step 12: Check Session State (Morning, Afternoon, Evening)
   */
  private async checkSessionState(): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];
    if (currentInning.balls === 0 && currentInning.legalBalls > 0) {
      this.sessionOvers += 1;
      this.oversToday += 1;

      // Over Complete Callback
      const overNum = Math.floor(currentInning.legalBalls / 6);
      this.callbacks.onOverComplete?.(overNum, `Over ${overNum} complete: ${currentInning.score}/${currentInning.wickets}`);

      // Session break after 30 overs
      if (this.sessionOvers >= 30) {
        let breakType: 'LUNCH' | 'TEA' | 'STUMPS' = 'LUNCH';
        if (this.session === 'MORNING') {
          breakType = 'LUNCH';
          this.session = 'AFTERNOON';
          this.sessionOvers = 0;
          this.callbacks.onSessionBreak?.('LUNCH', 'LUNCH BREAK - 40 minutes interval');
        } else if (this.session === 'AFTERNOON') {
          breakType = 'TEA';
          this.session = 'EVENING';
          this.sessionOvers = 0;
          this.callbacks.onSessionBreak?.('TEA', 'TEA BREAK - 20 minutes interval');
        } else if (this.session === 'EVENING') {
          breakType = 'STUMPS';
          this.callbacks.onSessionBreak?.('STUMPS', `STUMPS DAY ${this.day}`);
        }
      }
    }
  }

  /**
   * Step 13: Check Day State (Days 1 to 5)
   */
  private async checkDayState(): Promise<void> {
    if (this.oversToday >= 90 || (this.session === 'EVENING' && this.sessionOvers >= 30)) {
      if (this.day >= 5) {
        this.determineMatchResult();
      } else {
        this.day += 1;
        this.session = 'MORNING';
        this.sessionOvers = 0;
        this.oversToday = 0;
      }
    }
  }

  /**
   * Step 14: Prepare Next Delivery (End of over strike rotation & bowler change)
   */
  private async prepareNextDelivery(): Promise<void> {
    const currentInning = this.innings[this.currentInningsIndex];

    // End of over logic
    if (currentInning.balls === 0 && currentInning.legalBalls > 0) {
      // Strike changes end of over
      const tmp = this.strikerId;
      this.strikerId = this.nonStrikerId;
      this.nonStrikerId = tmp;

      // Bowler change
      this.lastOverBowlerId = this.bowlerId;
      const bowlingSquad = this.getSquad(currentInning.bowlingTeamId);
      const candidates = bowlingSquad.filter((p) => p.id !== this.lastOverBowlerId);

      // Rotate bowlers between pace and spin
      const nextBowler = candidates[Math.floor(Math.random() * Math.min(candidates.length, 4))];
      this.bowlerId = nextBowler?.id || candidates[0]?.id || null;
    }
  }

  private async handleInningsTransition(): Promise<void> {
    if (this.currentInningsIndex >= 3) {
      this.determineMatchResult();
      return;
    }

    this.currentInningsIndex += 1;
    this.setupInningsParticipants(this.currentInningsIndex);
  }

  private determineMatchResult(): void {
    const inn1 = this.innings[0];
    const inn2 = this.innings[1];
    const inn3 = this.innings[2];
    const inn4 = this.innings[3];

    const team1Total = inn1.score + (this.currentInningsIndex >= 2 ? inn3.score : 0);
    const team2Total = inn2.score + (this.currentInningsIndex >= 3 ? inn4.score : 0);

    if (this.currentInningsIndex === 3) {
      const target = this.getTarget();
      if (target && inn4.score >= target) {
        const wicketsRemaining = 10 - inn4.wickets;
        this.matchResult = inn4.battingTeamId === this.team1.id ? 'TEAM_1_WIN' : 'TEAM_2_WIN';
        this.resultDescription = `${inn4.battingTeamName} won by ${wicketsRemaining} wickets!`;
      } else if (inn4.isAllOut) {
        const winTeamId = inn4.bowlingTeamId;
        const margin = target ? target - inn4.score - 1 : 0;
        this.matchResult = winTeamId === this.team1.id ? 'TEAM_1_WIN' : 'TEAM_2_WIN';
        this.resultDescription = `${inn4.bowlingTeamName} won by ${margin} runs!`;
      }
    } else if (this.day >= 5) {
      this.matchResult = 'DRAW';
      this.resultDescription = 'Match drawn after 5 days of Test cricket.';
    }

    this.callbacks.onMatchComplete?.(this.matchResult, this.resultDescription);
  }

  /**
   * Take new ball when available (80+ overs)
   */
  public takeNewBall(): boolean {
    if (!this.newBallAvailable) return false;
    this.ballAge = 0;
    this.oversSinceNewBall = 0;
    this.newBallAvailable = false;
    this.callbacks.onMilestone?.('NEW BALL TAKEN', 'The bowling captain has taken the brand new red ball!', 'NEW BALL');
    return true;
  }

  public getLead(): number | null {
    const inn1 = this.innings[0];
    const inn2 = this.innings[1];
    const inn3 = this.innings[2];
    const inn4 = this.innings[3];

    if (this.currentInningsIndex === 0) return null;
    if (this.currentInningsIndex === 1) {
      return inn2.score - inn1.score;
    }
    if (this.currentInningsIndex === 2) {
      return (inn1.score + inn3.score) - inn2.score;
    }
    if (this.currentInningsIndex === 3) {
      return (inn2.score + inn4.score) - (inn1.score + inn3.score);
    }
    return null;
  }

  public getTarget(): number | null {
    if (this.currentInningsIndex === 3) {
      const inn1 = this.innings[0];
      const inn2 = this.innings[1];
      const inn3 = this.innings[2];
      const target = (inn1.score + inn3.score) - inn2.score + 1;
      return Math.max(1, target);
    }
    return null;
  }

  public getSummary(): TestMatchSummary {
    const lead = this.getLead();
    return {
      matchId: this.matchId,
      day: this.day,
      session: this.session,
      sessionName: this.session === 'MORNING' ? 'Morning Session' : this.session === 'AFTERNOON' ? 'Afternoon Session' : 'Evening Session',
      sessionOvers: this.sessionOvers,
      oversToday: this.oversToday,
      currentInningsIndex: this.currentInningsIndex,
      innings: this.innings,
      strikerId: this.strikerId,
      nonStrikerId: this.nonStrikerId,
      bowlerId: this.bowlerId,
      lastOverBowlerId: this.lastOverBowlerId,
      ballAge: this.ballAge,
      oversSinceNewBall: this.oversSinceNewBall,
      newBallAvailable: this.newBallAvailable,
      pitch: this.pitch,
      fieldPreset: this.currentFieldPreset,
      lead: lead !== null && lead > 0 ? lead : null,
      trail: lead !== null && lead < 0 ? Math.abs(lead) : null,
      target: this.getTarget(),
      result: this.matchResult,
      resultDescription: this.resultDescription,
    };
  }

  /**
   * Deterministic Replay: Replays an entire innings or specific delivery from saved history
   */
  public getReplayDeliveries(inningsIndex: number): TestDeliveryRecord[] {
    return this.innings[inningsIndex]?.deliveries || [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
