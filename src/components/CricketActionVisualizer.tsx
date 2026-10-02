import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  FastForward, 
  SkipForward, 
  Eye, 
  Sliders, 
  Activity, 
  Shield, 
  Zap, 
  Move,
  RotateCcw,
  Layers,
  Sparkles,
  Flame,
  Wind,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { BallOutcome } from '../types/match';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { cn } from '../lib/utils';
import CricketActionVisualizer3D from './CricketActionVisualizer3D';

export type AnimationSpeed = 1 | 2 | 4 | 0; // 0 = Instant/Skip

export type AnimatorState = 
  | 'IDLE'
  | 'BOWLER_READY'
  | 'BOWLER_RUNUP'
  | 'DELIVERY_RELEASE'
  | 'BALL_FLIGHT'
  | 'BOUNCE'
  | 'BALL_TO_BATTER'
  | 'BAT_CONTACT'
  | 'SHOT_TRAJECTORY'
  | 'BALL_FIELD_TRAVEL'
  | 'FIELDER_CHASE'
  | 'FIELDING_ACTION'
  | 'THROW'
  | 'CATCH'
  | 'BOUNDARY'
  | 'WICKET'
  | 'RESULT'
  | 'RESET';

export type FieldPreset = 'BALANCED' | 'POWERPLAY' | 'ATTACKING_TEST' | 'DEATH_OVERS' | 'SPIN_TRAP' | 'CUSTOM';

export type BowlingTactic = 
  | 'OUTSWING'
  | 'INSWING'
  | 'REVERSE_SWING'
  | 'SLOWER_BALL'
  | 'YORKER'
  | 'BOUNCER'
  | 'OFF_CUTTER'
  | 'LEG_CUTTER'
  | 'OFF_BREAK'
  | 'DOOSRA'
  | 'LEG_BREAK'
  | 'GOOGLY'
  | 'ARM_BALL'
  | 'TOP_SPINNER'
  | 'CARROM_BALL';

import { TVScoreboardBatter, TVScoreboardBowler } from './TVScoreboard';

export interface VisualizerProps {
  striker: Player | null;
  nonStriker: Player | null;
  bowler: Player | null;
  lastBall: (BallOutcome & { runs: number; isWicket?: boolean; wicketType?: string; isExtra?: boolean; extraType?: string; bowlingTactic?: BowlingTactic }) | null;
  ballCount: number;
  format: ArenaFormat;
  battingTeamName: string;
  bowlingTeamName: string;
  battingTeamShortName?: string;
  teamLogo?: string;
  teamAccentColor?: string;
  isFreeHit?: boolean;
  score?: number;
  wickets?: number;
  overs?: number;
  balls?: number;
  totalOvers?: number;
  target?: number | null;
  currentRunRate?: number;
  requiredRunRate?: number | null;
  strikerStats?: TVScoreboardBatter;
  nonStrikerStats?: TVScoreboardBatter;
  bowlerStats?: TVScoreboardBowler;
  recentBalls?: string[];
  partnership?: { runs: number; balls: number };
  innings?: number;
  day?: number;
  session?: number;
  lead?: number | null;
  onAnimationComplete?: () => void;
  speed?: AnimationSpeed;
  onSpeedChange?: (speed: AnimationSpeed) => void;
  className?: string;
  activeBowlingTactic?: BowlingTactic;
  onTacticChange?: (tactic: BowlingTactic) => void;
}

interface Point {
  x: number;
  y: number;
}

interface FielderPos {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
}

// Field Dimensions in SVG viewBox (600 x 600)
const PITCH_CENTER: Point = { x: 300, y: 300 };
const BOWLER_CREASE: Point = { x: 300, y: 190 };
const BATTER_CREASE: Point = { x: 300, y: 410 };
const NON_STRIKER_CREASE: Point = { x: 300, y: 200 };
const BOUNDARY_RADIUS = 268;

// Field Presets for full 360-degree tactical setups
const FIELD_PRESETS: Record<Exclude<FieldPreset, 'CUSTOM'>, { name: string; icon: string; positions: { name: string; x: number; y: number }[] }> = {
  BALANCED: {
    name: 'Balanced (4-5 Split)',
    icon: '🛡️',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 460 },
      { name: 'Slip', x: 260, y: 470 },
      { name: 'Gully', x: 215, y: 435 },
      { name: 'Point', x: 160, y: 405 },
      { name: 'Cover', x: 170, y: 285 },
      { name: 'Mid Off', x: 245, y: 190 },
      { name: 'Mid On', x: 355, y: 190 },
      { name: 'Mid Wicket', x: 425, y: 285 },
      { name: 'Square Leg', x: 440, y: 405 },
      { name: 'Deep Fine Leg', x: 410, y: 520 },
      { name: 'Deep Cover', x: 100, y: 220 },
    ],
  },
  POWERPLAY: {
    name: 'Powerplay (Ring Field)',
    icon: '⚡',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 460 },
      { name: 'First Slip', x: 265, y: 465 },
      { name: 'Backward Point', x: 175, y: 430 },
      { name: 'Cover Point', x: 165, y: 375 },
      { name: 'Extra Cover', x: 190, y: 270 },
      { name: 'Mid Off', x: 250, y: 215 },
      { name: 'Mid On', x: 350, y: 215 },
      { name: 'Mid Wicket', x: 415, y: 290 },
      { name: 'Square Leg', x: 430, y: 410 },
      { name: 'Deep Mid-Wicket', x: 475, y: 210 },
      { name: 'Deep Third Man', x: 145, y: 505 },
    ],
  },
  ATTACKING_TEST: {
    name: 'Slip Cordon (Test / Attack)',
    icon: '⚔️',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 460 },
      { name: '1st Slip', x: 275, y: 470 },
      { name: '2nd Slip', x: 255, y: 480 },
      { name: '3rd Slip', x: 235, y: 490 },
      { name: 'Gully', x: 210, y: 450 },
      { name: 'Silly Point', x: 250, y: 385 },
      { name: 'Short Leg', x: 350, y: 385 },
      { name: 'Cover', x: 180, y: 310 },
      { name: 'Mid Off', x: 245, y: 195 },
      { name: 'Mid On', x: 355, y: 195 },
      { name: 'Fine Leg', x: 430, y: 500 },
    ],
  },
  DEATH_OVERS: {
    name: 'Death Overs (5 Deep Protect)',
    icon: '🔒',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 460 },
      { name: 'Short Third Man', x: 235, y: 445 },
      { name: 'Point', x: 180, y: 395 },
      { name: 'Extra Cover', x: 195, y: 290 },
      { name: 'Mid Wicket', x: 410, y: 310 },
      { name: 'Deep Point', x: 80, y: 410 },
      { name: 'Long Off', x: 200, y: 75 },
      { name: 'Long On', x: 400, y: 75 },
      { name: 'Deep Mid-Wicket', x: 500, y: 220 },
      { name: 'Deep Square Leg', x: 510, y: 420 },
      { name: 'Deep Fine Leg', x: 440, y: 510 },
    ],
  },
  SPIN_TRAP: {
    name: 'Spin Web Trap',
    icon: '🕸️',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 445 },
      { name: 'Slip', x: 265, y: 455 },
      { name: 'Backward Point', x: 190, y: 420 },
      { name: 'Cover', x: 185, y: 300 },
      { name: 'Forward Short Leg', x: 345, y: 380 },
      { name: 'Catching Mid-Wicket', x: 395, y: 330 },
      { name: 'Mid Off', x: 250, y: 200 },
      { name: 'Mid On', x: 350, y: 200 },
      { name: 'Deep Sweeper Cover', x: 85, y: 290 },
      { name: 'Deep Mid-Wicket', x: 490, y: 240 },
      { name: 'Deep Backward Square', x: 480, y: 470 },
    ],
  },
};

