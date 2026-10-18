import { Point } from '../engine/strategy/BowlerFieldStrategyEngine';
import type { FieldValidationResult } from '../engine/fielding/FieldingRestrictionEngine';

export type DeliveryLifecycle =
  | 'READY'
  | 'DELIVERY_SIMULATION'
  | 'RESULT_LOCKED'
  | 'BALL_PATH_PLAYBACK'
  | 'DELIVERY_OUTCOME'
  | 'SCORE_UPDATE'
  | 'FIELD_CHANGE_IF_REQUIRED'
  | 'FIELD_READY'
  | 'NEXT_DELIVERY';

export type DeliveryResultType =
  | 'DOT'
  | 'SINGLE'
  | 'TWO'
  | 'THREE'
  | 'FOUR'
  | 'SIX'
  | 'WICKET'
  | 'WIDE'
  | 'NO_BALL'
  | 'BYE'
  | 'LEG_BYE';

export interface BallTrajectoryPath {
  start: Point;
  bounce: Point;
  contact: Point;
  target: Point;
  normalizedStart?: Point;
  normalizedBounce?: Point;
  normalizedContact?: Point;
  normalizedTarget?: Point;
  isAerial?: boolean;
  apexHeight?: number;
}

export interface DeliveryResult {
  id: string;
  ballNumber: number;
  overIndex: number;
  ballInOver: number;
  strikerId: string;
  strikerName: string;
  nonStrikerId: string;
  nonStrikerName: string;
  bowlerId: string;
  bowlerName: string;
  legalBall: boolean;
  batterRuns: number;
  extraRuns: number;
  totalRuns: number;
  extraType?: 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye';
  wicket: boolean;
  wicketType?: 'Bowled' | 'Caught' | 'Caught Behind' | 'LBW' | 'Run Out' | 'Stumped' | 'Timed Out' | 'Hit Wicket';
  dismissedPlayerId?: string;
  dismissedPlayerName?: string;
  shotType: string;
  targetZone: string;
  canonicalZoneId?: string;
  ballPath: BallTrajectoryPath;
  resultType: DeliveryResultType;
  commentary: string;
  timestamp: number;
  strikeRotated: boolean;
  overCompleted: boolean;
  isFreeHit?: boolean;
  triggeredFreeHit?: boolean;
  /** Authoritative field-legality report captured at the instant of delivery. */
  fieldValidation?: FieldValidationResult;
}

