export type DynamicFieldPreset =
  | 'POWERPLAY_ATTACK'
  | 'ATTACKING'
  | 'RING_PRESSURE'
  | 'PARTNERSHIP_PRESSURE'
  | 'BOUNDARY_PROTECTION'
  | 'ACCELERATION'
  | 'DEATH_FIELD'
  | 'WICKET_ATTACK'
  | 'LAST_OVER'
  | 'CHASE_CONTROL';

export interface Fielder3DCoord {
  name: string;
  x: number;
  z: number;
  isDeep: boolean;
}

export interface DynamicFieldLayout {
  preset: DynamicFieldPreset;
  presetTitle: string;
  description: string;
  positions: Fielder3DCoord[];
  maxDeepAllowed: number;
  deepFieldersCount: number;
}

export class FieldStrategyEngine {
  /**
   * Generates dynamic 3D field layout based on match situation and format phases
   */
  public evaluate(
    format: string,
    overs: number,
    wickets: number,
    currentRunRate: number,
    requiredRunRate: number | null = null,
    isSpinner: boolean = false,
    boundaryHotspot: 'COVER' | 'MIDWICKET' | 'STRAIGHT' | 'NONE' = 'NONE',
    partnershipRuns: number = 0
  ): DynamicFieldLayout {
    const fmt = format.toUpperCase();

    // ──────────────────────────────────────────────────────────
    // 1. TEST MATCH FIELD LOGIC
    // ──────────────────────────────────────────────────────────
    if (fmt === 'TEST') {
      if (wickets >= 7 || overs < 10) {
        return this.getAttackingSlipCordon();
      } else if (partnershipRuns > 60) {
        return this.getPartnershipPressureField(isSpinner);
      } else {
        return this.getRingPressureField(isSpinner);
      }
    }

    // ──────────────────────────────────────────────────────────
    // 2. ODI MATCH FIELD LOGIC
    // ──────────────────────────────────────────────────────────
    if (fmt === 'ODI') {
      // Overs 1-10: Powerplay 1 (Max 2 outside 30yd circle)
      if (overs < 10) {
        return this.getPowerplayField(isSpinner);
      }
      // Overs 41-50: Death Overs (5 deep fielders)
      else if (overs >= 40) {
        return this.getDeathOversField(boundaryHotspot);
      }
      // Overs 36-40: Acceleration preparation (4 deep fielders)
      else if (overs >= 35) {
        return this.getAccelerationField(boundaryHotspot);
      }
      // Overs 11-35: Middle Overs (Post-Powerplay Partnership & Ring Pressure)
      else {
        if (partnershipRuns > 50) {
          return this.getPartnershipPressureField(isSpinner);
        } else if (boundaryHotspot === 'COVER' || boundaryHotspot === 'MIDWICKET') {
          return this.getBoundaryProtectionField(boundaryHotspot);
        } else {
          return this.getRingPressureField(isSpinner);
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // 3. T20 / IPL MATCH FIELD LOGIC
    // ──────────────────────────────────────────────────────────
    // Overs 1-6: Powerplay (Max 2 outside)
    if (overs < 6) {
      return this.getPowerplayField(isSpinner);
    }
    // Overs 16-20: Death Overs (5 outside)
    else if (overs >= 15) {
      return this.getDeathOversField(boundaryHotspot);
    }
    // Overs 7-15: Middle Overs
    else {
      if (requiredRunRate !== null && requiredRunRate > 10.5) {
        return this.getChaseControlField();
      } else if (boundaryHotspot !== 'NONE') {
        return this.getBoundaryProtectionField(boundaryHotspot);
      } else {
        return this.getRingPressureField(isSpinner);
      }
    }
  }

  // ── Preset Generators with 3D Field Coordinates (meters) ──

  private getPowerplayField(isSpinner: boolean): DynamicFieldLayout {
    return {
      preset: 'POWERPLAY_ATTACK',
      presetTitle: 'Powerplay Ring (2 Deep Protect)',
      description: 'Tight inner ring saving the single, 2 fielders guarding boundaries',
      maxDeepAllowed: 2,
      deepFieldersCount: 2,
      positions: [
        { name: 'First Slip', x: -3.5, z: 15.0, isDeep: false },
        { name: 'Backward Point', x: -12.5, z: 12.0, isDeep: false },
        { name: 'Cover Point', x: -14.0, z: 6.5, isDeep: false },
        { name: 'Extra Cover', x: -11.5, z: -3.0, isDeep: false },
        { name: 'Mid Off', x: -5.0, z: -9.5, isDeep: false },
        { name: 'Mid On', x: 5.0, z: -9.5, isDeep: false },
        { name: 'Mid Wicket', x: 12.0, z: -1.0, isDeep: false },
        { name: 'Deep Square Leg', x: 26.0, z: 11.0, isDeep: true },
        { name: 'Deep Third Man', x: -22.0, z: 24.0, isDeep: true },
      ],
    };
  }

  private getRingPressureField(isSpinner: boolean): DynamicFieldLayout {
    return {
      preset: 'RING_PRESSURE',
      presetTitle: 'Ring Pressure (3-4 Deep)',
      description: 'Choking singles in the middle overs and building dot-ball pressure',
      maxDeepAllowed: 4,
      deepFieldersCount: 4,
      positions: [
        { name: 'Point', x: -13.5, z: 9.0, isDeep: false },
        { name: 'Cover', x: -13.0, z: -1.5, isDeep: false },
        { name: 'Short Mid Wicket', x: 11.0, z: 1.0, isDeep: false },
        { name: 'Short Fine Leg', x: 9.0, z: 15.0, isDeep: false },
        { name: 'Deep Extra Cover', x: -27.0, z: -4.0, isDeep: true },
        { name: 'Long Off', x: -12.0, z: -27.0, isDeep: true },
        { name: 'Long On', x: 12.0, z: -27.0, isDeep: true },
        { name: 'Deep Mid Wicket', x: 26.0, z: -8.0, isDeep: true },
        { name: 'Third Man', x: -15.0, z: 19.0, isDeep: false },
      ],
    };
  }

  private getPartnershipPressureField(isSpinner: boolean): DynamicFieldLayout {
    return {
      preset: 'PARTNERSHIP_PRESSURE',
      presetTitle: 'Partnership Breaker',
      description: 'Close catching fielder placed to induce false shots against established batters',
      maxDeepAllowed: 4,
      deepFieldersCount: 4,
      positions: [
        { name: 'Catching Slip', x: -3.5, z: 14.5, isDeep: false },
        { name: 'Catching Mid-Wicket', x: 8.5, z: 4.0, isDeep: false },
        { name: 'Extra Cover', x: -12.0, z: -1.5, isDeep: false },
        { name: 'Point', x: -13.0, z: 9.0, isDeep: false },
        { name: 'Long Off', x: -12.0, z: -27.0, isDeep: true },
        { name: 'Long On', x: 12.0, z: -27.0, isDeep: true },
        { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5, isDeep: true },
        { name: 'Deep Fine Leg', x: 16.0, z: 24.0, isDeep: true },
        { name: 'Mid On', x: 5.5, z: -10.0, isDeep: false },
      ],
    };
  }

  private getBoundaryProtectionField(hotspot: string): DynamicFieldLayout {
    const isCover = hotspot === 'COVER';
    return {
      preset: 'BOUNDARY_PROTECTION',
      presetTitle: isCover ? 'Cover Boundary Shield' : 'On-Side Boundary Shield',
      description: `Reinforced boundary protection on the ${isCover ? 'off-side' : 'leg-side'}`,
      maxDeepAllowed: 5,
      deepFieldersCount: 5,
      positions: [
        { name: 'Point', x: -13.0, z: 8.5, isDeep: false },
        { name: 'Mid Off', x: -6.0, z: -10.0, isDeep: false },
        { name: 'Mid On', x: 6.0, z: -10.0, isDeep: false },
        { name: 'Short Fine Leg', x: 8.5, z: 14.0, isDeep: false },
        { name: 'Deep Point', x: -28.0, z: 9.5, isDeep: true },
        { name: 'Deep Cover', x: -28.0, z: -2.0, isDeep: true },
        { name: 'Long Off', x: -12.0, z: -27.0, isDeep: true },
        { name: 'Long On', x: 12.0, z: -27.0, isDeep: true },
        { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5, isDeep: true },
      ],
    };
  }

  private getAccelerationField(hotspot: string): DynamicFieldLayout {
    return {
      preset: 'ACCELERATION',
      presetTitle: 'Acceleration Prep (Overs 36-40)',
      description: 'Strengthening boundary ropes while keeping ring active',
      maxDeepAllowed: 4,
      deepFieldersCount: 4,
      positions: [
        { name: 'Backward Point', x: -12.5, z: 10.0, isDeep: false },
        { name: 'Cover', x: -12.0, z: 0.0, isDeep: false },
        { name: 'Mid Wicket', x: 11.5, z: 1.0, isDeep: false },
        { name: 'Mid Off', x: -5.5, z: -10.0, isDeep: false },
        { name: 'Mid On', x: 5.5, z: -10.0, isDeep: false },
        { name: 'Deep Cover', x: -27.0, z: -4.0, isDeep: true },
        { name: 'Long Off', x: -12.0, z: -27.0, isDeep: true },
        { name: 'Long On', x: 12.0, z: -27.0, isDeep: true },
        { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5, isDeep: true },
      ],
    };
  }

  private getDeathOversField(hotspot: string): DynamicFieldLayout {
    return {
      preset: 'DEATH_FIELD',
      presetTitle: 'Death Overs Ring (5 Deep Boundary Protect)',
      description: 'Full 5-man boundary patrol guarding maximum scoring zones',
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

  private getChaseControlField(): DynamicFieldLayout {
    return {
      preset: 'CHASE_CONTROL',
      presetTitle: 'Chase Defense (Boundary Lock)',
      description: 'Protecting boundaries to elevate required run rate pressure',
      maxDeepAllowed: 5,
      deepFieldersCount: 5,
      positions: [
        { name: 'Short Point', x: -11.0, z: 9.0, isDeep: false },
        { name: 'Cover', x: -11.5, z: 0.0, isDeep: false },
        { name: 'Mid Wicket', x: 11.0, z: 1.0, isDeep: false },
        { name: 'Short Fine Leg', x: 8.0, z: 14.0, isDeep: false },
        { name: 'Deep Extra Cover', x: -28.0, z: -3.0, isDeep: true },
        { name: 'Long Off', x: -12.0, z: -27.0, isDeep: true },
        { name: 'Long On', x: 12.0, z: -27.0, isDeep: true },
        { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5, isDeep: true },
        { name: 'Deep Third Man', x: -22.0, z: 24.0, isDeep: true },
      ],
    };
  }

  private getAttackingSlipCordon(): DynamicFieldLayout {
    return {
      preset: 'ATTACKING',
      presetTitle: 'Slip Cordon Attack',
      description: '3 Slips, Gully & short catchers attacking the new batter or tail',
      maxDeepAllowed: 0,
      deepFieldersCount: 0,
      positions: [
        { name: '1st Slip', x: -2.5, z: 15.5, isDeep: false },
        { name: '2nd Slip', x: -4.5, z: 16.5, isDeep: false },
        { name: '3rd Slip', x: -6.5, z: 17.5, isDeep: false },
        { name: 'Gully', x: -9.0, z: 13.5, isDeep: false },
        { name: 'Silly Point', x: -4.5, z: 7.5, isDeep: false },
        { name: 'Short Leg', x: 4.5, z: 7.5, isDeep: false },
        { name: 'Cover', x: -12.5, z: 1.0, isDeep: false },
        { name: 'Mid Off', x: -5.5, z: -10.5, isDeep: false },
        { name: 'Mid On', x: 5.5, z: -10.5, isDeep: false },
      ],
    };
  }
}

export const fieldStrategyEngine = new FieldStrategyEngine();