// Bowler Delivery Tactics Configuration
export const BOWLING_TACTICS_CONFIG: Record<BowlingTactic, {
  name: string;
  category: 'Pace' | 'Spin' | 'Special';
  icon: string;
  color: string;
  seamAngle: number;
  swingFactor: number;
  bounceMultiplier: number;
  speedLabel: string;
  description: string;
}> = {
  OUTSWING: {
    name: 'Outswinger',
    category: 'Pace',
    icon: '↗️',
    color: '#38BDF8',
    seamAngle: -22,
    swingFactor: -4.8,
    bounceMultiplier: 1.0,
    speedLabel: '138-145 km/h',
    description: 'Shapes late away from right-hander into the slip cordon'
  },
  INSWING: {
    name: 'Inswinger',
    category: 'Pace',
    icon: '↖️',
    color: '#FB923C',
    seamAngle: 22,
    swingFactor: 4.8,
    bounceMultiplier: 1.0,
    speedLabel: '138-144 km/h',
    description: 'Jags back sharply into right-hander pads and stumps'
  },
  REVERSE_SWING: {
    name: 'Reverse Swing',
    category: 'Pace',
    icon: '🌪️',
    color: '#F43F5E',
    seamAngle: 28,
    swingFactor: 6.5,
    bounceMultiplier: 0.9,
    speedLabel: '143-150 km/h',
    description: 'Late explosive inward tail at maximum pace'
  },
  SLOWER_BALL: {
    name: 'Slower Knuckle',
    category: 'Pace',
    icon: '🐢',
    color: '#A855F7',
    seamAngle: 0,
    swingFactor: -1.2,
    bounceMultiplier: 0.85,
    speedLabel: '112-118 km/h',
    description: 'Deceptive dip with massive change of pace'
  },
  YORKER: {
    name: 'Toe-Crushing Yorker',
    category: 'Pace',
    icon: '🎯',
    color: '#EAB308',
    seamAngle: 0,
    swingFactor: 0.5,
    bounceMultiplier: 0.3,
    speedLabel: '142-148 km/h',
    description: 'Speared right at the base of the batter popping crease'
  },
  BOUNCER: {
    name: 'Heavy Bouncer',
    category: 'Pace',
    icon: '🚀',
    color: '#EF4444',
    seamAngle: 0,
    swingFactor: 0,
    bounceMultiplier: 1.7,
    speedLabel: '144-150 km/h',
    description: 'Sharp riser climbing fast past batter shoulder/helmet'
  },
  OFF_CUTTER: {
    name: 'Off-Cutter',
    category: 'Pace',
    icon: '✂️',
    color: '#34D399',
    seamAngle: -35,
    swingFactor: -3.5,
    bounceMultiplier: 1.1,
    speedLabel: '122-128 km/h',
    description: 'Rolled over the fingers, grips turf and cuts away'
  },
  LEG_CUTTER: {
    name: 'Leg-Cutter',
    category: 'Pace',
    icon: '🪓',
    color: '#2DD4BF',
    seamAngle: 35,
    swingFactor: 3.5,
    bounceMultiplier: 1.1,
    speedLabel: '122-128 km/h',
    description: 'Nips inward off the pitch off the seam'
  },
  OFF_BREAK: {
    name: 'Flighted Off-Break',
    category: 'Spin',
    icon: '🔄',
    color: '#06B6D4',
    seamAngle: -45,
    swingFactor: -2.0,
    bounceMultiplier: 1.15,
    speedLabel: '86-92 km/h',
    description: 'Classical drift in the air, sharp turn into right-hander'
  },
  DOOSRA: {
    name: 'Doosra (Wrong\'un)',
    category: 'Spin',
    icon: '↩️',
    color: '#EC4899',
    seamAngle: 45,
    swingFactor: 3.2,
    bounceMultiplier: 1.05,
    speedLabel: '88-94 km/h',
    description: 'Turns away from right-hander with off-spinner arm action'
  },
  LEG_BREAK: {
    name: 'Leg-Break Turn',
    category: 'Spin',
    icon: '💫',
    color: '#6366F1',
    seamAngle: 45,
    swingFactor: 2.2,
    bounceMultiplier: 1.2,
    speedLabel: '82-88 km/h',
    description: 'Big drifting leg-break turning from leg to off-stump'
  },
  GOOGLY: {
    name: 'Googly Mystery',
    category: 'Spin',
    icon: '🔮',
    color: '#8B5CF6',
    seamAngle: -45,
    swingFactor: -4.0,
    bounceMultiplier: 1.1,
    speedLabel: '84-90 km/h',
    description: 'Disguised back-of-the-hand spinner turning back in'
  },
  ARM_BALL: {
    name: 'Skidding Arm Ball',
    category: 'Spin',
    icon: '⚡',
    color: '#10B981',
    seamAngle: 10,
    swingFactor: 1.0,
    bounceMultiplier: 0.8,
    speedLabel: '96-102 km/h',
    description: 'Slides straight through rapidly with arm angle'
  },
  TOP_SPINNER: {
    name: 'Top Spinner',
    category: 'Spin',
    icon: '⬆️',
    color: '#F59E0B',
    seamAngle: 0,
    swingFactor: 0,
    bounceMultiplier: 1.5,
    speedLabel: '88-94 km/h',
    description: 'Extra forward dip and steep bouncy loop'
  },
  CARROM_BALL: {
    name: 'Carrom Ball',
    category: 'Spin',
    icon: '💥',
    color: '#D946EF',
    seamAngle: 60,
    swingFactor: 3.8,
    bounceMultiplier: 1.0,
    speedLabel: '92-98 km/h',
    description: 'Flicked with middle finger to zip away quickly'
  },
};

/**
 * Computes dynamic tactical cricket position name based on SVG field coordinate
 */
function getFielderPositionName(x: number, y: number): string {
  const dx = x - 300;
  const dy = y - 410; // Relative to batter crease
  const distFromCenter = Math.hypot(x - 300, y - 300);

  // Wicketkeeper area
  if (Math.abs(x - 300) < 35 && y > 430 && y < 510) return 'Wicketkeeper';

  // Slips & Gully (Off-side behind wicket)
  if (x < 290 && y >= 420) {
    if (distFromCenter > 200) return 'Deep Third Man';
    if (x < 240) return 'Gully';
    return x < 265 ? '2nd Slip' : '1st Slip';
  }

  // Leg-slip / Short fine leg (Leg-side behind wicket)
  if (x > 310 && y >= 420) {
    if (distFromCenter > 200) return 'Deep Fine Leg';
    return x > 380 ? 'Backward Square' : 'Short Fine Leg';
  }

  // Calculate angle around batter in degrees (-180 to 180)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI); // 0 = right (Square Leg), -90 = straight (Bowler), 180 = left (Point)

  const isDeep = distFromCenter > 185;

  if (angle >= -135 && angle < -100) {
    return isDeep ? 'Deep Cover' : 'Extra Cover';
  }
  if (angle >= -170 && angle < -135) {
    return isDeep ? 'Deep Point' : 'Point';
  }
  if (angle >= -100 && angle < -65) {
    return isDeep ? 'Long Off' : 'Mid Off';
  }
  if (angle >= -65 && angle < -35) {
    return isDeep ? 'Long On' : 'Mid On';
  }
  if (angle >= -35 && angle < 10) {
    return isDeep ? 'Deep Mid-Wicket' : 'Mid Wicket';
  }
  if (angle >= 10 && angle < 55) {
    return isDeep ? 'Deep Square Leg' : 'Square Leg';
  }
  if (angle >= 55 && angle < 95) {
    return isDeep ? 'Deep Fine Leg' : 'Short Fine Leg';
  }
  if (angle >= 95 || angle < -170) {
    return isDeep ? 'Deep Backward Point' : 'Backward Point';
  }

  return isDeep ? 'Deep Outfielder' : 'Ring Fielder';
}

