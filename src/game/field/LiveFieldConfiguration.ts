import { Fielder3DCoord } from '../../engine/strategy/FieldStrategyEngine';
import { ScoringZoneName } from '../../engine/scoring/ScoringZones';

export interface LiveFielderState {
  playerId: string;
  name: string;
  role: string;
  zone: ScoringZoneName;
  currentX: number;
  currentZ: number;
  targetX: number;
  targetZ: number;
  movementState: 'STATIONARY' | 'WALKING' | 'RUNNING' | 'POSITIONING' | 'READY';
  isDeep: boolean;
}

export interface LiveFieldConfiguration {
  id: string;
  bowlerId: string;
  bowlerName: string;
  bowlingPlan: string;
  fieldStrategy: string;
  fielders: LiveFielderState[];
  changesDescription?: string[];
  isFieldReady: boolean;
}

export class FieldPositionEngine {
  /**
   * Generates a 3D LiveFieldConfiguration with exact coordinates and change log
   */
  public static buildLiveConfiguration(
    positions: Fielder3DCoord[],
    bowlerId: string,
    bowlerName: string,
    bowlingPlan: string = 'OUTSIDE_OFF',
    strategy: string = 'ATTACK',
    previousFielders: LiveFielderState[] = []
  ): LiveFieldConfiguration {
    const changes: string[] = [];

    const fielders: LiveFielderState[] = positions.map((pos, idx) => {
      const prev = previousFielders[idx];
      const targetX = pos.x;
      const targetZ = pos.z;
      const currentX = prev ? prev.currentX : targetX;
      const currentZ = prev ? prev.currentZ : targetZ;

      const dist = Math.hypot(targetX - currentX, targetZ - currentZ);
      if (prev && dist > 1.5) {
        changes.push(`${pos.name} adjusted position (${Math.round(dist)}m)`);
      }

      return {
        playerId: `fielder_${idx + 1}`,
        name: pos.name,
        role: pos.name,
        zone: (pos.name.toUpperCase().replace(/\s+/g, '_') as ScoringZoneName) || 'COVER',
        currentX,
        currentZ,
        targetX,
        targetZ,
        movementState: dist > 8 ? 'RUNNING' : dist > 0.5 ? 'WALKING' : 'READY',
        isDeep: Boolean(pos.isDeep),
      };
    });

    return {
      id: `live_field_${bowlerId}_${Date.now()}`,
      bowlerId,
      bowlerName,
      bowlingPlan,
      fieldStrategy: strategy,
      fielders,
      changesDescription: changes.length > 0 ? changes : ['Standard Tactical Field Adjustment'],
      isFieldReady: fielders.every((f) => f.movementState === 'READY'),
    };
  }
}
