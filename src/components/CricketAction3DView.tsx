import React, { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Stadium, StadiumScoreboardData } from '../3d/Stadium';
import { Lighting } from '../3d/Lighting';
import { CameraSystem, CameraViewMode } from '../3d/CameraSystem';
import { CharacterInstance } from '../characters/CharacterInstance';
import { BallVisual } from '../physics/BallVisual';
import { soundFX } from '../3d/CricketSoundFX';
import { CricketArenaAction } from '../lib/cricketArenaAnimations';
import { Camera, Eye, Zap, Crosshair } from 'lucide-react';

const PADDED_MODEL = '/models/cricket-arena/cartoon_sports_character_3d_model.glb';
const LIGHT_MODEL = '/models/cricket-arena/cartoon_character_3d_model.glb';

type Point = { x: number; y: number };
type ArenaStage = 'IDLE' | 'BOWLER_RELEASE' | 'PITCH_BOUNCE' | 'BAT_CONTACT' | 'BALL_TRAVEL' | 'OUTCOME';

export interface ArenaPlayer {
  id: string;
  name: string;
  role: string;
  currentX: number;
  currentY: number;
  positionKey?: string;
  isBowler?: boolean;
  isWicketkeeper?: boolean;
}

export interface FielderAction {
  fielderId: string;
  action: string;
  currentPos: Point;
}

export interface CricketAction3DViewProps {
  fielders: ArenaPlayer[];
  striker: ArenaPlayer | null;
  nonStriker: ArenaPlayer | null;
  delivery: {
    shotType: string;
    totalRuns: number;
    wicket: boolean;
    ballPath: { isAerial?: boolean };
  } | null;
  stage: ArenaStage;
  progress: number;
  ballPos: Point;
  ballVisible: boolean;
  ballScale: number;
  strikerPos: Point;
  nonStrikerPos: Point;
  bowlerPos: Point;
  activeFielderAction: FielderAction | null;
  // Live Scoreboard Data Feed
  score?: { runs: number; wickets: number; overs: number; balls: number };
  target?: number;
  battingTeamName?: string;
  bowlingTeamName?: string;
  bowlerName?: string;
  bowlerWickets?: number;
  bowlerRuns?: number;
  bowlerOvers?: number;
  bowlerBalls?: number;
  isLeftHanded?: boolean;
}

// Convert 2D field map coordinates (0..600, center at 300, 300) to 3D stadium coordinates
function toWorld(point: Point): [number, number] {
  const x = (point.x - 300) / 12.5;
  const z = (300 - point.y) / 18.0;
  return [x, z];
}

function getShotAction(shotType: string): CricketArenaAction {
  const shot = shotType.toUpperCase().replace(/[^A-Z]/g, '');
  if (shot.includes('SWEEP') && shot.includes('REVERSE')) return 'reverseSweep';
  if (shot.includes('SWEEP')) return 'sweep';
  if (shot.includes('PULL')) return 'pull';
  if (shot.includes('HOOK')) return 'hook';
  if (shot.includes('FLICK')) return 'flick';
  if (shot.includes('LATE') || shot.includes('CUT')) return 'lateCut';
  if (shot.includes('SQUARE')) return 'squareCut';
  if (shot.includes('LOFT') || shot.includes('SIX')) return 'lofted';
  if (shot.includes('DEFEN') || shot.includes('BLOCK')) return 'forwardDefence';
  if (shot.includes('BACK') && shot.includes('DEF')) return 'backDefence';
  if (shot.includes('ON') && shot.includes('DRIVE')) return 'onDrive';
  if (shot.includes('OFF') && shot.includes('DRIVE')) return 'offDrive';
  if (shot.includes('STRAIGHT')) return 'straightDrive';
  if (shot.includes('COVER') || shot.includes('DRIVE') || shot.includes('FOUR')) return 'coverDrive';
  return 'straightDrive';
}

