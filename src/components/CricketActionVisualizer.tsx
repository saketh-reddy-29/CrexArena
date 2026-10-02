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
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { BallOutcome, DRSResult } from '../types/match';
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
  targetX?: number;
  targetY?: number;
}

// Field dimensions in SVG viewBox coordinate space (600 x 600)
const PITCH_CENTER: Point = { x: 300, y: 300 };
const BOWLER_CREASE: Point = { x: 300, y: 190 };
const BATTER_CREASE: Point = { x: 300, y: 410 };
const NON_STRIKER_CREASE: Point = { x: 300, y: 200 };
const WICKET_KEEPER_POS: Point = { x: 300, y: 460 };
const STUMPS_BATTER: Point = { x: 300, y: 420 };
const STUMPS_BOWLER: Point = { x: 300, y: 180 };

// Standard Field Positions on Oval
const DEFAULT_FIELD_POSITIONS: { name: string; x: number; y: number }[] = [
  { name: 'Wicketkeeper', x: 300, y: 460 },
  { name: 'Slip', x: 260, y: 470 },
  { name: 'Gully', x: 220, y: 440 },
  { name: 'Point', x: 160, y: 410 },
  { name: 'Cover', x: 170, y: 290 },
  { name: 'Extra Cover', x: 190, y: 220 },
  { name: 'Mid Off', x: 250, y: 190 },
  { name: 'Mid On', x: 350, y: 190 },
  { name: 'Mid Wicket', x: 420, y: 280 },
  { name: 'Square Leg', x: 440, y: 410 },
  { name: 'Fine Leg', x: 400, y: 490 },
];

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
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

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
  const [ballTrail, setBallTrail] = useState<Point[]>([]);

  const [bowlerPos, setBowlerPos] = useState<Point>({ x: 300, y: 120 });
  const [strikerPos, setStrikerPos] = useState<Point>(BATTER_CREASE);
  const [nonStrikerPos, setNonStrikerPos] = useState<Point>(NON_STRIKER_CREASE);
  const [batRotation, setBatRotation] = useState<number>(0);

  const [fielders, setFielders] = useState<FielderPos[]>(() => 
    DEFAULT_FIELD_POSITIONS.map((p, idx) => ({
      id: `fielder_${idx}`,
      name: p.name,
      role: p.name,
      x: p.x,
      y: p.y,
      baseX: p.x,
      baseY: p.y
    }))
  );

  const [activeFielder, setActiveFielder] = useState<FielderPos | null>(null);
  const [bailsFly, setBailsFly] = useState<boolean>(false);
  const [boundaryEffect, setBoundaryEffect] = useState<{ x: number; y: number; active: boolean } | null>(null);

  // Ref tracking
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);

  // Test vs White ball colors
  const isTest = format === 'TEST';
  const ballColor = isTest ? '#DC2626' : '#FFFFFF';
  const ballStroke = isTest ? '#7F1D1D' : '#94A3B8';
  const themePrimary = isTest ? '#EF4444' : '#06B6D4';
  const themeGlow = isTest ? 'rgba(239, 68, 68, 0.4)' : 'rgba(6, 182, 212, 0.4)';

  // Helper: Cubic Bezier Interpolation
  const cubicBezier = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
    const cx = 3 * (p1.x - p0.x);
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = p3.x - p0.x - cx - bx;

    const cy = 3 * (p1.y - p0.y);
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = p3.y - p0.y - cy - by;

    const tSquared = t * t;
    const tCubed = tSquared * t;

    return {
      x: (ax * tCubed) + (bx * tSquared) + (cx * t) + p0.x,
      y: (ay * tCubed) + (by * tSquared) + (cy * t) + p0.y,
    };
  };

  // Helper: Determine shot direction and target boundary point based on runs and outcome
  const getShotTrajectoryData = useCallback((runs: number, isWicket: boolean, isExtra: boolean, extraType?: string) => {
    if (isExtra && (extraType === 'Wide' || extraType === 'No Ball')) {
      return {
        shot: extraType.toUpperCase(),
        bouncePoint: { x: 300, y: 310 },
        targetPoint: { x: 350, y: 460 },
        isBoundary: false,
        isAerial: false,
        duration: 800,
      };
    }

    if (isWicket) {
      return {
        shot: 'WICKET_BALL',
        bouncePoint: { x: 300, y: 320 },
        targetPoint: { x: 300, y: 420 },
        isBoundary: false,
        isAerial: false,
        duration: 900,
      };
    }

    // Shot angle distribution
    if (runs === 6) {
      const angles = [
        { shot: 'PULL_SIX', target: { x: 490, y: 220 } },
        { shot: 'LOFTED_COVER_SIX', target: { x: 110, y: 210 } },
        { shot: 'STRAIGHT_SIX', target: { x: 300, y: 70 } },
        { shot: 'HOOK_SIX', target: { x: 510, y: 380 } },
      ];
      const selected = angles[Math.floor(Math.random() * angles.length)];
      return {
        shot: selected.shot,
        bouncePoint: { x: 300, y: 330 },
        targetPoint: selected.target,
        isBoundary: true,
        isAerial: true,
        duration: 1400,
      };
    }

    if (runs === 4) {
      const angles = [
        { shot: 'COVER_DRIVE_FOUR', target: { x: 120, y: 260 } },
        { shot: 'SQUARE_CUT_FOUR', target: { x: 100, y: 410 } },
        { shot: 'ON_DRIVE_FOUR', target: { x: 420, y: 150 } },
        { shot: 'PULL_FOUR', target: { x: 490, y: 290 } },
        { shot: 'GLANCE_FOUR', target: { x: 460, y: 510 } },
      ];
      const selected = angles[Math.floor(Math.random() * angles.length)];
      return {
        shot: selected.shot,
        bouncePoint: { x: 300, y: 330 },
        targetPoint: selected.target,
        isBoundary: true,
        isAerial: false,
        duration: 1300,
      };
    }

    if (runs === 1 || runs === 2 || runs === 3) {
      const singles = [
        { shot: 'PUSH_SINGLE', target: { x: 230, y: 280 } },
        { shot: 'NUDGE_SINGLE', target: { x: 380, y: 360 } },
        { shot: 'SQUARE_DRIVE', target: { x: 200, y: 360 } },
      ];
      const selected = singles[Math.floor(Math.random() * singles.length)];
      return {
        shot: selected.shot,
        bouncePoint: { x: 300, y: 330 },
        targetPoint: selected.target,
        isBoundary: false,
        isAerial: false,
        duration: 1000,
      };
    }

    // Dot ball / Defend
    return {
      shot: 'DEFEND',
      bouncePoint: { x: 300, y: 340 },
      targetPoint: { x: 290, y: 395 },
      isBoundary: false,
      isAerial: false,
      duration: 800,
    };
  }, []);

  // Main Continuous Animation Loop
  const runDeliveryAnimation = useCallback(() => {
    if (!lastBall || speed === 0) {
      // Instant display
      if (lastBall) {
        setResultBanner(lastBall.isWicket ? 'WICKET!' : lastBall.runs === 6 ? 'SIX!' : lastBall.runs === 4 ? 'FOUR!' : `${lastBall.runs} RUNS`);
      }
      onAnimationComplete?.();
      return;
    }

    const { runs, isWicket, isExtra, extraType, wicketType } = lastBall;
    const trajectoryData = getShotTrajectoryData(runs, isWicket, isExtra, extraType);
    setActiveShot(trajectoryData.shot);

    const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 0.5 : 0.25;
    const totalDuration = trajectoryData.duration * speedMultiplier;

    let startTime: number | null = null;
    isAnimatingRef.current = true;
    setBallVisible(true);
    setBailsFly(false);
    setBoundaryEffect(null);
    setResultBanner(null);

    // Initial Bowler & Batter positions
    setBowlerPos({ x: 300, y: 120 });
    setStrikerPos(BATTER_CREASE);
    setNonStrikerPos(NON_STRIKER_CREASE);
    setBallPos(BOWLER_CREASE);
    setBallTrail([]);

    // Find closest fielder to target point
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

      // ── Phase 1: Bowler Run-up (0.00 - 0.25)
      if (progress < 0.25) {
        setAnimState('BOWLER_RUNUP');
        const pNorm = progress / 0.25;
        setBowlerPos({ x: 300, y: 120 + (pNorm * 65) });
        setBallPos({ x: 300, y: 130 + (pNorm * 60) });
      }

      // ── Phase 2: Delivery Release & Flight to Bounce (0.25 - 0.50)
      else if (progress < 0.50) {
        setAnimState('BALL_FLIGHT');
        const pFlight = (progress - 0.25) / 0.25;
        // Cubic flight curve to bounce point with subtle swing
        const startP = BOWLER_CREASE;
        const bounceP = trajectoryData.bouncePoint;
        const swingOffset = (bowler?.swing || 4) * Math.sin(pFlight * Math.PI);
        const curX = startP.x + (bounceP.x - startP.x) * pFlight + swingOffset;
        const curY = startP.y + (bounceP.y - startP.y) * pFlight;

        setBallPos({ x: curX, y: curY });
        setBallHeight(Math.sin(pFlight * Math.PI) * 12);
        setBallScale({ x: 1, y: 1 });
      }

      // ── Phase 3: Bounce to Bat Contact (0.50 - 0.65)
      else if (progress < 0.65) {
        setAnimState('BOUNCE');
        const pBounce = (progress - 0.50) / 0.15;
        const bounceP = trajectoryData.bouncePoint;
        const batterP = BATTER_CREASE;

        const curX = bounceP.x + (batterP.x - bounceP.x) * pBounce;
        const curY = bounceP.y + (batterP.y - bounceP.y) * pBounce;

        setBallPos({ x: curX, y: curY });
        // Compression at bounce point
        if (pBounce < 0.2) {
          setBallScale({ x: 1.3, y: 0.7 });
        } else {
          setBallScale({ x: 1, y: 1 });
        }
        setBallHeight(Math.sin(pBounce * Math.PI) * 8);

        // Batter backswing
        setBatRotation(Math.sin(pBounce * Math.PI) * -35);
      }

      // ── Phase 4: Bat Contact & Shot Travel (0.65 - 0.90)
      else if (progress < 0.90) {
        setAnimState('BALL_FIELD_TRAVEL');
        const pTravel = (progress - 0.65) / 0.25;
        const startBat = BATTER_CREASE;
        const endTarget = trajectoryData.targetPoint;

        // Follow shot trajectory
        let curX = startBat.x + (endTarget.x - startBat.x) * pTravel;
        let curY = startBat.y + (endTarget.y - startBat.y) * pTravel;

        if (trajectoryData.isAerial) {
          const arc = Math.sin(pTravel * Math.PI) * 45;
          setBallHeight(arc);
        } else {
          setBallHeight(0);
          setBallRotation(prev => prev + 25);
        }

        setBallPos({ x: curX, y: curY });
        setBatRotation(Math.sin((1 - pTravel) * Math.PI) * 20);

        // Fielder moves smoothly to intercept
        setFielders(prev => prev.map((f, i) => {
          if (i === closestFielderIdx) {
            const lerpX = f.baseX + (endTarget.x - f.baseX) * (pTravel * 0.85);
            const lerpY = f.baseY + (endTarget.y - f.baseY) * (pTravel * 0.85);
            return { ...f, x: lerpX, y: lerpY };
          }
          return f;
        }));

        // Running between wickets for 1, 2, 3 runs
        if (runs > 0 && !isWicket) {
          const runCycle = Math.min(1, pTravel * (runs >= 2 ? 1.8 : 1.0));
          const sY = BATTER_CREASE.y - (runCycle * (BATTER_CREASE.y - NON_STRIKER_CREASE.y));
          const nsY = NON_STRIKER_CREASE.y + (runCycle * (BATTER_CREASE.y - NON_STRIKER_CREASE.y));
          setStrikerPos({ x: 300, y: sY });
          setNonStrikerPos({ x: 300, y: nsY });
        }

        // Wicket bowled animation: hit stumps & fly bails
        if (isWicket && wicketType?.toLowerCase().includes('bowled')) {
          setBailsFly(true);
        }
      }

      // ── Phase 5: Final Impact, Boundary or Result (0.90 - 1.00)
      else {
        setAnimState('RESULT');
        if (trajectoryData.isBoundary) {
          setBoundaryEffect({ x: trajectoryData.targetPoint.x, y: trajectoryData.targetPoint.y, active: true });
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
  }, [lastBall, speed, getShotTrajectoryData, onAnimationComplete]);

  // Trigger on new delivery
  useEffect(() => {
    if (ballCount > 0) {
      runDeliveryAnimation();
    }
  }, [ballCount, runDeliveryAnimation]);

  return (
    <div className={cn("relative flex flex-col items-center select-none bg-[#050914] rounded-2xl overflow-hidden border border-white/10 shadow-2xl", className)}>
      {/* ── Broadcast Top Info Strip ── */}
      <div className="w-full px-4 py-2 bg-black/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isTest ? "bg-red-500" : "bg-cyan-400")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
            {format} LIVE ARENA BROADCAST
          </span>
          {isFreeHit && (
            <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-black uppercase animate-bounce">
              Free Hit
            </span>
          )}
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1">
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
            title="Toggle Debug Overlay"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Stadium SVG Canvas (600 x 600) ── */}
      <div className="relative w-full aspect-square max-w-[500px] overflow-hidden flex items-center justify-center p-2">
        <svg
          viewBox="0 0 600 600"
          className="w-full h-full drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]"
        >
          <defs>
            {/* Field Turf Gradient */}
            <radialGradient id="fieldGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e3a1e" />
              <stop offset="70%" stopColor="#142814" />
              <stop offset="100%" stopColor="#0d1b0d" />
            </radialGradient>

            {/* Pitch Texture Gradient */}
            <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c2a679" />
              <stop offset="25%" stopColor="#d8bd8e" />
              <stop offset="75%" stopColor="#d8bd8e" />
              <stop offset="100%" stopColor="#c2a679" />
            </linearGradient>

            {/* Ball Glow Filter */}
            <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Outer Stadium & Boundary Rope */}
          <circle cx="300" cy="300" r="280" fill="url(#fieldGrad)" stroke="#224422" strokeWidth="6" />
          
          {/* Inner 30-Yard Circle */}
          <ellipse
            cx="300"
            cy="300"
            rx="160"
            ry="190"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Boundary Rope Highlight Ring */}
          <circle
            cx="300"
            cy="300"
            r="268"
            fill="none"
            stroke={boundaryEffect?.active ? themePrimary : "rgba(255,255,255,0.25)"}
            strokeWidth={boundaryEffect?.active ? "4" : "2"}
            className="transition-all duration-300"
          />

          {/* 2. Cricket Pitch Strip */}
          <rect
            x="272"
            y="170"
            width="56"
            height="260"
            rx="4"
            fill="url(#pitchGrad)"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1"
          />

          {/* Crease Markings */}
          {/* Bowler End Crease */}
          <line x1="260" y1="190" x2="340" y2="190" stroke="white" strokeWidth="1.5" />
          <line x1="280" y1="180" x2="280" y2="190" stroke="white" strokeWidth="1" />
          <line x1="320" y1="180" x2="320" y2="190" stroke="white" strokeWidth="1" />
          <circle cx="300" cy="180" r="2" fill="#EAB308" />

          {/* Batter End Crease (Popping Crease) */}
          <line x1="260" y1="410" x2="340" y2="410" stroke="white" strokeWidth="1.5" />
          <line x1="280" y1="410" x2="280" y2="425" stroke="white" strokeWidth="1" />
          <line x1="320" y1="410" x2="320" y2="425" stroke="white" strokeWidth="1" />
          
          {/* Stumps & Bails at Batter End */}
          <rect x="296" y="420" width="8" height="3" fill="#D97706" rx="1" />
          {bailsFly ? (
            <motion.circle 
              initial={{ cx: 300, cy: 420 }} 
              animate={{ cx: 315, cy: 440, opacity: 0 }} 
              transition={{ duration: 0.6 }}
              r="2" 
              fill="#F59E0B" 
            />
          ) : (
            <line x1="295" y1="420" x2="305" y2="420" stroke="#FDE68A" strokeWidth="1.5" />
          )}

          {/* 3. Fielders */}
          {fielders.map((fielder) => (
            <g key={fielder.id} transform={`translate(${fielder.x}, ${fielder.y})`}>
              <circle
                r="7"
                fill="#1E293B"
                stroke={activeFielder?.id === fielder.id ? themePrimary : "rgba(255,255,255,0.4)"}
                strokeWidth={activeFielder?.id === fielder.id ? "2.5" : "1"}
              />
              <circle r="3" fill={activeFielder?.id === fielder.id ? themePrimary : "#94A3B8"} />
              {debugMode && (
                <text x="9" y="3" fill="white" fontSize="8" fontWeight="bold">
                  {fielder.name}
                </text>
              )}
            </g>
          ))}

          {/* 4. Non-Striker */}
          <g transform={`translate(${nonStrikerPos.x + 16}, ${nonStrikerPos.y})`}>
            <circle r="7" fill="#0284C7" stroke="white" strokeWidth="1.5" />
            <circle r="3" fill="white" />
          </g>

          {/* 5. Bowler */}
          <g transform={`translate(${bowlerPos.x - 16}, ${bowlerPos.y})`}>
            <circle r="7.5" fill="#DC2626" stroke="white" strokeWidth="1.5" />
            <circle r="3" fill="white" />
          </g>

          {/* 6. Striker & Bat */}
          <g transform={`translate(${strikerPos.x}, ${strikerPos.y})`}>
            <circle r="8" fill="#2563EB" stroke="white" strokeWidth="1.5" />
            <circle r="3.5" fill="white" />
            {/* Dynamic Bat Element */}
            <line
              x1="0"
              y1="0"
              x2="12"
              y2="-6"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
              transform={`rotate(${batRotation})`}
            />
          </g>

          {/* 7. Cricket Ball (Smooth 60fps Interpolated Transform) */}
          {ballVisible && (
            <g
              transform={`translate(${ballPos.x}, ${ballPos.y - ballHeight}) scale(${ballScale.x}, ${ballScale.y})`}
            >
              <circle
                r={isTest ? 4.5 : 4}
                fill={ballColor}
                stroke={ballStroke}
                strokeWidth="1.2"
                filter="url(#ballGlow)"
              />
              {/* Ball Seam */}
              <line
                x1="-3"
                y1="0"
                x2="3"
                y2="0"
                stroke={isTest ? "#FFFFFF" : "#CBD5E1"}
                strokeWidth="0.8"
                transform={`rotate(${ballRotation})`}
              />
            </g>
          )}

          {/* 8. Boundary Ripple Effect */}
          {boundaryEffect?.active && (
            <circle
              cx={boundaryEffect.x}
              cy={boundaryEffect.y}
              r="22"
              fill="none"
              stroke={themePrimary}
              strokeWidth="3"
              className="animate-ping"
            />
          )}
        </svg>

        {/* ── Overlay Action Banners ── */}
        <AnimatePresence>
          {resultBanner && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-2.5 rounded-2xl backdrop-blur-xl border font-black text-xl tracking-wider shadow-2xl z-40 text-center pointer-events-none",
                resultBanner.includes('SIX') && "bg-purple-950/80 border-purple-400 text-purple-200 shadow-purple-500/30 text-2xl animate-pulse",
                resultBanner.includes('FOUR') && "bg-blue-950/80 border-blue-400 text-blue-200 shadow-blue-500/30 text-2xl",
                resultBanner.includes('WICKET') && "bg-red-950/90 border-red-500 text-red-100 shadow-red-500/40 text-2xl",
                resultBanner.includes('RUN') && "bg-zinc-900/80 border-white/20 text-white",
                resultBanner.includes('DOT') && "bg-black/80 border-white/10 text-white/70 text-base"
              )}
            >
              {resultBanner}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Debug Overlay ── */}
        {debugMode && (
          <div className="absolute top-12 left-3 bg-black/85 border border-white/10 rounded-xl p-2.5 text-[9px] font-mono text-cyan-300 space-y-0.5 z-40 pointer-events-none">
            <div>STATE: <span className="text-white font-bold">{animState}</span></div>
            <div>PROGRESS: <span className="text-white font-bold">{stateProgress}%</span></div>
            <div>SHOT: <span className="text-white font-bold">{activeShot}</span></div>
            <div>BALL POS: <span className="text-white font-bold">X:{Math.round(ballPos.x)} Y:{Math.round(ballPos.y)}</span></div>
            <div>FIELDER: <span className="text-white font-bold">{activeFielder?.name || 'NONE'}</span></div>
          </div>
        )}
      </div>

      {/* ── Visualizer Match Status Footer ── */}
      <div className="w-full px-4 py-2.5 bg-black/70 backdrop-blur-md border-t border-white/5 flex items-center justify-between text-xs text-white/80 z-30">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{striker?.name || 'Striker'}</span>
          <span className="text-white/40 text-[10px]">facing</span>
          <span className="font-bold text-cyan-400">{bowler?.name || 'Bowler'}</span>
        </div>

        <div className="text-[10px] font-black uppercase text-white/50">
          Status: <strong className="text-white">{animState}</strong>
        </div>
      </div>
    </div>
  );
}
