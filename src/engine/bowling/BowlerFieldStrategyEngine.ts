import { Fielder3DCoord } from '../strategy/FieldStrategyEngine';
import { ScoringZoneName } from '../scoring/ScoringZones';

export type BowlerStrategyType =
  | 'SWING_ATTACK'
  | 'SHORT_BALL_PRESSURE'
  | 'SPIN_PRESSURE'
  | 'DEATH_BOUNDARY_LOCK'
  | 'CONTAINMENT'
  | 'PARTNERSHIP_BREAKER';

export interface BowlerProfileConfig {
  id: string;
  name: string;
  bowlingStyle: string; // 'Fast', 'Fast-Medium', 'Off-Spin', 'Leg-Spin', 'Left-Arm-Pace', 'Left-Arm-Spin'
  pace: number;
  accuracy: number;
  swing: number;
  seam: number;
  variation: number;
  yorkerAbility: number;
  bouncerAbility: number;
  spinAbility: number;
  control: number;
  wicketAbility: number;
  fatigue: number;
}

export interface BowlerBatterMemoryEntry {
  ballsBowled: number;
  runsConceded: number;
  dotBalls: number;
  boundaries: number;
  falseShots: number;
  chances: number;
  dismissals: number;
  adaptationLevel: number; // 0 to 100
  favoriteDismissalZone?: ScoringZoneName;
}

export interface BowlerFieldConfiguration {
  id: string;
  bowlerId: string;
  bowlerName: string;
  strategy: BowlerStrategyType;
  reason: string;
  positions: Fielder3DCoord[];
  maxDeepAllowed: number;
  deepFieldersCount: number;
}

export class BowlerFieldStrategyEngine {
  private memoryMap: Record<string, BowlerBatterMemoryEntry> = {};

  /**
   * Tracks and updates memory head-to-head between bowler and batter
   */
  public recordDeliveryOutcome(
    bowlerId: string,
    batterId: string,
    runs: number,
    isWicket: boolean,
    isFalseShot: boolean = false
  ): BowlerBatterMemoryEntry {
    const key = `${bowlerId}_${batterId}`;
    if (!this.memoryMap[key]) {
      this.memoryMap[key] = {
        ballsBowled: 0,
        runsConceded: 0,
        dotBalls: 0,
        boundaries: 0,
        falseShots: 0,
        chances: 0,
        dismissals: 0,
        adaptationLevel: 0,
      };
    }

    const mem = this.memoryMap[key];
    mem.ballsBowled += 1;
    mem.runsConceded += runs;
    if (runs === 0 && !isWicket) mem.dotBalls += 1;
    if (runs >= 4) mem.boundaries += 1;
    if (isFalseShot) mem.falseShots += 1;
    if (isWicket) mem.dismissals += 1;
    mem.adaptationLevel = Math.min(100, mem.ballsBowled * 3.5 + mem.falseShots * 5);

    return mem;
  }

  public getMemory(bowlerId: string, batterId: string): BowlerBatterMemoryEntry | null {
    return this.memoryMap[`${bowlerId}_${batterId}`] || null;
  }