function actionForFielder(fielder: ArenaPlayer, actionStr: string): CricketArenaAction {
  if (fielder.isWicketkeeper) {
    const act = actionStr.toUpperCase();
    if (act.includes('DIVE') && act.includes('LEFT')) return 'keeperDiveL';
    if (act.includes('DIVE')) return 'keeperDiveR';
    if (act.includes('LOW')) return 'keeperLow';
    if (act.includes('HIGH')) return 'keeperHigh';
    if (act.includes('STUMP')) return 'stumping';
    return act.includes('CATCH') ? 'keeperCatch' : 'keeperReady';
  }

  const normalized = actionStr.toUpperCase();
  if (normalized.includes('PICK') || normalized.includes('GATHER')) return 'ballPickup';
  if (normalized.includes('POWER') && normalized.includes('THROW')) return 'throwPower';
  if (normalized.includes('THROW')) return 'throwOver';
  if (normalized.includes('DIVE') && normalized.includes('CATCH')) return 'diveCatch';
  if (normalized.includes('DIVE') || normalized.includes('STOP')) return 'diveStop';
  if (normalized.includes('SLIDE')) return 'slide';
  if (normalized.includes('CATCH')) return 'highCatch';
  if (normalized.includes('CHASE') || normalized.includes('INTERCEPT')) return 'sprint';
  if (normalized.includes('RUN')) return 'run';
  return 'ready';
}

