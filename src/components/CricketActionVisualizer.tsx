import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Sparkles
} from 'lucide-react';
import { BallOutcome } from '../types/match';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { cn } from '../lib/utils';

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

export type FieldPreset = 'BALANCED' | 'POWERPLAY' | 'ATTACKING_TEST' | 'DEATH_OVERS' | 'SPIN_TRAP';

export interface VisualizerProps {
  striker: Player | null;
  nonStriker: Player | null;
  bowler: Player | null;
  lastBall: (BallOutcome & { runs: number; isWicket?: boolean; wicketType?: string; isExtra?: boolean; extraType?: string }) | null;
  ballCount: number;
  format: ArenaFormat;
  battingTeamName: string;
  bowlingTeamName: string;
  isFreeHit?: boolean;
  onAnimationComplete?: () => void;
  className?: string;
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

// Field Presets for full 360-degree field tactical setup
const FIELD_PRESETS: Record<FieldPreset, { name: string; icon: string; positions: { name: string; x: number; y: number }[] }> = {
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
      { name: 'First Slip', x: 260, y: 470 },
      { name: 'Second Slip', x: 235, y: 485 },
      { name: 'Backward Point', x: 180, y: 420 },
      { name: 'Cover Point', x: 195, y: 330 },
      { name: 'Extra Cover', x: 220, y: 250 },
      { name: 'Mid Off', x: 260, y: 190 },
      { name: 'Mid On', x: 340, y: 190 },
      { name: 'Mid Wicket', x: 380, y: 260 },
      { name: 'Square Leg', x: 410, y: 370 },
      { name: 'Deep Third Man', x: 140, y: 520 },
    ],
  },
  ATTACKING_TEST: {
    name: 'Attacking Slip Cordon (Test)',
    icon: '🎯',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 460 },
      { name: '1st Slip', x: 265, y: 475 },
      { name: '2nd Slip', x: 240, y: 490 },
      { name: '3rd Slip', x: 215, y: 505 },
      { name: 'Gully', x: 190, y: 450 },
      { name: 'Silly Point', x: 240, y: 390 },
      { name: 'Short Leg', x: 360, y: 390 },
      { name: 'Short Cover', x: 210, y: 310 },
      { name: 'Mid Off', x: 250, y: 190 },
      { name: 'Mid On', x: 350, y: 190 },
      { name: 'Mid Wicket', x: 420, y: 290 },
    ],
  },
  DEATH_OVERS: {
    name: 'Death Overs (5 Deep)',
    icon: '🛑',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 460 },
      { name: 'Short Third Man', x: 210, y: 470 },
      { name: 'Deep Point', x: 70, y: 390 },
      { name: 'Deep Extra Cover', x: 100, y: 190 },
      { name: 'Long Off', x: 230, y: 70 },
      { name: 'Long On', x: 370, y: 70 },
      { name: 'Deep Mid-Wicket', x: 500, y: 190 },
      { name: 'Deep Square Leg', x: 530, y: 390 },
      { name: 'Short Fine Leg', x: 390, y: 470 },
      { name: 'Cover (Ring)', x: 200, y: 300 },
      { name: 'Mid-Wicket (Ring)', x: 400, y: 300 },
    ],
  },
  SPIN_TRAP: {
    name: 'Spin Web & Sweepers',
    icon: '🌀',
    positions: [
      { name: 'Wicketkeeper', x: 300, y: 445 },
      { name: 'Slip', x: 255, y: 460 },
      { name: 'Leg Slip', x: 345, y: 460 },
      { name: 'Short Leg', x: 350, y: 385 },
      { name: 'Silly Mid-On', x: 340, y: 330 },
      { name: 'Deep Cover Sweeper', x: 80, y: 260 },
      { name: 'Long Off', x: 240, y: 75 },
      { name: 'Long On', x: 360, y: 75 },
      { name: 'Deep Mid-Wicket', x: 520, y: 230 },
      { name: 'Deep Square Leg', x: 525, y: 410 },
      { name: 'Backward Point', x: 170, y: 390 },
    ],
  },
};

