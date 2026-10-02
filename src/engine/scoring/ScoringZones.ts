export type ScoringZoneName =
  | 'THIRD_MAN'
  | 'DEEP_THIRD_MAN'
  | 'SLIPS'
  | 'GULLY'
  | 'POINT'
  | 'DEEP_POINT'
  | 'BACKWARD_POINT'
  | 'COVER'
  | 'DEEP_COVER'
  | 'EXTRA_COVER'
  | 'LONG_OFF'
  | 'STRAIGHT'
  | 'LONG_ON'
  | 'MID_ON'
  | 'MIDWICKET'
  | 'DEEP_MIDWICKET'
  | 'SQUARE_LEG'
  | 'DEEP_SQUARE_LEG'
  | 'FINE_LEG'
  | 'DEEP_FINE_LEG'
  | 'BEHIND_WICKET';

export type BatterHand = 'RIGHT_HAND' | 'LEFT_HAND';

export interface ScoringZoneGeometry {
  name: ScoringZoneName;
  side: 'OFF' | 'STRAIGHT' | 'LEG' | 'BEHIND';
  centerAngleDegRH: number; // Angle in degrees relative to straight ahead (0° = Straight down the pitch towards bowler)
  angularSpanDeg: number;   // Width of the zone in degrees
  innerDistanceMeters: number;
  outerDistanceMeters: number;
}

/**
 * 360-degree Ground Scoring Zone Map (Calibrated for a standard 38m 3D boundary)
 * Angles for Right-Hand batter:
 *   -180° / +180° = Directly behind wicketkeeper
 *   -135° = Third Man / Slips
 *   -90°  = Point (Square Off-side)
 *   -45°  = Cover / Extra Cover
 *     0°  = Straight Drive / Long Off / Long On
 *   +45°  = Mid-Wicket
 *   +90°  = Square Leg (Square Leg-side)
 *  +135°  = Fine Leg
 */