function StadiumScene({
  props,
  cameraMode,
  showDebugSkeleton,
}: {
  props: CricketAction3DViewProps;
  cameraMode: CameraViewMode;
  showDebugSkeleton: boolean;
}) {
  const {
    fielders,
    striker,
    nonStriker,
    delivery,
    stage,
    progress,
    ballPos,
    ballVisible,
    ballScale,
    strikerPos,
    nonStrikerPos,
    bowlerPos,
    activeFielderAction,
    score,
    target,
    battingTeamName = 'INDIA',
    bowlingTeamName = 'AUSTRALIA',
    bowlerName,
    bowlerWickets,
    bowlerRuns,
    bowlerOvers,
    bowlerBalls,
    isLeftHanded = false,
  } = props;

  const strikerWorld = toWorld(strikerPos);
  const nonStrikerWorld = toWorld(nonStrikerPos);
  const bowlerWorld = toWorld(bowlerPos);
  const ballWorld = toWorld(ballPos);

  // Track audio triggers per stage to avoid repeating
  const lastSoundStage = useRef<string>('');

  useEffect(() => {
    if (stage === 'BAT_CONTACT' && lastSoundStage.current !== 'BAT_CONTACT') {
      soundFX.playBatCrack(delivery && delivery.totalRuns >= 4 ? 1.35 : 0.95);
      if (delivery && delivery.totalRuns >= 4) {
        setTimeout(() => soundFX.playCrowdCheer(delivery.totalRuns === 6), 250);
      }
    } else if (stage === 'PITCH_BOUNCE' && lastSoundStage.current !== 'PITCH_BOUNCE') {
      soundFX.playPitchBounce();
    } else if (stage === 'OUTCOME' && lastSoundStage.current !== 'OUTCOME') {
      if (delivery?.wicket) {
        soundFX.playStumpsClatter();
        setTimeout(() => soundFX.playCrowdCheer(true), 150);
      }
    }
    lastSoundStage.current = stage;
  }, [stage, delivery]);

  // Interpolation progress within each delivery stage
  const localProgress =
    stage === 'BALL_TRAVEL'
      ? Math.max(0, Math.min(1, (progress - 58) / 32))
      : stage === 'OUTCOME'
      ? Math.max(0, Math.min(1, (progress - 90) / 10))
      : stage === 'BOWLER_RELEASE'
      ? Math.max(0, Math.min(1, progress / 45))
      : 0;

  const hasRuns = Boolean(delivery && delivery.totalRuns > 0 && !delivery.wicket);
  const isBoundary = Boolean(delivery && delivery.totalRuns >= 4);

  // Striker Action
  const strikerAction: CricketArenaAction = useMemo(() => {
    if (stage === 'OUTCOME') {
      if (delivery?.wicket) return 'defeat';
      if (isBoundary) return 'celebrateJump';
      return hasRuns ? 'runBat' : 'batIdle';
    }
    if (stage === 'BALL_TRAVEL') {
      return hasRuns ? 'runBat' : getShotAction(delivery?.shotType ?? '');
    }
    if (stage === 'BAT_CONTACT') {
      return getShotAction(delivery?.shotType ?? '');
    }
    if (stage === 'PITCH_BOUNCE') {
      return 'backlift';
    }
    if (stage === 'BOWLER_RELEASE') {
      return progress > 25 ? 'backlift' : 'batIdle';
    }
    return 'batIdle';
  }, [stage, delivery, hasRuns, isBoundary, progress]);

  // Non-striker Action
  const nonStrikerAction: CricketArenaAction = useMemo(() => {
    if (hasRuns && (stage === 'BALL_TRAVEL' || stage === 'OUTCOME')) {
      return 'runBat';
    }
    return 'batIdle';
  }, [hasRuns, stage]);

  // Ball 3D flight trajectory calculation
  const ball3DPos: [number, number, number] = useMemo(() => {
    let y = 0.18;
    if (stage === 'BOWLER_RELEASE') {
      // In bowler's raised hand
      y = 1.85 - (progress / 45) * 0.4;
    } else if (stage === 'PITCH_BOUNCE') {
      // Bouncing off turf
      y = 0.14 + Math.sin(localProgress * Math.PI) * 0.45;
    } else if (stage === 'BAT_CONTACT') {
      // Contact with bat
      y = 0.72;
    } else if (stage === 'BALL_TRAVEL') {
      if (delivery?.ballPath.isAerial) {
        // High parabolic arc for aerial six or lofted shot
        const maxHeight = delivery.totalRuns === 6 ? 6.5 : 3.8;
        y = 0.72 + Math.sin(localProgress * Math.PI) * maxHeight;
      } else {
        // Rolling along grass with small initial bounce
        y = localProgress < 0.25 ? 0.45 * (1 - localProgress / 0.25) + 0.14 : 0.14;
      }
    }
    return [ballWorld[0], y, ballWorld[1]];
  }, [stage, progress, localProgress, delivery, ballWorld]);

  // Live Scoreboard Data
  const scoreboardData: StadiumScoreboardData = useMemo(() => {
    let eventNotice = null;
    if (stage === 'OUTCOME') {
      if (delivery?.wicket) eventNotice = 'WICKET FALLS!';
      else if (delivery?.totalRuns === 6) eventNotice = 'MAXIMUM SIX!';
      else if (delivery?.totalRuns === 4) eventNotice = 'BOUNDARY FOUR!';
      else if (delivery?.totalRuns === 0) eventNotice = 'DOT BALL';
      else if (delivery?.totalRuns) eventNotice = `${delivery.totalRuns} RUNS`;
    }

    return {
      battingTeamName,
      bowlingTeamName,
      score: score || { runs: 164, wickets: 3, overs: 17, balls: 2 },
      target,
      strikerName: striker?.name || 'Striker',
      strikerRuns: 52,
      strikerBalls: 31,
      nonStrikerName: nonStriker?.name || 'Non-striker',
      nonStrikerRuns: 38,
      nonStrikerBalls: 24,
      bowlerName: bowlerName || 'Bowler',
      bowlerWickets: bowlerWickets ?? 1,
      bowlerRuns: bowlerRuns ?? 28,
      bowlerOvers: bowlerOvers ?? 3,
      bowlerBalls: bowlerBalls ?? 2,
      recentEvent: eventNotice,
    };
  }, [
    stage,
    delivery,
    battingTeamName,
    bowlingTeamName,
    score,
    target,
    striker,
    nonStriker,
    bowlerName,
    bowlerWickets,
    bowlerRuns,
    bowlerOvers,
    bowlerBalls,
  ]);

  return (
    <>
      <Lighting />

      <CameraSystem
        mode={cameraMode}
        ballPos={ball3DPos}
        strikerPos={strikerWorld}
        bowlerPos={bowlerWorld}
        isBallTravelling={stage === 'BALL_TRAVEL' || stage === 'OUTCOME'}
      />

      <Stadium
        scoreboardData={scoreboardData}
        stumpHit={Boolean(stage === 'OUTCOME' && delivery?.wicket)}
      />

      {/* Striker Batsman */}
      {striker && (
        <CharacterInstance
          modelUrl={PADDED_MODEL}
          position={strikerWorld}
          yaw={0}
          action={strikerAction}
          progress={localProgress}
          hasBat={true}
          isLeftHanded={isLeftHanded}
          ballPos={ball3DPos}
          showDebugSkeleton={showDebugSkeleton}
        />
      )}

      {/* Non-Striker Batsman */}
      {nonStriker && (
        <CharacterInstance
          modelUrl={PADDED_MODEL}
          position={nonStrikerWorld}
          yaw={Math.PI}
          action={nonStrikerAction}
          progress={localProgress}
          hasBat={true}
          showDebugSkeleton={showDebugSkeleton}
        />
      )}

      {/* Bowler and Fielders */}
      {fielders.map((fielder) => {
        const isBowler = fielder.isBowler || fielder.positionKey === 'BOWLER';
        const isKeeper = fielder.isWicketkeeper || fielder.positionKey === 'WICKETKEEPER';
        const active = activeFielderAction?.fielderId === fielder.id ? activeFielderAction : null;

        const location = isBowler
          ? bowlerWorld
          : active
          ? toWorld(active.currentPos)
          : toWorld({ x: fielder.currentX, y: fielder.currentY });

        // Select specific character action
        let action: CricketArenaAction = 'ready';
        if (isBowler) {
          action =
            stage === 'BOWLER_RELEASE' || stage === 'PITCH_BOUNCE'
              ? 'bowl_fast'
              : stage === 'OUTCOME' && delivery?.wicket
              ? 'celebrateSmall'
              : 'ready';
        } else if (isKeeper) {
          action =
            active
              ? actionForFielder(fielder, active.action)
              : stage === 'OUTCOME' && delivery?.wicket
              ? 'celebrateSmall'
              : 'keeperReady';
        } else if (active) {
          action = actionForFielder(fielder, active.action);
        } else if (stage === 'OUTCOME' && delivery?.wicket) {
          action = 'handsUp';
        }

        // Direction facing
        const facingAngle = isBowler
          ? Math.PI
          : isKeeper
          ? 0
          : Math.atan2(ballWorld[0] - location[0], ballWorld[1] - location[1]);

        return (
          <CharacterInstance
            key={fielder.id}
            modelUrl={isKeeper ? PADDED_MODEL : LIGHT_MODEL}
            position={location}
            yaw={facingAngle}
            action={action}
            progress={isBowler ? Math.min(1, progress / 45) : localProgress}
            ballPos={ball3DPos}
            showDebugSkeleton={showDebugSkeleton}
          />
        );
      })}

      {/* Physical 3D Cricket Ball */}
      <BallVisual
        position={ball3DPos}
        visible={ballVisible}
        scale={ballScale}
        isHitFlash={stage === 'BAT_CONTACT'}
      />
    </>
  );
}