  /**
   * Generates a unique tactical field customized for the active bowler and batter matchup
   */
  public generateField(
    bowler: BowlerProfileConfig,
    batterScoringMap: Record<string, number> = {},
    format: string = 'T20',
    overs: number = 0,
    wickets: number = 0,
    isDeathOvers: boolean = false
  ): BowlerFieldConfiguration {
    const style = (bowler.bowlingStyle || '').toLowerCase();
    const isSpinner = style.includes('spin') || bowler.spinAbility > 70;
    const isExpressPace = (bowler.pace > 85 || style.includes('fast')) && !isSpinner;
    const isSwingSpecialist = bowler.swing > 75 && !isSpinner;

    // Detect batter scoring hotspots
    const coverHeavy = (batterScoringMap.cover || 0) > 12;
    const midwicketHeavy = (batterScoringMap.midwicket || 0) > 12;

    const fmt = format.toUpperCase();

    // 1. Death Overs Boundary Lock
    if (isDeathOvers || (fmt === 'T20' && overs >= 16) || (fmt === 'ODI' && overs >= 42)) {
      return {
        id: `field_death_${bowler.id}_${overs}`,
        bowlerId: bowler.id,
        bowlerName: bowler.name,
        strategy: 'DEATH_BOUNDARY_LOCK',
        reason: `${bowler.name} death over yorker & boundary protection field`,
        maxDeepAllowed: 5,
        deepFieldersCount: 5,
        positions: [
          { name: 'Short Third Man', x: -6.5, z: 13.5, isDeep: false },
          { name: 'Point', x: -12.5, z: 8.5, isDeep: false },
          { name: 'Extra Cover', x: -11.0, z: -1.5, isDeep: false },
          { name: 'Mid Wicket', x: 11.5, z: 1.0, isDeep: false },
          { name: 'Deep Point', x: -28.0, z: 9.5, isDeep: true },
          { name: 'Long Off', x: -12.0, z: -27.0, isDeep: true },
          { name: 'Long On', x: 12.0, z: -27.0, isDeep: true },
          { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5, isDeep: true },
          { name: 'Deep Square Leg', x: 27.0, z: 11.0, isDeep: true },
        ],
      };
    }

    // 2. Spinner Specialized Field
    if (isSpinner) {
      const positions: Fielder3DCoord[] = [
        { name: 'First Slip', x: -3.5, z: 14.5, isDeep: false },
        { name: 'Backward Point', x: -11.0, z: 11.5, isDeep: false },
        { name: 'Cover', x: -11.5, z: 0.0, isDeep: false },
        { name: 'Forward Short Leg', x: 4.0, z: 7.0, isDeep: false },
        { name: 'Catching Mid-Wicket', x: 9.5, z: 3.0, isDeep: false },
        { name: 'Mid Off', x: -5.0, z: -10.0, isDeep: false },
        { name: 'Long On', x: 12.0, z: -27.0, isDeep: true },
        { name: 'Deep Mid-Wicket', x: 25.0, z: -7.0, isDeep: true },
        { name: 'Deep Sweeper Cover', x: -27.0, z: -2.0, isDeep: true },
      ];

      return {
        id: `field_spin_${bowler.id}`,
        bowlerId: bowler.id,
        bowlerName: bowler.name,
        strategy: 'SPIN_PRESSURE',
        reason: `${bowler.name} turning web trap with catching fielders and long-on protection`,
        maxDeepAllowed: 4,
        deepFieldersCount: 3,
        positions,
      };
    }

    // 3. Fast Swing Specialist (Slip cordon & driving invitation)
    if (isSwingSpecialist || (fmt === 'TEST' && overs < 20)) {
      return {
        id: `field_swing_${bowler.id}`,
        bowlerId: bowler.id,
        bowlerName: bowler.name,
        strategy: 'SWING_ATTACK',
        reason: `${bowler.name} outswing attack with 2 slips, gully, and catching ring`,
        maxDeepAllowed: 2,
        deepFieldersCount: 1,
        positions: [
          { name: '1st Slip', x: -3.0, z: 15.5, isDeep: false },
          { name: '2nd Slip', x: -5.0, z: 16.5, isDeep: false },
          { name: 'Gully', x: -8.8, z: 13.0, isDeep: false },
          { name: 'Point', x: -13.5, z: 9.0, isDeep: false },
          { name: 'Cover', x: -12.5, z: 0.0, isDeep: false },
          { name: 'Mid Off', x: -5.5, z: -10.5, isDeep: false },
          { name: 'Mid On', x: 5.5, z: -10.5, isDeep: false },
          { name: 'Mid Wicket', x: 12.0, z: 1.0, isDeep: false },
          { name: 'Deep Fine Leg', x: 16.0, z: 24.0, isDeep: true },
        ],
      };
    }

    // 4. Short Ball Enforcer (Deep boundary hooks on leg side)
    if (isExpressPace && bowler.bouncerAbility > 80) {
      return {
        id: `field_short_${bowler.id}`,
        bowlerId: bowler.id,
        bowlerName: bowler.name,
        strategy: 'SHORT_BALL_PRESSURE',
        reason: `${bowler.name} hostile bouncer barrage with 2 deep leg catchers`,
        maxDeepAllowed: 4,
        deepFieldersCount: 3,
        positions: [
          { name: 'Point', x: -13.0, z: 8.5, isDeep: false },
          { name: 'Cover', x: -12.0, z: -1.0, isDeep: false },
          { name: 'Mid Off', x: -5.5, z: -10.0, isDeep: false },
          { name: 'Mid On', x: 5.5, z: -10.0, isDeep: false },
          { name: 'Square Leg', x: 12.5, z: 9.0, isDeep: false },
          { name: 'Deep Square Leg', x: 27.0, z: 11.0, isDeep: true },
          { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5, isDeep: true },
          { name: 'Deep Fine Leg', x: 15.0, z: 24.5, isDeep: true },
          { name: 'Third Man', x: -15.0, z: 19.0, isDeep: false },
        ],
      };
    }

    // 5. Standard Tactical Containment (Dynamic cover / midwicket shield)
    return {
      id: `field_standard_${bowler.id}`,
      bowlerId: bowler.id,
      bowlerName: bowler.name,
      strategy: 'CONTAINMENT',
      reason: `${bowler.name} disciplined line & length field`,
      maxDeepAllowed: 4,
      deepFieldersCount: 3,
      positions: [
        { name: '1st Slip', x: -3.5, z: 15.0, isDeep: false },
        { name: 'Backward Point', x: -12.5, z: 11.0, isDeep: false },
        { name: 'Cover', x: -13.0, z: -1.0, isDeep: false },
        { name: 'Mid Off', x: -5.0, z: -10.0, isDeep: false },
        { name: 'Mid On', x: 5.0, z: -10.0, isDeep: false },
        { name: 'Mid Wicket', x: 12.0, z: 0.0, isDeep: false },
        { name: 'Deep Extra Cover', x: coverHeavy ? -28.0 : -25.0, z: -3.0, isDeep: true },
        { name: 'Deep Mid-Wicket', x: midwicketHeavy ? 27.0 : 25.0, z: -8.0, isDeep: true },
        { name: 'Deep Fine Leg', x: 15.0, z: 24.0, isDeep: true },
      ],
    };
  }
}

export const bowlerFieldStrategyEngine = new BowlerFieldStrategyEngine();