export default function CricketActionVisualizer({
  striker,
  nonStriker,
  bowler,
  lastBall,
  ballCount,
  format,
  battingTeamName,
  bowlingTeamName,
  battingTeamShortName,
  teamLogo,
  teamAccentColor,
  isFreeHit = false,
  score,
  wickets,
  overs,
  balls,
  totalOvers,
  target,
  currentRunRate,
  requiredRunRate,
  strikerStats,
  nonStrikerStats,
  bowlerStats,
  recentBalls,
  partnership,
  innings,
  day,
  session,
  lead,
  trail,
  onAnimationComplete,
  speed: propSpeed,
  onSpeedChange,
  className,
  activeBowlingTactic,
  onTacticChange,
}: VisualizerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isAnimatingRef = useRef<boolean>(false);

  // Animation & View Mode Controls
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
  const [speed, setInternalSpeed] = useState<AnimationSpeed>(propSpeed ?? 1);

  useEffect(() => {
    if (propSpeed !== undefined) {
      setInternalSpeed(propSpeed);
    }
  }, [propSpeed]);

  const setSpeed = useCallback((newSpeed: AnimationSpeed) => {
    setInternalSpeed(newSpeed);
    onSpeedChange?.(newSpeed);
  }, [onSpeedChange]);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [showFieldMenu, setShowFieldMenu] = useState<boolean>(false);
  const [showBowlerTactics, setShowBowlerTactics] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<FieldPreset>('BALANCED');
  const [draggedFielderId, setDraggedFielderId] = useState<string | null>(null);
  const [hoveredFielderId, setHoveredFielderId] = useState<string | null>(null);
  
  // Selected Bowler Tactic
  const [selectedTactic, setSelectedTactic] = useState<BowlingTactic>(
    activeBowlingTactic || (bowler?.bowlingStyle?.toLowerCase().includes('spin') ? 'OFF_BREAK' : 'OUTSWING')
  );

  // Sync tactic with prop if passed
  useEffect(() => {
    if (activeBowlingTactic) {
      setSelectedTactic(activeBowlingTactic);
    }
  }, [activeBowlingTactic]);

  // Synchronized Dynamic Fielders state
  const [fielders, setFielders] = useState<FielderPos[]>(() => {
    return FIELD_PRESETS.BALANCED.positions.map((pos, idx) => ({
      id: `fielder-${idx}`,
      name: pos.name,
      role: 'Fielder',
      x: pos.x,
      y: pos.y,
      baseX: pos.x,
      baseY: pos.y,
    }));
  });

  // Animated Entity Coordinates
  const [animState, setAnimState] = useState<AnimatorState>('IDLE');
  const [stateProgress, setStateProgress] = useState<number>(0);
  const [bowlerPos, setBowlerPos] = useState<Point>({ x: 300, y: 120 });
  const [strikerPos, setStrikerPos] = useState<Point>(BATTER_CREASE);
  const [nonStrikerPos, setNonStrikerPos] = useState<Point>(NON_STRIKER_CREASE);
  const [ballPos, setBallPos] = useState<Point>(BOWLER_CREASE);
  const [ballHeight, setBallHeight] = useState<number>(0);
  const [ballScale, setBallScale] = useState<{ x: number; y: number }>({ x: 1, y: 1 });
  const [ballRotation, setBallRotation] = useState<number>(0);
  const [batRotation, setBatRotation] = useState<number>(0);
  const [ballTrail, setBallTrail] = useState<Point[]>([]);
  const [ballVisible, setBallVisible] = useState<boolean>(false);
  const [bailsFly, setBailsFly] = useState<boolean>(false);
  const [impactBurst, setImpactBurst] = useState<Point | null>(null);
  const [boundaryEffect, setBoundaryEffect] = useState<{ x: number; y: number; active: boolean; isSix?: boolean } | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const [activeFielder, setActiveFielder] = useState<FielderPos | null>(null);
  const [activeShot, setActiveShot] = useState<string>('DEFENSIVE_PUSH');

  const isTest = format === 'Test';
  const ballColor = isTest ? '#DC2626' : '#FFFFFF';
  const ballStroke = isTest ? '#7F1D1D' : '#CBD5E1';
  const themePrimary = isTest ? '#DC2626' : '#06B6D4';

  const tacticConfig = BOWLING_TACTICS_CONFIG[selectedTactic] || BOWLING_TACTICS_CONFIG.OUTSWING;

  // Infield vs Outfield fielder balance count
  const fieldCounts = useMemo(() => {
    let infield = 0;
    let outfield = 0;
    fielders.forEach(f => {
      const dist = Math.hypot(f.x - 300, f.y - 300);
      if (dist > 185) outfield++;
      else infield++;
    });
    return { infield, outfield };
  }, [fielders]);

  // Load Preset
  const handleSelectPreset = (presetKey: Exclude<FieldPreset, 'CUSTOM'>) => {
    setActivePreset(presetKey);
    const p = FIELD_PRESETS[presetKey];
    setFielders(p.positions.map((pos, idx) => ({
      id: `fielder-${idx}`,
      name: pos.name,
      role: 'Fielder',
      x: pos.x,
      y: pos.y,
      baseX: pos.x,
      baseY: pos.y,
    })));
  };

  // Select Bowler Tactic
  const handleSelectTactic = (tactic: BowlingTactic) => {
    setSelectedTactic(tactic);
    onTacticChange?.(tactic);
  };

  // Zero-Glitch SVG Coordinate Converter using Screen Matrix
  const getSvgCoordinates = useCallback((clientX: number, clientY: number): Point | null => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 600,
      y: ((clientY - rect.top) / rect.height) * 600,
    };
  }, []);

  // Global Pointer Events for Hand Field Adjustment (Works on mouse, stylus, & touch)
  useEffect(() => {
    if (!draggedFielderId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const coords = getSvgCoordinates(e.clientX, e.clientY);
      if (!coords) return;

      // Constrain within field boundary oval (radius 270)
      const distFromCenter = Math.hypot(coords.x - 300, coords.y - 300);
      const maxR = 265;
      const finalX = distFromCenter > maxR ? 300 + ((coords.x - 300) / distFromCenter) * maxR : coords.x;
      const finalY = distFromCenter > maxR ? 300 + ((coords.y - 300) / distFromCenter) * maxR : coords.y;

      // Auto-compute tactical cricket position name
      const dynamicName = getFielderPositionName(finalX, finalY);

      setActivePreset('CUSTOM');
      setFielders(prev => prev.map(f => {
        if (f.id === draggedFielderId) {
          return {
            ...f,
            name: dynamicName,
            x: Math.round(finalX),
            y: Math.round(finalY),
            baseX: Math.round(finalX),
            baseY: Math.round(finalY),
          };
        }
        return f;
      }));
    };

    const handlePointerUp = () => {
      setDraggedFielderId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggedFielderId, getSvgCoordinates]);

  /**
   * 360-Degree Wagon Wheel Shot Calculation:
   * Generates realistic, diverse angle trajectories covering all directions around the ground:
   * Off-side, leg-side, straight down the ground, behind square, fine leg, third man, etc.
   */
  const get360ShotTrajectoryData = useCallback((runs: number, isWicket: boolean, isExtra: boolean, extraType?: string) => {
    if (isExtra && (extraType === 'Wide' || extraType === 'No Ball')) {
      const isWideOff = Math.random() > 0.5;
      return {
        shot: extraType.toUpperCase(),
        bouncePoint: { x: isWideOff ? 345 : 255, y: 310 },
        targetPoint: { x: isWideOff ? 365 : 235, y: 465 },
        isBoundary: false,
        isAerial: false,
        duration: 850,
      };
    }

    if (isWicket) {
      return {
        shot: 'WICKET_DELIVERY',
        bouncePoint: { x: 300, y: 325 },
        targetPoint: { x: 300, y: 420 },
        isBoundary: false,
        isAerial: false,
        duration: 900,
      };
    }

    // ── 360° Wagon Wheel Calculation based on runs
    if (runs === 6) {
      const sixShots = [
        { name: 'LOFTED_COVER_DRIVE_SIX', angleDeg: -65, label: 'Lofted Cover Drive' },
        { name: 'STRAIGHT_LONG_OFF_SIX', angleDeg: -20, label: 'Straight Long-Off' },
        { name: 'DOWNHILL_LONG_ON_SIX', angleDeg: 15, label: 'Monster Long-On' },
        { name: 'DEEP_MID_WICKET_SIX', angleDeg: 55, label: 'Huge Pull over Mid-Wicket' },
        { name: 'COW_CORNER_SLOG_SIX', angleDeg: 75, label: 'Slog Sweep into Stands' },
        { name: 'PULL_OVER_SQUARE_LEG_SIX', angleDeg: 95, label: 'Hooked over Square Leg' },
        { name: 'UPPER_CUT_THIRD_MAN_SIX', angleDeg: -130, label: 'Upper Cut over Third Man' },
        { name: 'FINE_LEG_SCOOP_SIX', angleDeg: 145, label: 'Ramp Scoop over Fine Leg' },
      ];
      const selected = sixShots[Math.floor(Math.random() * sixShots.length)];
      const rad = (selected.angleDeg - 90) * (Math.PI / 180);
      const r = 295; // Over boundary rope
      const targetPoint = {
        x: Math.round(300 + Math.cos(rad) * r),
        y: Math.round(410 + Math.sin(rad) * r),
      };

      return {
        shot: selected.name,
        bouncePoint: { x: 300, y: 330 },
        targetPoint,
        isBoundary: true,
        isAerial: true,
        duration: 1500,
      };
    }

    if (runs === 4) {
      const fourShots = [
        { name: 'COVER_DRIVE_FOUR', angleDeg: -55, label: 'Crisp Cover Drive' },
        { name: 'EXTRA_COVER_FOUR', angleDeg: -40, label: 'Punched through Extra Cover' },
        { name: 'STRAIGHT_DRIVE_FOUR', angleDeg: -5, label: 'Pure Straight Drive' },
        { name: 'ON_DRIVE_FOUR', angleDeg: 25, label: 'Firm On-Drive' },
        { name: 'MID_WICKET_PULL_FOUR', angleDeg: 65, label: 'Powerful Pull Shot' },
        { name: 'SQUARE_CUT_FOUR', angleDeg: -95, label: 'Flashing Square Cut' },
        { name: 'LATE_CUT_THIRD_MAN_FOUR', angleDeg: -135, label: 'Guided to Third Man' },
        { name: 'SQUARE_LEG_FLICK_FOUR', angleDeg: 100, label: 'Whipped through Square Leg' },
        { name: 'FINE_LEG_GLANCE_FOUR', angleDeg: 140, label: 'Tickled to Fine Leg' },
      ];
      const selected = fourShots[Math.floor(Math.random() * fourShots.length)];
      const rad = (selected.angleDeg - 90) * (Math.PI / 180);
      const r = BOUNDARY_RADIUS;
      const targetPoint = {
        x: Math.round(300 + Math.cos(rad) * r),
        y: Math.round(410 + Math.sin(rad) * r),
      };

      return {
        shot: selected.name,
        bouncePoint: { x: 300, y: 330 },
        targetPoint,
        isBoundary: true,
        isAerial: false,
        duration: 1350,
      };
    }

    if (runs === 1 || runs === 2 || runs === 3) {
      const runningShots = [
        { name: 'COVER_POINT_PUSH', angleDeg: -75, dist: 130 },
        { name: 'MID_OFF_DRIVE', angleDeg: -25, dist: 150 },
        { name: 'MID_ON_TAP', angleDeg: 20, dist: 150 },
        { name: 'MID_WICKET_NUDGE', angleDeg: 55, dist: 120 },
        { name: 'SQUARE_LEG_CLIP', angleDeg: 90, dist: 110 },
        { name: 'FINE_LEG_SINGLE', angleDeg: 130, dist: 120 },
        { name: 'THIRD_MAN_STEER', angleDeg: -125, dist: 130 },
      ];
      const selected = runningShots[Math.floor(Math.random() * runningShots.length)];
      const rad = (selected.angleDeg - 90) * (Math.PI / 180);
      const targetPoint = {
        x: Math.round(300 + Math.cos(rad) * selected.dist),
        y: Math.round(410 + Math.sin(rad) * selected.dist),
      };

      return {
        shot: selected.name,
        bouncePoint: { x: 300, y: 330 },
        targetPoint,
        isBoundary: false,
        isAerial: false,
        duration: 1050,
      };
    }

    // Dot Ball / Defensive Block / Miss
    const dotShots = [
      { name: 'FORWARD_DEFENSE', target: { x: 295, y: 390 } },
      { name: 'BACKFOOT_BLOCK', target: { x: 305, y: 400 } },
      { name: 'LEAVE_OUTSIDE_OFF', target: { x: 300, y: 460 } },
      { name: 'PLAYED_AND_MISSED', target: { x: 300, y: 460 } },
    ];
    const selected = dotShots[Math.floor(Math.random() * dotShots.length)];

    return {
      shot: selected.name,
      bouncePoint: { x: 300, y: 340 },
      targetPoint: selected.target,
      isBoundary: false,
      isAerial: false,
      duration: 850,
    };
  }, []);

  // Main 60-FPS Delivery Animation Sequence with Bowler Swing & Trajectory Physics
  const runDeliveryAnimation = useCallback(() => {
    if (!lastBall || speed === 0) {
      if (lastBall) {
        setResultBanner(lastBall.isWicket ? 'WICKET!' : lastBall.runs === 6 ? 'SIX!' : lastBall.runs === 4 ? 'FOUR!' : `${lastBall.runs} RUNS`);
      }
      onAnimationComplete?.();
      return;
    }

    const { runs, isWicket, isExtra, extraType, wicketType } = lastBall;
    const trajectoryData = get360ShotTrajectoryData(runs, isWicket, isExtra, extraType);
    setActiveShot(trajectoryData.shot);

    const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 0.5 : 0.25;
    const totalDuration = trajectoryData.duration * speedMultiplier;

    // Bowler tactic specific physics
    const currentTactic = lastBall.bowlingTactic || selectedTactic;
    const currentTacticData = BOWLING_TACTICS_CONFIG[currentTactic] || BOWLING_TACTICS_CONFIG.OUTSWING;

    // Pitch landing adjustment based on tactic
    let pitchBounceY = 325;
    let pitchBounceX = 300;
    if (currentTactic === 'YORKER') pitchBounceY = 395;
    else if (currentTactic === 'BOUNCER') pitchBounceY = 270;
    else if (currentTactic === 'OUTSWING' || currentTactic === 'OFF_CUTTER') pitchBounceX = 308;
    else if (currentTactic === 'INSWING' || currentTactic === 'LEG_CUTTER') pitchBounceX = 292;

    let startTime: number | null = null;
    isAnimatingRef.current = true;
    setBallVisible(true);
    setBailsFly(false);
    setBoundaryEffect(null);
    setImpactBurst(null);
    setResultBanner(null);
    setBallTrail([]);

    // Initial positions
    setBowlerPos({ x: 300, y: 120 });
    setStrikerPos(BATTER_CREASE);
    setNonStrikerPos(NON_STRIKER_CREASE);
    setBallPos(BOWLER_CREASE);

    // Identify nearest fielder to target location
    const target = trajectoryData.targetPoint;
    let closestFielderIdx = 0;
    let minDist = Infinity;
    fielders.forEach((f, idx) => {
      const dist = Math.hypot(f.x - target.x, f.y - target.y);
      if (dist < minDist) {
        minDist = dist;
        closestFielderIdx = idx;
      }
    });
    setActiveFielder(fielders[closestFielderIdx]);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / totalDuration);
      setStateProgress(Math.round(progress * 100));

      // ── 1. Bowler Run-Up (0.00 - 0.25)
      if (progress < 0.25) {
        setAnimState('BOWLER_RUNUP');
        const pNorm = progress / 0.25;
        const bY = 120 + (pNorm * pNorm * 65);
        setBowlerPos({ x: 300, y: bY });
        setBallPos({ x: 300, y: bY + 10 });
        setBallHeight(0);
      }

      // ── 2. Delivery Release & Flight with Tactic Swing / Curve (0.25 - 0.50)
      else if (progress < 0.50) {
        setAnimState('BALL_FLIGHT');
        const pFlight = (progress - 0.25) / 0.25;
        const startP = BOWLER_CREASE;
        const bounceP = { x: pitchBounceX, y: pitchBounceY };

        // Swing curvature curve based on selected bowling tactic
        const swingCurve = currentTacticData.swingFactor * Math.sin(pFlight * Math.PI) * 2.2;
        const curX = startP.x + (bounceP.x - startP.x) * pFlight + swingCurve;
        const curY = startP.y + (bounceP.y - startP.y) * pFlight;

        setBallPos({ x: curX, y: curY });
        setBallHeight(Math.sin(pFlight * Math.PI) * (14 * currentTacticData.bounceMultiplier));
        setBallScale({ x: 1, y: 1 });
        setBallRotation(currentTacticData.seamAngle);

        setBallTrail(prev => [...prev.slice(-10), { x: curX, y: curY }]);
      }

      // ── 3. Pitch Bounce to Bat Contact (0.50 - 0.65)
      else if (progress < 0.65) {
        setAnimState('BOUNCE');
        const pBounce = (progress - 0.50) / 0.15;
        const bounceP = { x: pitchBounceX, y: pitchBounceY };
        const batterP = BATTER_CREASE;

        // Post-bounce deviation (Off-spin turns in, leg-spin turns away)
        let postBounceDev = 0;
        if (currentTactic === 'OFF_BREAK' || currentTactic === 'GOOGLY') postBounceDev = pBounce * 6;
        else if (currentTactic === 'LEG_BREAK' || currentTactic === 'DOOSRA') postBounceDev = -pBounce * 6;

        const curX = bounceP.x + (batterP.x - bounceP.x) * pBounce + postBounceDev;
        const curY = bounceP.y + (batterP.y - bounceP.y) * pBounce;

        setBallPos({ x: curX, y: curY });

        // Turf squash
        if (pBounce < 0.15) {
          setBallScale({ x: 1.35, y: 0.65 });
        } else {
          setBallScale({ x: 1, y: 1 });
        }

        const apexHeight = currentTactic === 'BOUNCER' ? 24 : currentTactic === 'YORKER' ? 4 : 10;
        setBallHeight(Math.sin(pBounce * Math.PI) * apexHeight);

        // Batter backswing anticipation
        setBatRotation(Math.sin(pBounce * Math.PI) * -38);
        setBallTrail(prev => [...prev.slice(-8), { x: curX, y: curY }]);
      }

      // ── 4. Bat Contact & Shot Travel (0.65 - 0.90)
      else if (progress < 0.90) {
        setAnimState('BALL_FIELD_TRAVEL');
        const pTravel = (progress - 0.65) / 0.25;
        const startBat = BATTER_CREASE;
        const endTarget = trajectoryData.targetPoint;

        // Trigger impact burst once
        if (pTravel < 0.1 && !impactBurst) {
          setImpactBurst({ x: startBat.x, y: startBat.y });
        }

        const curX = startBat.x + (endTarget.x - startBat.x) * pTravel;
        const curY = startBat.y + (endTarget.y - startBat.y) * pTravel;

        if (trajectoryData.isAerial) {
          // 3D Parabolic Six Arc
          const arcHeight = Math.sin(pTravel * Math.PI) * 75;
          setBallHeight(arcHeight);
          const depthScale = 1.0 + (arcHeight / 80) * 0.75;
          setBallScale({ x: depthScale, y: depthScale });
        } else {
          // Four / Rolling ground ball with grass skips
          let groundSkip = 0;
          if (pTravel < 0.35) {
            groundSkip = Math.sin((pTravel / 0.35) * Math.PI) * 6;
          } else if (pTravel < 0.70) {
            groundSkip = Math.sin(((pTravel - 0.35) / 0.35) * Math.PI) * 3;
          }
          setBallHeight(groundSkip);
          setBallScale({ x: 1, y: 1 });
          setBallRotation(prev => prev + 35);
        }

        setBallPos({ x: curX, y: curY });
        setBatRotation(Math.sin((1 - pTravel) * Math.PI) * 25);
        setBallTrail(prev => [...prev.slice(-12), { x: curX, y: curY }]);

        // Fielder moves smoothly toward intercept point
        setFielders(prev => prev.map((f, i) => {
          if (i === closestFielderIdx) {
            const lerpX = f.baseX + (endTarget.x - f.baseX) * (pTravel * 0.88);
            const lerpY = f.baseY + (endTarget.y - f.baseY) * (pTravel * 0.88);
            return { ...f, x: lerpX, y: lerpY };
          }
          return f;
        }));

        // Batters running between wickets
        if (runs > 0 && !isWicket) {
          const runCycle = Math.min(1, pTravel * (runs >= 2 ? 1.8 : 1.0));
          const sY = BATTER_CREASE.y - (runCycle * (BATTER_CREASE.y - NON_STRIKER_CREASE.y));
          const nsY = NON_STRIKER_CREASE.y + (runCycle * (BATTER_CREASE.y - NON_STRIKER_CREASE.y));
          setStrikerPos({ x: 300, y: sY });
          setNonStrikerPos({ x: 300, y: nsY });
        }

        // Bowled dismissal bails fly
        if (isWicket && wicketType?.toLowerCase().includes('bowled')) {
          setBailsFly(true);
        }
      }

      // ── 5. Final Result & Boundary Impact (0.90 - 1.00)
      else {
        setAnimState('RESULT');
        if (trajectoryData.isBoundary) {
          setBoundaryEffect({ 
            x: trajectoryData.targetPoint.x, 
            y: trajectoryData.targetPoint.y, 
            active: true,
            isSix: trajectoryData.isAerial 
          });
        }

        if (isWicket) {
          setResultBanner(wicketType?.toUpperCase() || 'WICKET!');
        } else if (runs === 6) {
          setResultBanner('SIX!');
        } else if (runs === 4) {
          setResultBanner('FOUR!');
        } else if (runs > 0) {
          setResultBanner(`${runs} RUN${runs > 1 ? 'S' : ''}`);
        } else {
          setResultBanner('DOT BALL');
        }
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        isAnimatingRef.current = false;
        onAnimationComplete?.();
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [lastBall, speed, selectedTactic, get360ShotTrajectoryData, fielders, onAnimationComplete]);

  // Trigger on new delivery
  useEffect(() => {
    if (ballCount > 0) {
      runDeliveryAnimation();
    }
  }, [ballCount, runDeliveryAnimation]);

  // Default to High-Performance 3D Stadium Match Engine
  if (viewMode === '3D') {
    return (
      <CricketActionVisualizer3D
        striker={striker}
        nonStriker={nonStriker}
        bowler={bowler}
        lastBall={lastBall}
        ballCount={ballCount}
        format={format}
        battingTeamName={battingTeamName}
        bowlingTeamName={bowlingTeamName}
        battingTeamShortName={battingTeamShortName}
        teamLogo={teamLogo}
        teamAccentColor={teamAccentColor}
        isFreeHit={isFreeHit}
        score={score}
        wickets={wickets}
        overs={overs}
        balls={balls}
        totalOvers={totalOvers}
        target={target}
        currentRunRate={currentRunRate}
        requiredRunRate={requiredRunRate}
        strikerStats={strikerStats}
        nonStrikerStats={nonStrikerStats}
        bowlerStats={bowlerStats}
        recentBalls={recentBalls}
        partnership={partnership}
        innings={innings}
        day={day}
        session={session}
        lead={lead}
        trail={trail}
        onAnimationComplete={onAnimationComplete}
        speed={speed}
        onSpeedChange={setSpeed}
        className={className}
        activeBowlingTactic={activeBowlingTactic}
        onTacticChange={onTacticChange}
        onToggle2D={() => setViewMode('2D')}
      />
    );
  }

  return (
    <div className={cn("relative flex flex-col items-center select-none bg-[#040814] rounded-2xl overflow-hidden border border-white/10 shadow-2xl touch-none", className)}>
      {/* ── Broadcast Top Bar ── */}
      <div className="w-full px-4 py-2.5 bg-black/70 backdrop-blur-md border-b border-white/5 flex items-center justify-between z-30 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isTest ? "bg-red-500" : "bg-cyan-400")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
            {format} 360° LIVE ARENA
          </span>
          {isFreeHit && (
            <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-black uppercase animate-bounce">
              Free Hit
            </span>
          )}
        </div>

        {/* Tactical Controls (Field Setup, 3D Toggle, & Bowler Options) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Switch to 3D */}
          <button
            onClick={() => setViewMode('3D')}
            className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-cyan-500 hover:bg-cyan-400 text-black shadow-md border border-cyan-300 transition-all flex items-center gap-1"
            title="Switch to 3D Real-Time Broadcast View"
          >
            <span>🏟️</span> 3D Arena
          </button>

          {/* Bowler Tactics Button */}
          <button
            onClick={() => { setShowBowlerTactics(!showBowlerTactics); setShowFieldMenu(false); }}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border",
              showBowlerTactics 
                ? "bg-amber-500 text-black border-amber-400 font-black shadow-md" 
                : "bg-white/5 border-white/10 text-white/80 hover:text-white"
            )}
            title="Choose Bowling Style & Swing Options"
          >
            <span>{tacticConfig.icon}</span>
            <span>Tactic: {tacticConfig.name.split(' ')[0]}</span>
          </button>

          {/* Field Setup Button */}
          <button
            onClick={() => { setShowFieldMenu(!showFieldMenu); setShowBowlerTactics(false); }}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border",
              showFieldMenu || activePreset === 'CUSTOM'
                ? "bg-cyan-500 text-black border-cyan-400 font-black shadow-md" 
                : "bg-white/5 border-white/10 text-white/80 hover:text-white"
            )}
            title="Configure Field Setup or Drag Fielders by Hand"
          >
            <Shield className="w-3 h-3" />
            <span>Field: {activePreset === 'CUSTOM' ? 'Custom ✍️' : FIELD_PRESETS[activePreset]?.name.split(' ')[0]}</span>
          </button>

          {/* Speed Controls */}
          {([1, 2, 4] as AnimationSpeed[]).map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeed(sp)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                speed === sp ? "bg-white text-black font-black shadow-sm" : "bg-white/5 text-white/50 hover:text-white"
              )}
            >
              {sp}x
            </button>
          ))}

          <button
            onClick={() => setSpeed(0)}
            className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
              speed === 0 ? "bg-amber-400 text-black font-black" : "bg-white/5 text-white/50 hover:text-white"
            )}
            title="Instant Simulation"
          >
            Skip
          </button>

          <button
            onClick={() => setDebugMode(!debugMode)}
            className={cn(
              "p-1 rounded text-white/40 hover:text-white transition-colors ml-0.5",
              debugMode && "text-cyan-400"
            )}
            title="Toggle Debug HUD"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Bowler Tactics Selector Drawer ── */}
      <AnimatePresence>
        {showBowlerTactics && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full bg-[#071126] border-b border-white/10 px-4 py-3 z-30 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-amber-400" /> Select Bowling Variation, Seam & Swing Options
              </span>
              <span className="text-[9px] text-white/50">
                Current: <strong className="text-white">{tacticConfig.name}</strong> ({tacticConfig.speedLabel})
              </span>
            </div>

            {/* Categorized Options */}
            <div className="space-y-2">
              <div>
                <span className="text-[8px] font-black uppercase tracking-wider text-cyan-400 block mb-1">Fast / Swing / Seam Variations</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['OUTSWING', 'INSWING', 'REVERSE_SWING', 'YORKER', 'BOUNCER', 'SLOWER_BALL', 'OFF_CUTTER', 'LEG_CUTTER'] as BowlingTactic[]).map((tac) => {
                    const cfg = BOWLING_TACTICS_CONFIG[tac];
                    const isSel = selectedTactic === tac;
                    return (
                      <button
                        key={tac}
                        onClick={() => handleSelectTactic(tac)}
                        className={cn(
                          "p-1.5 rounded-lg text-left border transition-all flex items-center justify-between gap-1",
                          isSel 
                            ? "bg-amber-500/20 border-amber-400 text-amber-200 font-black shadow-md" 
                            : "bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center gap-1 truncate">
                          <span className="text-xs">{cfg.icon}</span>
                          <span className="text-[10px] truncate">{cfg.name}</span>
                        </div>
                        {isSel && <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[8px] font-black uppercase tracking-wider text-purple-400 block mb-1">Spin & Mystery Variations</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['OFF_BREAK', 'DOOSRA', 'LEG_BREAK', 'GOOGLY', 'ARM_BALL', 'TOP_SPINNER', 'CARROM_BALL'] as BowlingTactic[]).map((tac) => {
                    const cfg = BOWLING_TACTICS_CONFIG[tac];
                    const isSel = selectedTactic === tac;
                    return (
                      <button
                        key={tac}
                        onClick={() => handleSelectTactic(tac)}
                        className={cn(
                          "p-1.5 rounded-lg text-left border transition-all flex items-center justify-between gap-1",
                          isSel 
                            ? "bg-purple-500/20 border-purple-400 text-purple-200 font-black shadow-md" 
                            : "bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center gap-1 truncate">
                          <span className="text-xs">{cfg.icon}</span>
                          <span className="text-[10px] truncate">{cfg.name}</span>
                        </div>
                        {isSel && <CheckCircle2 className="w-3 h-3 text-purple-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Field Preset & Hand Adjustment Drawer ── */}
      <AnimatePresence>
        {showFieldMenu && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full bg-[#080f22] border-b border-white/10 px-4 py-3 z-30 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                <Move className="w-3 h-3" /> Tactical Field Setup Presets (or drag any fielder by hand on pitch)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/50">
                  Ring: <strong className="text-cyan-300">{fieldCounts.infield}</strong> · Deep: <strong className="text-amber-300">{fieldCounts.outfield}</strong>
                </span>
                <button
                  onClick={() => handleSelectPreset('BALANCED')}
                  className="text-[9px] font-bold text-white/50 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
                  title="Reset Field to Default Balanced"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(FIELD_PRESETS) as Exclude<FieldPreset, 'CUSTOM'>[]).map((pKey) => {
                const preset = FIELD_PRESETS[pKey];
                return (
                  <button
                    key={pKey}
                    onClick={() => handleSelectPreset(pKey)}
                    className={cn(
                      "p-2 rounded-xl text-left border transition-all text-xs flex flex-col gap-0.5",
                      activePreset === pKey 
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 font-black shadow-lg" 
                        : "bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-1 font-bold text-[11px]">
                      <span>{preset.icon}</span>
                      <span className="truncate">{preset.name.split(' ')[0]}</span>
                    </div>
                    <span className="text-[8px] text-white/40">{preset.name.split('(')[1]?.replace(')', '') || 'Preset'}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 360-Degree Stadium SVG Canvas (600 x 600) with Flawless Hand Drag ── */}
      <div className="relative w-full aspect-square max-w-[520px] overflow-hidden flex items-center justify-center p-2 touch-none">
        <svg
          ref={svgRef}
          viewBox="0 0 600 600"
          className="w-full h-full drop-shadow-[0_0_40px_rgba(0,0,0,0.9)] cursor-crosshair select-none"
        >
          <defs>
            {/* Field Turf Radial Gradient */}
            <radialGradient id="fieldGrad360" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e3b1e" />
              <stop offset="65%" stopColor="#132713" />
              <stop offset="100%" stopColor="#0a160a" />
            </radialGradient>

            {/* Pitch Texture Gradient */}
            <linearGradient id="pitchGrad360" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#bfa175" />
              <stop offset="25%" stopColor="#d5b889" />
              <stop offset="75%" stopColor="#d5b889" />
              <stop offset="100%" stopColor="#bfa175" />
            </linearGradient>

            {/* Ball Glow Filter */}
            <filter id="ballGlow360" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Ground Shadow Filter */}
            <filter id="shadowFilter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.5 0"/>
            </filter>
          </defs>

          {/* 1. Outer Stadium & Boundary Rope */}
          <circle cx="300" cy="300" r="280" fill="url(#fieldGrad360)" stroke="#1a331a" strokeWidth="6" />
          
          {/* Inner 30-Yard Circle */}
          <ellipse
            cx="300"
            cy="300"
            rx="160"
            ry="190"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Boundary Rope with LED Ring */}
          <circle
            cx="300"
            cy="300"
            r={BOUNDARY_RADIUS}
            fill="none"
            stroke={boundaryEffect?.active ? themePrimary : "rgba(255,255,255,0.22)"}
            strokeWidth={boundaryEffect?.active ? "4.5" : "2"}
            className="transition-all duration-300"
          />

          {/* 2. Cricket Pitch Strip */}
          <rect
            x="272"
            y="170"
            width="56"
            height="260"
            rx="4"
            fill="url(#pitchGrad360)"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1"
          />

          {/* Crease Markings */}
          {/* Bowler End */}
          <line x1="260" y1="190" x2="340" y2="190" stroke="white" strokeWidth="1.5" />
          <line x1="280" y1="180" x2="280" y2="190" stroke="white" strokeWidth="1" />
          <line x1="320" y1="180" x2="320" y2="190" stroke="white" strokeWidth="1" />
          <circle cx="300" cy="180" r="2" fill="#EAB308" />

          {/* Batter End (Popping Crease) */}
          <line x1="260" y1="410" x2="340" y2="410" stroke="white" strokeWidth="1.5" />
          <line x1="280" y1="410" x2="280" y2="425" stroke="white" strokeWidth="1" />
          <line x1="320" y1="410" x2="320" y2="425" stroke="white" strokeWidth="1" />
          
          {/* Stumps & Bails at Batter End */}
          <rect x="296" y="420" width="8" height="3" fill="#D97706" rx="1" />
          {bailsFly ? (
            <motion.circle 
              initial={{ cx: 300, cy: 420 }} 
              animate={{ cx: 318, cy: 442, opacity: 0 }} 
              transition={{ duration: 0.65 }}
              r="2" 
              fill="#F59E0B" 
            />
          ) : (
            <line x1="295" y1="420" x2="305" y2="420" stroke="#FDE68A" strokeWidth="1.5" />
          )}

          {/* 3. Ball Trajectory Flight Trail (Color coded by bowler tactic) */}
          {ballTrail.length > 1 && (
            <polyline
              points={ballTrail.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={tacticConfig.color}
              strokeWidth="2"
              strokeDasharray="3 3"
              opacity="0.65"
            />
          )}

          {/* 4. Fielders (Draggable & Interactive by Hand) */}
          {fielders.map((fielder) => {
            const isDragging = draggedFielderId === fielder.id;
            const isHovered = hoveredFielderId === fielder.id;
            const isActive = activeFielder?.id === fielder.id;

            return (
              <g 
                key={fielder.id} 
                transform={`translate(${fielder.x}, ${fielder.y})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                  setDraggedFielderId(fielder.id);
                }}
                onPointerEnter={() => setHoveredFielderId(fielder.id)}
                onPointerLeave={() => setHoveredFielderId(null)}
                className="cursor-grab active:cursor-grabbing transition-transform"
              >
                {/* Touch/Drag highlight target */}
                {(isDragging || isHovered) && (
                  <circle
                    r="16"
                    fill={isDragging ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.15)"}
                    className="animate-pulse"
                  />
                )}
                
                <circle
                  r="7.5"
                  fill="#1E293B"
                  stroke={isDragging ? "#38BDF8" : isActive ? themePrimary : "rgba(255,255,255,0.5)"}
                  strokeWidth={isDragging ? "3" : isActive ? "2.5" : "1.2"}
                />
                <circle r="3.2" fill={isDragging ? "#38BDF8" : isActive ? themePrimary : "#94A3B8"} />
                
                {/* Fielder Name Badge (Always visible on hover/drag or in debug mode) */}
                {(isDragging || isHovered || debugMode) && (
                  <g transform="translate(10, 3)">
                    <rect x="-2" y="-9" width={fielder.name.length * 5.5 + 8} height="13" rx="3" fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                    <text x="2" y="0" fill="#38BDF8" fontSize="8" fontWeight="bold">
                      {fielder.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 5. Non-Striker */}
          <g transform={`translate(${nonStrikerPos.x + 16}, ${nonStrikerPos.y})`}>
            <circle r="7.5" fill="#0284C7" stroke="white" strokeWidth="1.5" />
            <circle r="3" fill="white" />
          </g>

          {/* 6. Bowler */}
          <g transform={`translate(${bowlerPos.x - 16}, ${bowlerPos.y})`}>
            <circle r="8" fill="#DC2626" stroke="white" strokeWidth="1.5" />
            <circle r="3" fill="white" />
          </g>

          {/* 7. Striker & Bat */}
          <g transform={`translate(${strikerPos.x}, ${strikerPos.y})`}>
            <circle r="8.5" fill="#2563EB" stroke="white" strokeWidth="1.5" />
            <circle r="3.5" fill="white" />
            {/* Bat */}
            <line
              x1="0"
              y1="0"
              x2="13"
              y2="-6"
              stroke="#F59E0B"
              strokeWidth="2.8"
              strokeLinecap="round"
              transform={`rotate(${batRotation})`}
            />
          </g>

          {/* 8. Ground Shadow (Underneath aerial balls for 3D depth) */}
          {ballVisible && ballHeight > 0 && (
            <ellipse
              cx={ballPos.x}
              cy={ballPos.y}
              rx={4 + (ballHeight * 0.1)}
              ry={2 + (ballHeight * 0.05)}
              fill="black"
              opacity={Math.max(0.15, 0.45 - (ballHeight * 0.005))}
              filter="url(#shadowFilter)"
            />
          )}

          {/* 9. Cricket Ball (Ultra-smooth 60fps transform) */}
          {ballVisible && (
            <g
              transform={`translate(${ballPos.x}, ${ballPos.y - ballHeight}) scale(${ballScale.x}, ${ballScale.y})`}
            >
              <circle
                r={isTest ? 4.8 : 4.2}
                fill={ballColor}
                stroke={ballStroke}
                strokeWidth="1.2"
                filter="url(#ballGlow360)"
              />
              {/* Ball Seam */}
              <line
                x1="-3.2"
                y1="0"
                x2="3.2"
                y2="0"
                stroke={isTest ? "#FFFFFF" : "#CBD5E1"}
                strokeWidth="0.9"
                transform={`rotate(${ballRotation})`}
              />
            </g>
          )}

          {/* 10. Bat Impact Burst */}
          {impactBurst && (
            <circle
              cx={impactBurst.x}
              cy={impactBurst.y}
              r="14"
              fill="none"
              stroke="#FDE047"
              strokeWidth="2.5"
              className="animate-ping"
            />
          )}

          {/* 11. Boundary LED Ripple (Fours & Sixes) */}
          {boundaryEffect?.active && (
            <g>
              <circle
                cx={boundaryEffect.x}
                cy={boundaryEffect.y}
                r={boundaryEffect.isSix ? "36" : "24"}
                fill="none"
                stroke={boundaryEffect.isSix ? "#C084FC" : themePrimary}
                strokeWidth="3.5"
                className="animate-ping"
              />
              <circle
                cx={boundaryEffect.x}
                cy={boundaryEffect.y}
                r="12"
                fill={boundaryEffect.isSix ? "rgba(192, 132, 252, 0.4)" : "rgba(6, 182, 212, 0.4)"}
              />
            </g>
          )}
        </svg>

        {/* ── Action Result Notification Banner ── */}
        <AnimatePresence>
          {resultBanner && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-7 py-3 rounded-2xl backdrop-blur-xl border font-black text-2xl tracking-wider shadow-2xl z-40 text-center pointer-events-none flex items-center gap-2",
                resultBanner.includes('SIX') && "bg-purple-950/85 border-purple-400 text-purple-200 shadow-purple-500/40 text-3xl animate-pulse",
                resultBanner.includes('FOUR') && "bg-blue-950/85 border-blue-400 text-blue-200 shadow-blue-500/40 text-3xl",
                resultBanner.includes('WICKET') && "bg-red-950/90 border-red-500 text-red-100 shadow-red-500/50 text-3xl",
                resultBanner.includes('RUN') && "bg-zinc-900/85 border-white/20 text-white text-xl",
                resultBanner.includes('DOT') && "bg-black/85 border-white/10 text-white/70 text-base"
              )}
            >
              {resultBanner.includes('SIX') && <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />}
              {resultBanner}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Debug Overlay HUD ── */}
        {debugMode && (
          <div className="absolute top-12 left-3 bg-black/90 border border-white/10 rounded-xl p-3 text-[9px] font-mono text-cyan-300 space-y-0.5 z-40 pointer-events-none shadow-xl">
            <div>STATE: <span className="text-white font-bold">{animState}</span></div>
            <div>PROGRESS: <span className="text-white font-bold">{stateProgress}%</span></div>
            <div>TACTIC: <span className="text-amber-300 font-bold">{tacticConfig.name}</span></div>
            <div>SHOT: <span className="text-white font-bold">{activeShot}</span></div>
            <div>PRESET: <span className="text-white font-bold">{activePreset}</span></div>
            <div>BALL POS: <span className="text-white font-bold">X:{Math.round(ballPos.x)} Y:{Math.round(ballPos.y)} H:{Math.round(ballHeight)}</span></div>
            <div>INTERCEPT FIELDER: <span className="text-white font-bold">{activeFielder?.name || 'NONE'}</span></div>
          </div>
        )}
      </div>

      {/* ── Broadcast Footer ── */}
      <div className="w-full px-4 py-2.5 bg-black/80 backdrop-blur-md border-t border-white/5 flex items-center justify-between text-xs text-white/80 z-30 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{striker?.name || 'Striker'}</span>
          <span className="text-white/40 text-[10px]">facing</span>
          <span className="font-bold text-cyan-400">{bowler?.name || 'Bowler'}</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase">
          <span>Tactic: <strong className="text-amber-300">{tacticConfig.name}</strong></span>
          <span>•</span>
          <span>Field: <strong className="text-cyan-300">{activePreset === 'CUSTOM' ? 'Custom ✍️' : FIELD_PRESETS[activePreset]?.name.split(' ')[0]}</strong></span>
          <span>•</span>
          <span>Shot: <strong className="text-white">{activeShot.replace(/_/g, ' ')}</strong></span>
        </div>
      </div>
    </div>
  );
}