export default function CricketAction3DView(props: CricketAction3DViewProps) {
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('EA_BATTER');
  const [showDebugSkeleton, setShowDebugSkeleton] = useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl bg-[#080e1e] select-none">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
      >
        <Suspense fallback={null}>
          <StadiumScene
            props={props}
            cameraMode={cameraMode}
            showDebugSkeleton={showDebugSkeleton}
          />
        </Suspense>
      </Canvas>

      {/* Top Left Status Badge */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-slate-950/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200 backdrop-blur-md shadow-lg">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>AAA 3D Match Stadium</span>
        </div>
      </div>

      {/* Top Right Camera & Debug Controls */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 z-20">
        {/* Camera Selector */}
        <div className="flex items-center bg-slate-950/85 backdrop-blur-md p-0.5 rounded-xl border border-white/10 shadow-lg text-[9px] font-bold">
          {(
            [
              ['EA_BATTER', 'Behind Batter (EA 07)'],
              ['BROADCAST', 'Broadcast TV'],
              ['BOWLER_CAM', 'Bowler Cam'],
              ['ACTION_CAM', 'Action Cam'],
              ['ORBIT', '360° Orbit'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCameraMode(mode)}
              title={label}
              className={`px-2 py-1 rounded-lg transition-all ${
                cameraMode === mode
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'EA_BATTER' ? 'EA 07' : mode === 'BROADCAST' ? 'TV' : mode === 'BOWLER_CAM' ? 'Bowler' : mode === 'ACTION_CAM' ? 'Action' : 'Orbit'}
            </button>
          ))}
        </div>

        {/* Debug Skeleton & Collision Capsule Toggle */}
        <button
          type="button"
          onClick={() => setShowDebugSkeleton((v) => !v)}
          title={showDebugSkeleton ? 'Hide Debug Skeletons' : 'Show Debug Skeletons & IK Lines'}
          className={`flex items-center justify-center p-1.5 rounded-xl border backdrop-blur-md transition-all shadow-lg ${
            showDebugSkeleton
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              : 'bg-slate-950/80 border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interactive Drag & Orbit hint */}
      {cameraMode === 'ORBIT' && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-cyan-400/30 bg-slate-950/75 px-3 py-1 text-[10px] font-semibold text-cyan-200 backdrop-blur">
          Drag to rotate · Right-click to pan · Scroll to zoom
        </div>
      )}
    </div>
  );
}