export const SCORING_ZONES_RH: Record<ScoringZoneName, ScoringZoneGeometry> = {
  BEHIND_WICKET: {
    name: 'BEHIND_WICKET',
    side: 'BEHIND',
    centerAngleDegRH: 180,
    angularSpanDeg: 30,
    innerDistanceMeters: 2.0,
    outerDistanceMeters: 14.0,
  },
  SLIPS: {
    name: 'SLIPS',
    side: 'OFF',
    centerAngleDegRH: -155,
    angularSpanDeg: 25,
    innerDistanceMeters: 2.0,
    outerDistanceMeters: 16.0,
  },
  GULLY: {
    name: 'GULLY',
    side: 'OFF',
    centerAngleDegRH: -130,
    angularSpanDeg: 20,
    innerDistanceMeters: 4.0,
    outerDistanceMeters: 18.0,
  },
  THIRD_MAN: {
    name: 'THIRD_MAN',
    side: 'OFF',
    centerAngleDegRH: -140,
    angularSpanDeg: 30,
    innerDistanceMeters: 12.0,
    outerDistanceMeters: 24.0,
  },
  DEEP_THIRD_MAN: {
    name: 'DEEP_THIRD_MAN',
    side: 'OFF',
    centerAngleDegRH: -140,
    angularSpanDeg: 30,
    innerDistanceMeters: 24.0,
    outerDistanceMeters: 38.0,
  },
  BACKWARD_POINT: {
    name: 'BACKWARD_POINT',
    side: 'OFF',
    centerAngleDegRH: -110,
    angularSpanDeg: 20,
    innerDistanceMeters: 6.0,
    outerDistanceMeters: 20.0,
  },
  POINT: {
    name: 'POINT',
    side: 'OFF',
    centerAngleDegRH: -90,
    angularSpanDeg: 25,
    innerDistanceMeters: 6.0,
    outerDistanceMeters: 22.0,
  },
  DEEP_POINT: {
    name: 'DEEP_POINT',
    side: 'OFF',
    centerAngleDegRH: -90,
    angularSpanDeg: 25,
    innerDistanceMeters: 22.0,
    outerDistanceMeters: 38.0,
  },
  COVER: {
    name: 'COVER',
    side: 'OFF',
    centerAngleDegRH: -55,
    angularSpanDeg: 30,
    innerDistanceMeters: 6.0,
    outerDistanceMeters: 22.0,
  },
  DEEP_COVER: {
    name: 'DEEP_COVER',
    side: 'OFF',
    centerAngleDegRH: -55,
    angularSpanDeg: 30,
    innerDistanceMeters: 22.0,
    outerDistanceMeters: 38.0,
  },
  EXTRA_COVER: {
    name: 'EXTRA_COVER',
    side: 'OFF',
    centerAngleDegRH: -35,
    angularSpanDeg: 25,
    innerDistanceMeters: 6.0,
    outerDistanceMeters: 24.0,
  },
  LONG_OFF: {
    name: 'LONG_OFF',
    side: 'OFF',
    centerAngleDegRH: -18,
    angularSpanDeg: 22,
    innerDistanceMeters: 20.0,
    outerDistanceMeters: 38.0,
  },
  STRAIGHT: {
    name: 'STRAIGHT',
    side: 'STRAIGHT',
    centerAngleDegRH: 0,
    angularSpanDeg: 20,
    innerDistanceMeters: 4.0,
    outerDistanceMeters: 38.0,
  },
  LONG_ON: {
    name: 'LONG_ON',
    side: 'LEG',
    centerAngleDegRH: 18,
    angularSpanDeg: 22,
    innerDistanceMeters: 20.0,
    outerDistanceMeters: 38.0,
  },
  MID_ON: {
    name: 'MID_ON',
    side: 'LEG',
    centerAngleDegRH: 25,
    angularSpanDeg: 25,
    innerDistanceMeters: 5.0,
    outerDistanceMeters: 20.0,
  },
  MIDWICKET: {
    name: 'MIDWICKET',
    side: 'LEG',
    centerAngleDegRH: 55,
    angularSpanDeg: 35,
    innerDistanceMeters: 6.0,
    outerDistanceMeters: 22.0,
  },
  DEEP_MIDWICKET: {
    name: 'DEEP_MIDWICKET',
    side: 'LEG',
    centerAngleDegRH: 55,
    angularSpanDeg: 35,
    innerDistanceMeters: 22.0,
    outerDistanceMeters: 38.0,
  },
  SQUARE_LEG: {
    name: 'SQUARE_LEG',
    side: 'LEG',
    centerAngleDegRH: 90,
    angularSpanDeg: 30,
    innerDistanceMeters: 6.0,
    outerDistanceMeters: 22.0,
  },
  DEEP_SQUARE_LEG: {
    name: 'DEEP_SQUARE_LEG',
    side: 'LEG',
    centerAngleDegRH: 90,
    angularSpanDeg: 30,
    innerDistanceMeters: 22.0,
    outerDistanceMeters: 38.0,
  },
  FINE_LEG: {
    name: 'FINE_LEG',
    side: 'LEG',
    centerAngleDegRH: 135,
    angularSpanDeg: 35,
    innerDistanceMeters: 6.0,
    outerDistanceMeters: 22.0,
  },
  DEEP_FINE_LEG: {
    name: 'DEEP_FINE_LEG',
    side: 'LEG',
    centerAngleDegRH: 135,
    angularSpanDeg: 35,
    innerDistanceMeters: 22.0,
    outerDistanceMeters: 38.0,
  },
};

/**
 * Converts a target zone and distance to 3D Ground Coordinates (x, z)
 * Batting crease is positioned at z = 9.5
 */
export function getZoneCoordinates(
  zoneName: ScoringZoneName,
  distanceFraction: number = 0.85, // 0.0 (near crease) to 1.0 (boundary)
  batterHand: BatterHand = 'RIGHT_HAND'
): { x: number; z: number; angleDeg: number; isAerial: boolean } {
  const geom = SCORING_ZONES_RH[zoneName] || SCORING_ZONES_RH.COVER;

  // Mirror angle across y-axis for left-hand batters
  let angleDeg = geom.centerAngleDegRH;
  if (batterHand === 'LEFT_HAND') {
    angleDeg = -angleDeg;
  }

  const radius = geom.innerDistanceMeters + (geom.outerDistanceMeters - geom.innerDistanceMeters) * distanceFraction;
  
  // Angle: 0° points down negative Z (towards bowler at -10).
  // Therefore: rad = (angleDeg - 90) in standard trig, or -sin(angle) for X, -cos(angle) for Z
  const rad = (angleDeg * Math.PI) / 180;
  const x = Math.sin(rad) * radius;
  const z = 9.5 - Math.cos(rad) * radius;

  return {
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
    angleDeg,
    isAerial: radius >= 36.0,
  };
}