export default function CricketActionVisualizer({
  striker,
  nonStriker,
  bowler,
  lastBall,
  ballCount,
  format,
  battingTeamName,
  bowlingTeamName,
  isFreeHit = false,
  onAnimationComplete,
  className
}: VisualizerProps) {
  // Config & Controls
  const [speed, setSpeed] = useState<AnimationSpeed>(1);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<FieldPreset>('BALANCED');
  const [showFieldMenu, setShowFieldMenu] = useState<boolean>(false);
  const [draggedFielderId, setDraggedFielderId] = useState<string | null>(null);

  // State Machine
  const [animState, setAnimState] = useState<AnimatorState>('IDLE');
  const [stateProgress, setStateProgress] = useState<number>(0);
  const [activeShot, setActiveShot] = useState<string>('DEFEND');
  const [resultBanner, setResultBanner] = useState<string | null>(null);

  // Dynamic Positions
  const [ballPos, setBallPos] = useState<Point>(BOWLER_CREASE);
  const [ballHeight, setBallHeight] = useState<number>(0); // 0 = ground, > 0 = in air
  const [ballScale, setBallScale] = useState<{ x: number; y: number }>({ x: 1, y: 1 });
  const [ballRotation, setBallRotation] = useState<number>(0);
  const [ballVisible, setBallVisible] = useState<boolean>(false);

  const [bowlerPos, setBowlerPos] = useState<Point>({ x: 300, y: 120 });
  const [strikerPos, setStrikerPos] = useState<Point>(BATTER_CREASE);
  const [nonStrikerPos, setNonStrikerPos] = useState<Point>(NON_STRIKER_CREASE);
  const [batRotation, setBatRotation] = useState<number>(0);

  // Fielders initialized from active preset
  const [fielders, setFielders] = useState<FielderPos[]>(() => 
    FIELD_PRESETS.BALANCED.positions.map((p, idx) => ({
      id: `fielder_${idx}`,
      name: p.name,
      role: p.name,
      x: p.x,
      y: p.y,
      baseX: p.x,
      baseY: p.y,
    }))
  );

  const [activeFielder, setActiveFielder] = useState<FielderPos | null>(null);
  const [bailsFly, setBailsFly] = useState<boolean>(false);
  const [boundaryEffect, setBoundaryEffect] = useState<{ x: number; y: number; active: boolean; isSix?: boolean } | null>(null);
  const [impactBurst, setImpactBurst] = useState<Point | null>(null);

  // Ref tracking
  const animFrameRef = useRef<number | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Test vs White ball colors
  const isTest = format === 'TEST';
  const ballColor = isTest ? '#DC2626' : '#FFFFFF';
  const ballStroke = isTest ? '#7F1D1D' : '#94A3B8';
  const themePrimary = isTest ? '#EF4444' : '#06B6D4';

  // Apply Field Preset
  const handleSelectPreset = (preset: FieldPreset) => {
    setActivePreset(preset);
    setFielders(FIELD_PRESETS[preset].positions.map((p, idx) => ({
      id: `fielder_${idx}`,
      name: p.name,
      role: p.name,
      x: p.x,
      y: p.y,
      baseX: p.x,
      baseY: p.y,
    })));
  };

  // Interactive Drag & Drop Fielders on SVG
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedFielderId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const svgX = (clientX / rect.width) * 600;
    const svgY = (clientY / rect.height) * 600;

    // Constrain within oval boundary
    const distFromCenter = Math.hypot(svgX - 300, svgY - 300);
    const maxR = 270;
    const finalX = distFromCenter > maxR ? 300 + ((svgX - 300) / distFromCenter) * maxR : svgX;
    const finalY = distFromCenter > maxR ? 300 + ((svgY - 300) / distFromCenter) * maxR : svgY;

    setFielders(prev => prev.map(f => f.id === draggedFielderId ? { ...f, x: Math.round(finalX), y: Math.round(finalY), baseX: Math.round(finalX), baseY: Math.round(finalY) } : f));
  };

  const handleSvgMouseUp = () => {
    setDraggedFielderId(null);
  };

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
      // 360° Six Options
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
      const r = 295; // Over the boundary rope (268)
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
      // 360° Four Options
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
      const r = BOUNDARY_RADIUS; // Touches rope
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

  // Main 60-FPS Delivery Animation Sequence
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

    let startTime: number | null = null;
    isAnimatingRef.current = true;
    setBallVisible(true);
    setBailsFly(false);
    setBoundaryEffect(null);
    setImpactBurst(null);
    setResultBanner(null);

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
        // Smooth forward run-in
        const bY = 120 + (pNorm * pNorm * 65);
        setBowlerPos({ x: 300, y: bY });
        setBallPos({ x: 300, y: bY + 10 });
        setBallHeight(0);
      }

      // ── 2. Delivery Release & Flight to Pitch Bounce (0.25 - 0.50)
      else if (progress < 0.50) {
        setAnimState('BALL_FLIGHT');
        const pFlight = (progress - 0.25) / 0.25;
        const startP = BOWLER_CREASE;
        const bounceP = trajectoryData.bouncePoint;

        // Curved flight with swing
        const swingDeviation = (bowler?.swing || 3.5) * Math.sin(pFlight * Math.PI);
        const curX = startP.x + (bounceP.x - startP.x) * pFlight + swingDeviation;
        const curY = startP.y + (bounceP.y - startP.y) * pFlight;

        setBallPos({ x: curX, y: curY });
        setBallHeight(Math.sin(pFlight * Math.PI) * 14);
        setBallScale({ x: 1, y: 1 });
      }

      // ── 3. Pitch Bounce to Bat Contact (0.50 - 0.65)
      else if (progress < 0.65) {
        setAnimState('BOUNCE');
        const pBounce = (progress - 0.50) / 0.15;
        const bounceP = trajectoryData.bouncePoint;
        const batterP = BATTER_CREASE;

        const curX = bounceP.x + (batterP.x - bounceP.x) * pBounce;
        const curY = bounceP.y + (batterP.y - bounceP.y) * pBounce;

        setBallPos({ x: curX, y: curY });

        // Squash on contact with turf
        if (pBounce < 0.15) {
          setBallScale({ x: 1.35, y: 0.65 });
        } else {
          setBallScale({ x: 1, y: 1 });
        }
        setBallHeight(Math.sin(pBounce * Math.PI) * 9);

        // Batter backswing anticipation
        setBatRotation(Math.sin(pBounce * Math.PI) * -38);
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

        // Travel path
        let curX = startBat.x + (endTarget.x - startBat.x) * pTravel;
        let curY = startBat.y + (endTarget.y - startBat.y) * pTravel;

        if (trajectoryData.isAerial) {
          // 3D Parabolic Six Arc
          const arcHeight = Math.sin(pTravel * Math.PI) * 75;
          setBallHeight(arcHeight);
          // Scale grows as ball rises in 3D perspective
          const depthScale = 1.0 + (arcHeight / 80) * 0.75;
          setBallScale({ x: depthScale, y: depthScale });
        } else {
          // Four / Rolling ground ball with 2 subtle turf skips
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

        // Fielder runs smoothly toward the intercept coordinate
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

        // Bowled dismissal
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
  }, [lastBall, speed, get360ShotTrajectoryData, fielders, bowler, onAnimationComplete]);

  // Trigger on new delivery
  useEffect(() => {
    if (ballCount > 0) {
      runDeliveryAnimation();
    }
  }, [ballCount, runDeliveryAnimation]);

  return (
    <div className={cn("relative flex flex-col items-center select-none bg-[#040814] rounded-2xl overflow-hidden border border-white/10 shadow-2xl", className)}>
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

        {/* Speed & Field Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFieldMenu(!showFieldMenu)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border",
              showFieldMenu ? "bg-cyan-500 text-black border-cyan-400 font-black shadow-md" : "bg-white/5 border-white/10 text-white/80 hover:text-white"
            )}
            title="Configure Field Setup"
          >
            <Shield className="w-3 h-3" />
            <span>Field: {FIELD_PRESETS[activePreset].name.split(' ')[0]}</span>
          </button>

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
              "p-1 rounded text-white/40 hover:text-white transition-colors ml-1",
              debugMode && "text-cyan-400"
            )}
            title="Toggle Debug HUD"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Field Preset Selection Dropdown Drawer ── */}
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
                <Move className="w-3 h-3" /> Tactical Field Setup Presets (or drag fielders directly on pitch)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(FIELD_PRESETS) as FieldPreset[]).map((pKey) => {
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

      {/* ── 360-Degree Stadium SVG Canvas (600 x 600) ── */}
      <div className="relative w-full aspect-square max-w-[520px] overflow-hidden flex items-center justify-center p-2">
        <svg
          ref={svgRef}
          viewBox="0 0 600 600"
          className="w-full h-full drop-shadow-[0_0_40px_rgba(0,0,0,0.9)] cursor-crosshair"
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
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

          {/* 3. Fielders (Draggable & Interactive) */}
          {fielders.map((fielder) => (
            <g 
              key={fielder.id} 
              transform={`translate(${fielder.x}, ${fielder.y})`}
              onMouseDown={() => setDraggedFielderId(fielder.id)}
              className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
            >
              <circle
                r="7.5"
                fill="#1E293B"
                stroke={activeFielder?.id === fielder.id ? themePrimary : "rgba(255,255,255,0.4)"}
                strokeWidth={activeFielder?.id === fielder.id ? "2.5" : "1.2"}
              />
              <circle r="3.2" fill={activeFielder?.id === fielder.id ? themePrimary : "#94A3B8"} />
              {debugMode && (
                <text x="10" y="3" fill="white" fontSize="8" fontWeight="bold">
                  {fielder.name}
                </text>
              )}
            </g>
          ))}

          {/* 4. Non-Striker */}
          <g transform={`translate(${nonStrikerPos.x + 16}, ${nonStrikerPos.y})`}>
            <circle r="7.5" fill="#0284C7" stroke="white" strokeWidth="1.5" />
            <circle r="3" fill="white" />
          </g>

          {/* 5. Bowler */}
          <g transform={`translate(${bowlerPos.x - 16}, ${bowlerPos.y})`}>
            <circle r="8" fill="#DC2626" stroke="white" strokeWidth="1.5" />
            <circle r="3" fill="white" />
          </g>

          {/* 6. Striker & Bat */}
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

          {/* 7. Ground Shadow (Underneath aerial balls for 3D depth) */}
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

          {/* 8. Cricket Ball (Ultra-smooth 60fps transform) */}
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

          {/* 9. Bat Impact Burst */}
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

          {/* 10. Boundary LED Ripple (Fours & Sixes) */}
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
            <div>SHOT: <span className="text-white font-bold">{activeShot}</span></div>
            <div>PRESET: <span className="text-white font-bold">{activePreset}</span></div>
            <div>BALL POS: <span className="text-white font-bold">X:{Math.round(ballPos.x)} Y:{Math.round(ballPos.y)} H:{Math.round(ballHeight)}</span></div>
            <div>INTERCEPT FIELDER: <span className="text-white font-bold">{activeFielder?.name || 'NONE'}</span></div>
          </div>
        )}
      </div>

      {/* ── Broadcast Footer ── */}
      <div className="w-full px-4 py-2.5 bg-black/80 backdrop-blur-md border-t border-white/5 flex items-center justify-between text-xs text-white/80 z-30">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{striker?.name || 'Striker'}</span>
          <span className="text-white/40 text-[10px]">facing</span>
          <span className="font-bold text-cyan-400">{bowler?.name || 'Bowler'}</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase">
          <span>Field: <strong className="text-cyan-300">{FIELD_PRESETS[activePreset].name.split(' ')[0]}</strong></span>
          <span>•</span>
          <span>Shot: <strong className="text-white">{activeShot.replace(/_/g, ' ')}</strong></span>
        </div>
      </div>
    </div>
  );
}
