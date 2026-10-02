import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Shield, 
  Flame, 
  Sparkles, 
  RotateCcw, 
  Activity, 
  Eye, 
  CheckCircle2, 
  Sliders, 
  Layers, 
  Zap,
  Move,
  User,
  Play,
  Pause,
  StepForward,
  Compass,
  Maximize2,
  AlertTriangle,
  Trophy,
  Target
} from 'lucide-react';
import { BallOutcome } from '../types/match';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { cn } from '../lib/utils';
import { BOWLING_TACTICS_CONFIG, BowlingTactic, FieldPreset } from './CricketActionVisualizer';
import { createCricketCharacter, CricketPlayer3DInstance, PlayerAnimState } from './CricketPlayer3D';
import { adaptDeliveryTo3DSequence, Action3DSequence } from './Delivery3DActionAdapter';
import TVScoreboard, { TVScoreboardBatter, TVScoreboardBowler } from './TVScoreboard';
import { playEventSound } from '../lib/cricketAudioEngine';
import { BallCameraController, BallCameraState } from './BallCameraController';
import { fieldStrategyEngine } from '../engine/strategy/FieldStrategyEngine';

export type CameraMode = 'CAMERA_WIDE' | 'BROADCAST' | 'BALL_FOLLOW' | 'BATTER_FOCUS' | 'BOWLER_FOCUS' | 'WICKET_FOCUS';
export type AnimationSpeed = 1 | 1.5 | 2 | 0; // 1 = Normal (1x), 1.5 = Fast (1.5x, Default), 2 = Very Fast (2x), 0 = Skip/Instant

export interface Visualizer3DProps {
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
  trail?: number | null;
  onAnimationComplete?: () => void;
  className?: string;
  activeBowlingTactic?: BowlingTactic;
  onTacticChange?: (tactic: BowlingTactic) => void;
  onToggle2D?: () => void;
}

// Tactical Field presets in 3D Ground Coordinates (meters from pitch center)
export const FIELD_PRESETS_3D: Record<Exclude<FieldPreset, 'CUSTOM'>, { name: string; icon: string; positions: { name: string; x: number; z: number }[] }> = {
  BALANCED: {
    name: 'Balanced (4-5 Split)',
    icon: '🛡️',
    positions: [
      { name: '1st Slip', x: -3.8, z: 15.2 },
      { name: 'Gully', x: -8.5, z: 12.5 },
      { name: 'Point', x: -14.2, z: 9.5 },
      { name: 'Cover', x: -13.5, z: -1.5 },
      { name: 'Mid Off', x: -5.5, z: -11.0 },
      { name: 'Mid On', x: 5.5, z: -11.0 },
      { name: 'Mid Wicket', x: 13.0, z: -1.5 },
      { name: 'Square Leg', x: 14.5, z: 9.5 },
      { name: 'Deep Fine Leg', x: 14.0, z: 24.5 },
    ],
  },
  POWERPLAY: {
    name: 'Powerplay (Ring Field)',
    icon: '⚡',
    positions: [
      { name: 'First Slip', x: -3.5, z: 15.0 },
      { name: 'Backward Point', x: -12.5, z: 12.0 },
      { name: 'Cover Point', x: -14.0, z: 6.5 },
      { name: 'Extra Cover', x: -11.5, z: -3.0 },
      { name: 'Mid Off', x: -5.0, z: -9.5 },
      { name: 'Mid On', x: 5.0, z: -9.5 },
      { name: 'Mid Wicket', x: 12.0, z: -1.0 },
      { name: 'Square Leg', x: 13.5, z: 10.0 },
      { name: 'Deep Third Man', x: -18.0, z: 24.0 },
    ],
  },
  ATTACKING_TEST: {
    name: 'Slip Cordon (Test / Attack)',
    icon: '⚔️',
    positions: [
      { name: '1st Slip', x: -2.5, z: 15.5 },
      { name: '2nd Slip', x: -4.5, z: 16.5 },
      { name: '3rd Slip', x: -6.5, z: 17.5 },
      { name: 'Gully', x: -9.0, z: 13.5 },
      { name: 'Silly Point', x: -4.5, z: 7.5 },
      { name: 'Short Leg', x: 4.5, z: 7.5 },
      { name: 'Cover', x: -12.5, z: 1.0 },
      { name: 'Mid Off', x: -5.5, z: -10.5 },
      { name: 'Mid On', x: 5.5, z: -10.5 },
    ],
  },
  DEATH_OVERS: {
    name: 'Death Overs (5 Deep Protect)',
    icon: '🔒',
    positions: [
      { name: 'Short Third Man', x: -6.5, z: 13.5 },
      { name: 'Point', x: -12.5, z: 8.5 },
      { name: 'Extra Cover', x: -11.0, z: -1.5 },
      { name: 'Mid Wicket', x: 11.5, z: 1.0 },
      { name: 'Deep Point', x: -28.0, z: 9.5 },
      { name: 'Long Off', x: -12.0, z: -27.0 },
      { name: 'Long On', x: 12.0, z: -27.0 },
      { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5 },
      { name: 'Deep Square Leg', x: 27.0, z: 11.0 },
    ],
  },
  SPIN_TRAP: {
    name: 'Spin Web Trap',
    icon: '🕸️',
    positions: [
      { name: 'Slip', x: -3.5, z: 14.5 },
      { name: 'Backward Point', x: -11.0, z: 11.5 },
      { name: 'Cover', x: -11.5, z: 0.0 },
      { name: 'Forward Short Leg', x: 4.0, z: 7.0 },
      { name: 'Catching Mid-Wicket', x: 9.5, z: 3.0 },
      { name: 'Mid Off', x: -5.0, z: -10.0 },
      { name: 'Mid On', x: 5.0, z: -10.0 },
      { name: 'Deep Sweeper Cover', x: -27.0, z: -2.0 },
      { name: 'Deep Mid-Wicket', x: 25.0, z: -7.0 },
    ],
  },
};

interface FielderItem {
  name: string;
  char: CricketPlayer3DInstance;
  basePos: { x: number; y: number; z: number };
}

/**
 * Creates 3D Stumps and Bails Model
 */
function create3DStumpsSet(): { group: THREE.Group; bails: THREE.Mesh[]; stumps: THREE.Mesh[] } {
  const setGroup = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0xCD853F });
  const bailMat = new THREE.MeshLambertMaterial({ color: 0xFDE047 });

  const stumps: THREE.Mesh[] = [];
  [-0.11, 0, 0.11].forEach((xPos) => {
    const stumpGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.72, 10);
    const stump = new THREE.Mesh(stumpGeo, woodMat);
    stump.position.set(xPos, 0.36, 0);
    stump.castShadow = true;
    stump.receiveShadow = true;
    setGroup.add(stump);
    stumps.push(stump);
  });

  const bails: THREE.Mesh[] = [];
  [-0.055, 0.055].forEach((xPos) => {
    const bailGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8);
    const bail = new THREE.Mesh(bailGeo, bailMat);
    bail.rotation.z = Math.PI / 2;
    bail.position.set(xPos, 0.73, 0);
    bail.castShadow = true;
    setGroup.add(bail);
    bails.push(bail);
  });

  return { group: setGroup, bails, stumps };
}

export default function CricketActionVisualizer3D({
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
  className,
  activeBowlingTactic,
  onTacticChange,
  onToggle2D,
}: Visualizer3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Simulation Timeline State
  const isSimulatingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const currentProgressRef = useRef<number>(0);
  const currentSeqRef = useRef<Action3DSequence | null>(null);
  const isUserOrbitingRef = useRef<boolean>(false);

  // Character 3D Instances
  const strikerCharRef = useRef<CricketPlayer3DInstance | null>(null);
  const nonStrikerCharRef = useRef<CricketPlayer3DInstance | null>(null);
  const bowlerCharRef = useRef<CricketPlayer3DInstance | null>(null);
  const keeperCharRef = useRef<CricketPlayer3DInstance | null>(null);
  const fieldersListRef = useRef<FielderItem[]>([]);

  // Ball & Stumps Entities
  const ballMeshRef = useRef<THREE.Mesh | null>(null);
  const ballShadowRef = useRef<THREE.Mesh | null>(null);
  const bailsRef = useRef<THREE.Mesh[]>([]);
  const stumpsRef = useRef<THREE.Mesh[]>([]);

  // Ball-Locked Broadcast Camera Controller
  const ballCameraControllerRef = useRef<BallCameraController>(new BallCameraController());
  const [cameraStateName, setCameraStateName] = useState<string>('BROADCAST');

  // Visualizer UI Controls (Default 1.5x = Fast ~2.0-2.5s)
  const [cameraMode, setCameraMode] = useState<CameraMode>('BALL_FOLLOW');
  const [speed, setSpeed] = useState<AnimationSpeed>(1.5);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [showBowlerTactics, setShowBowlerTactics] = useState<boolean>(false);
  const [showFieldMenu, setShowFieldMenu] = useState<boolean>(false);
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const [stateProgress, setStateProgress] = useState<number>(0);
  const [currentActionState, setCurrentActionState] = useState<string>('READY');
  const [webglError, setWebglError] = useState<string | null>(null);

  // Live Player States for Debugging
  const [playerDebugStates, setPlayerDebugStates] = useState<{
    bowlerState: string;
    strikerState: string;
    keeperState: string;
    targetFielder: { name: string; state: string } | null;
  }>({
    bowlerState: 'BOWLING_READY',
    strikerState: 'BATTING_READY',
    keeperState: 'KEEPER_CROUCH',
    targetFielder: null,
  });

  const isTest = format === 'Test';
  const ballColorHex = isTest ? 0xDC2626 : 0xFFFFFF;
  const battingAccentHex = isTest ? 0x991B1B : 0x2563EB;
  const bowlingAccentHex = isTest ? 0x1E3A8A : 0xDC2626;

  const [selectedTactic, setSelectedTactic] = useState<BowlingTactic>(
    activeBowlingTactic || (bowler?.bowlingStyle?.toLowerCase().includes('spin') ? 'OFF_BREAK' : 'OUTSWING')
  );

  const tacticConfig = BOWLING_TACTICS_CONFIG[selectedTactic] || BOWLING_TACTICS_CONFIG.OUTSWING;

  // Sync prop changes
  useEffect(() => {
    if (activeBowlingTactic) setSelectedTactic(activeBowlingTactic);
  }, [activeBowlingTactic]);

  /**
   * Helper to reset all characters to their static, stable resting poses
   */
  const resetAllPlayersToReady = useCallback(() => {
    const isSpinner = selectedTactic.includes('SPIN') || selectedTactic.includes('BREAK') || selectedTactic.includes('DOOSRA') || selectedTactic.includes('GOOGLY');
    const startZ = isSpinner ? -15.0 : -21.0;
    if (bowlerCharRef.current) {
      bowlerCharRef.current.group.position.set(-0.5, 0.04, startZ);
      bowlerCharRef.current.group.rotation.y = 0;
      bowlerCharRef.current.updateAnimation('BOWLING_READY', 0);
    }

    if (strikerCharRef.current) {
      strikerCharRef.current.group.position.set(0, 0.04, 9.4);
      strikerCharRef.current.group.rotation.y = Math.PI;
      strikerCharRef.current.updateAnimation('BATTING_READY', 0);
    }

    if (nonStrikerCharRef.current) {
      nonStrikerCharRef.current.group.position.set(1.4, 0.04, -9.4);
      nonStrikerCharRef.current.group.rotation.y = 0;
      nonStrikerCharRef.current.updateAnimation('IDLE', 0);
    }

    if (keeperCharRef.current) {
      keeperCharRef.current.group.position.set(0, 0.04, 14.2);
      keeperCharRef.current.group.rotation.y = Math.PI;
      keeperCharRef.current.updateAnimation('KEEPER_CROUCH', 0);
    }

    // Dynamic Field Layout based on match phase, format, overs and partnership
    const currentOvers = overs || 0;
    const currentWickets = wickets || 0;
    const currentCRR = currentRunRate || 0;
    const currentRRR = requiredRunRate || null;
    const pRuns = partnership?.runs || 0;

    const dynamicField = fieldStrategyEngine.evaluate(
      format,
      currentOvers,
      currentWickets,
      currentCRR,
      currentRRR,
      isSpinner,
      'NONE',
      pRuns
    );

    fieldersListRef.current.forEach((f, idx) => {
      const pos = dynamicField.positions[idx] || f.basePos;
      f.name = pos.name;
      f.basePos = { x: pos.x, y: 0.04, z: pos.z };
      f.char.group.position.set(pos.x, 0.04, pos.z);
      f.char.group.lookAt(0, 0.04, 9.5);
      f.char.updateAnimation('FIELD_READY', 0);
    });

    if (ballMeshRef.current && bowlerCharRef.current) {
      const handPos = bowlerCharRef.current.getHandWorldPosition();
      ballMeshRef.current.position.copy(handPos);
    }
    if (ballShadowRef.current && ballMeshRef.current) {
      ballShadowRef.current.position.set(ballMeshRef.current.position.x, 0.025, ballMeshRef.current.position.z);
    }

    bailsRef.current.forEach((bail, idx) => {
      bail.position.set(idx === 0 ? -0.055 : 0.055, 0.73, 0);
      bail.rotation.set(0, 0, Math.PI / 2);
    });
    stumpsRef.current.forEach((stump, idx) => {
      stump.position.set(idx === 0 ? -0.11 : idx === 1 ? 0 : 0.11, 0.36, 0);
      stump.rotation.set(0, 0, 0);
    });

    setPlayerDebugStates({
      bowlerState: 'BOWLING_READY',
      strikerState: 'BATTING_READY',
      keeperState: 'KEEPER_CROUCH',
      targetFielder: null,
    });
  }, [selectedTactic, format, overs, wickets, currentRunRate, requiredRunRate, partnership]);

  /**
   * 1. Initialize High-Performance Three.js 3D Cricket World (ONCE on mount)
   */
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = Math.max(320, container.clientWidth || 600);
    const height = Math.max(240, container.clientHeight || 450);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;
    } catch (err: any) {
      console.warn('WebGL Initialization failed:', err);
      setWebglError('WebGL is not available in your browser.');
      return;
    }

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050c1e);
    scene.fog = new THREE.FogExp2(0x050c1e, 0.006);
    sceneRef.current = scene;

    // Camera — Default WIDE view showing full field
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 350);
    camera.position.set(0, 32, 42);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    container.replaceChildren(renderer.domElement);

    // ── Lighting & Stadium Atmosphere ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1a331a, 0.5);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(25, 45, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // ── 3D Cricket Field & Turf ──
    const fieldRadius = 38;
    const fieldGeo = new THREE.CylinderGeometry(fieldRadius, fieldRadius, 0.2, 48);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x194d19 });
    const field = new THREE.Mesh(fieldGeo, grassMat);
    field.position.y = -0.1;
    field.receiveShadow = true;
    scene.add(field);

    // Mower Stripe Pattern rings
    for (let r = 8; r < fieldRadius; r += 7) {
      const ringGeo = new THREE.RingGeometry(r, r + 3.5, 48);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x1d581d, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      scene.add(ring);
    }

    // 30-Yard Circle Line
    const circleGeo = new THREE.RingGeometry(18.5, 18.7, 48);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.35, transparent: true, side: THREE.DoubleSide });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.01;
    scene.add(circle);

    // Boundary Rope & LED Cushion Ring
    const ropeGeo = new THREE.TorusGeometry(fieldRadius - 0.5, 0.18, 8, 48);
    const ropeMat = new THREE.MeshLambertMaterial({ color: isTest ? 0x991B1B : 0x2563EB });
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.y = 0.18;
    scene.add(rope);

    // ── 3D Pitch Strip ──
    const pitchLength = 20.12;
    const pitchWidth = 3.05;
    const pitchGeo = new THREE.BoxGeometry(pitchWidth, 0.04, pitchLength);
    const pitchMat = new THREE.MeshLambertMaterial({ color: 0xC8A26A });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.position.set(0, 0.02, 0);
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Crease Lines
    const creaseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-10, 10].forEach((zPos) => {
      const pLine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.01, 0.08), creaseMat);
      pLine.position.set(0, 0.045, zPos > 0 ? zPos - 0.6 : zPos + 0.6);
      scene.add(pLine);

      const bLine = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.01, 0.05), creaseMat);
      bLine.position.set(0, 0.045, zPos);
      scene.add(bLine);
    });

    // ── 3D Stumps & Bails ──
    const batterStumps = create3DStumpsSet();
    batterStumps.group.position.set(0, 0.04, 10.1);
    scene.add(batterStumps.group);
    bailsRef.current = batterStumps.bails;
    stumpsRef.current = batterStumps.stumps;

    const bowlerStumps = create3DStumpsSet();
    bowlerStumps.group.position.set(0, 0.04, -10.1);
    scene.add(bowlerStumps.group);

    // ── 3D Cricket Ball & Ground Shadow ──
    const ballGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: ballColorHex,
      roughness: 0.35,
      metalness: 0.1,
      emissive: isTest ? 0x550000 : 0x222222,
      emissiveIntensity: 0.2
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.position.set(0, 1.8, -10);
    ballMesh.castShadow = true;
    scene.add(ballMesh);
    ballMeshRef.current = ballMesh;

    const shadowGeo = new THREE.CircleGeometry(0.16, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.set(0, 0.025, -10);
    scene.add(ballShadow);
    ballShadowRef.current = ballShadow;

    // ── Characters ──
    const strikerChar = createCricketCharacter({
      id: striker?.id || 'striker-1',
      name: striker?.name || 'Striker',
      role: 'BATTER',
      teamName: battingTeamName,
      teamAccentColorHex: battingAccentHex,
      isTestFormat: isTest,
      hasBat: true,
      hasPads: true,
      hasHelmet: true,
    });
    strikerChar.group.position.set(0, 0.04, 9.4);
    strikerChar.group.rotation.y = Math.PI;
    strikerChar.updateAnimation('BATTING_READY', 0);
    scene.add(strikerChar.group);
    strikerCharRef.current = strikerChar;

    const nonStrikerChar = createCricketCharacter({
      id: nonStriker?.id || 'non-striker-1',
      name: nonStriker?.name || 'Non-Striker',
      role: 'BATTER',
      teamName: battingTeamName,
      teamAccentColorHex: battingAccentHex,
      isTestFormat: isTest,
      hasBat: true,
      hasPads: true,
      hasHelmet: true,
    });
    nonStrikerChar.group.position.set(1.4, 0.04, -9.4);
    nonStrikerChar.updateAnimation('IDLE', 0);
    scene.add(nonStrikerChar.group);
    nonStrikerCharRef.current = nonStrikerChar;

    const bowlerChar = createCricketCharacter({
      id: bowler?.id || 'bowler-1',
      name: bowler?.name || 'Bowler',
      role: 'BOWLER',
      teamName: bowlingTeamName,
      teamAccentColorHex: bowlingAccentHex,
      isTestFormat: isTest,
      hasBat: false,
      hasPads: false,
      hasHelmet: false,
    });
    bowlerChar.group.position.set(-0.5, 0.04, -21);
    bowlerChar.updateAnimation('BOWLING_READY', 0);
    scene.add(bowlerChar.group);
    bowlerCharRef.current = bowlerChar;

    const keeperChar = createCricketCharacter({
      id: 'keeper-1',
      name: 'Wicketkeeper',
      role: 'WICKETKEEPER',
      teamName: bowlingTeamName,
      teamAccentColorHex: bowlingAccentHex,
      isTestFormat: isTest,
      hasBat: false,
      hasPads: true,
      hasHelmet: true,
      isWicketkeeper: true,
    });
    keeperChar.group.position.set(0, 0.04, 14.2);
    keeperChar.group.rotation.y = Math.PI;
    keeperChar.updateAnimation('KEEPER_CROUCH', 0);
    scene.add(keeperChar.group);
    keeperCharRef.current = keeperChar;

    const presetPositions = FIELD_PRESETS_3D.BALANCED.positions;
    const fieldersList: FielderItem[] = [];
    presetPositions.forEach((pos, idx) => {
      const fielderChar = createCricketCharacter({
        id: `fielder-${idx}`,
        name: pos.name,
        role: 'FIELDER',
        teamName: bowlingTeamName,
        teamAccentColorHex: bowlingAccentHex,
        isTestFormat: isTest,
        hasBat: false,
        hasPads: false,
        hasHelmet: false,
      });
      fielderChar.group.position.set(pos.x, 0.04, pos.z);
      fielderChar.group.lookAt(0, 0.04, 9.5);
      fielderChar.updateAnimation('FIELD_READY', 0);
      scene.add(fielderChar.group);
      fieldersList.push({
        name: pos.name,
        char: fielderChar,
        basePos: { x: pos.x, y: 0.04, z: pos.z },
      });
    });
    fieldersListRef.current = fieldersList;

    // ── Manual User Orbit Controls ──
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let sphericalTheta = 0;
    let sphericalPhi = 0.65;
    let sphericalRadius = 52;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      isUserOrbitingRef.current = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevMouseX;
      const deltaY = clientY - prevMouseY;
      prevMouseX = clientX;
      prevMouseY = clientY;

      sphericalTheta -= deltaX * 0.007;
      sphericalPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, sphericalPhi + deltaY * 0.007));

      if (camera) {
        camera.position.x = sphericalRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
        camera.position.y = sphericalRadius * Math.cos(sphericalPhi);
        camera.position.z = sphericalRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
        camera.lookAt(0, 0, 0);
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      setTimeout(() => {
        isUserOrbitingRef.current = false;
      }, 2500);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      isUserOrbitingRef.current = true;
      sphericalRadius = Math.max(15, Math.min(90, sphericalRadius + e.deltaY * 0.04));
      if (camera) {
        camera.position.x = sphericalRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
        camera.position.y = sphericalRadius * Math.cos(sphericalPhi);
        camera.position.z = sphericalRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
        camera.lookAt(0, 0, 0);
      }
      setTimeout(() => {
        isUserOrbitingRef.current = false;
      }, 2500);
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Robust Resize Handling with ResizeObserver
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = Math.max(320, container.clientWidth || 600);
      const h = Math.max(240, container.clientHeight || 450);
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', handleResize);

    // Continuous Render Loop with error guard
    let animId: number;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      try {
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      } catch (err) {
        console.warn('Three.js render loop warning:', err);
      }
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      try {
        renderer.dispose();
      } catch (e) {}
    };
  }, []); // Run ONCE on mount

  // Update Character Accent Colors dynamically when format / teams change
  useEffect(() => {
    if (strikerCharRef.current) strikerCharRef.current.setAccentColor(battingAccentHex);
    if (nonStrikerCharRef.current) nonStrikerCharRef.current.setAccentColor(battingAccentHex);
    if (bowlerCharRef.current) bowlerCharRef.current.setAccentColor(bowlingAccentHex);
    if (keeperCharRef.current) keeperCharRef.current.setAccentColor(bowlingAccentHex);
    fieldersListRef.current.forEach((f) => f.char.setAccentColor(bowlingAccentHex));
    if (ballMeshRef.current) {
      (ballMeshRef.current.material as THREE.MeshStandardMaterial).color.setHex(ballColorHex);
    }
  }, [format, ballColorHex, battingAccentHex, bowlingAccentHex]);

  // Procedural Audio Trigger Tracker (ensures sound fires once per phase)
  const audioTriggersRef = useRef<{
    bounce: boolean;
    contact: boolean;
    stumps: boolean;
    appeal: boolean;
    catch: boolean;
    boundary: boolean;
    emotion: boolean;
  }>({
    bounce: false,
    contact: false,
    stumps: false,
    appeal: false,
    catch: false,
    boundary: false,
    emotion: false,
  });

  /**
   * 2. Full 3D Physical Delivery & Skeletal Animation Synchronization Engine
   */
  const executeDeliveryFrame = useCallback((p: number, seq: Action3DSequence) => {
    currentProgressRef.current = p;
    setStateProgress(Math.round(p * 100));

    const { phases, ballTrajectory } = seq;
    const ballMesh = ballMeshRef.current;
    const ballShadow = ballShadowRef.current;
    const bowlerChar = bowlerCharRef.current;
    const strikerChar = strikerCharRef.current;
    const nonStrikerChar = nonStrikerCharRef.current;
    const keeperChar = keeperCharRef.current;
    const camera = cameraRef.current;

    const isSpinner = selectedTactic.includes('SPIN') || selectedTactic.includes('BREAK') || selectedTactic.includes('DOOSRA') || selectedTactic.includes('GOOGLY');
    const startBowlerZ = isSpinner ? -15.0 : -21.0;

    let targetFielderItem: FielderItem | null = null;
    if (fieldersListRef.current.length > 0) {
      let minDist = Infinity;
      fieldersListRef.current.forEach((f) => {
        const d = Math.hypot(f.basePos.x - ballTrajectory.targetPos.x, f.basePos.z - ballTrajectory.targetPos.z);
        if (d < minDist) {
          minDist = d;
          targetFielderItem = f;
        }
      });
    }

    // ── Phase 1: Bowler Run-Up (0.00 - phases.runupEnd) ──
    if (p < phases.runupEnd) {
      setCurrentActionState('BOWLER_RUNUP');
      const pRun = p / phases.runupEnd;
      const curZ = startBowlerZ + (pRun * (Math.abs(startBowlerZ) - 10.0));

      if (bowlerChar) {
        bowlerChar.group.position.z = curZ;
        bowlerChar.updateAnimation('RUN_UP', pRun);
      }

      if (ballMesh && bowlerChar) {
        const handPos = bowlerChar.getHandWorldPosition();
        ballMesh.position.copy(handPos);
      }
      if (ballShadow && ballMesh) {
        ballShadow.position.set(ballMesh.position.x, 0.025, ballMesh.position.z);
      }

      if (strikerChar) strikerChar.updateAnimation('BATTING_READY', pRun);
      if (keeperChar) keeperChar.updateAnimation('KEEPER_CROUCH', 0);
      fieldersListRef.current.forEach((f) => f.char.updateAnimation('FIELD_READY', 0));

      setPlayerDebugStates({
        bowlerState: 'RUN_UP',
        strikerState: 'BATTING_READY',
        keeperState: 'KEEPER_CROUCH',
        targetFielder: null,
      });
    }

    // ── Phase 2: Delivery Stride & Windmill to Bounce (phases.runupEnd - phases.bounceEnd) ──
    else if (p < phases.bounceEnd) {
      setCurrentActionState('BALL_FLIGHT');
      const pFlight = (p - phases.runupEnd) / (phases.bounceEnd - phases.runupEnd);
      const startZ = -9.5;
      const endZ = ballTrajectory.bouncePos.z;

      if (bowlerChar) {
        if (pFlight < 0.4) {
          bowlerChar.updateAnimation('DELIVERY_STRIDE', pFlight / 0.4);
        } else {
          bowlerChar.updateAnimation('FOLLOW_THROUGH', (pFlight - 0.4) / 0.6);
        }
      }

      if (strikerChar) strikerChar.updateAnimation('BACKLIFT', pFlight);
      if (keeperChar) keeperChar.updateAnimation('KEEPER_CROUCH', pFlight);

      const swingCurve = ballTrajectory.swingFactor * Math.sin(pFlight * Math.PI) * 0.14;
      const curX = ballTrajectory.bouncePos.x * pFlight + swingCurve;
      const curZ = startZ + (endZ - startZ) * pFlight;
      const curY = 1.9 * (1 - pFlight) + 0.04 + Math.sin(pFlight * Math.PI) * 0.8;

      if (ballMesh) {
        ballMesh.position.set(curX, curY, curZ);
        ballMesh.rotation.z = (tacticConfig.seamAngle * Math.PI) / 180;
      }
      if (ballShadow) {
        ballShadow.position.set(curX, 0.025, curZ);
        const shadowScale = Math.max(0.2, 1 - (curY / 4));
        ballShadow.scale.set(shadowScale, shadowScale, 1);
      }

      setPlayerDebugStates({
        bowlerState: 'FOLLOW_THROUGH',
        strikerState: 'BACKLIFT',
        keeperState: 'KEEPER_CROUCH',
        targetFielder: null,
      });
    }

    // ── Phase 3: Bounce to Bat Contact (phases.bounceEnd - phases.contactEnd) ──
    else if (p < phases.contactEnd) {
      setCurrentActionState('BOUNCE');
      if (!audioTriggersRef.current.bounce) {
        audioTriggersRef.current.bounce = true;
        playEventSound('BALL_BOUNCE', 0.5);
      }

      const pBounce = (p - phases.bounceEnd) / (phases.contactEnd - phases.bounceEnd);
      const startZ = ballTrajectory.bouncePos.z;
      const endZ = 9.5;

      const curX = ballTrajectory.bouncePos.x + (ballTrajectory.seamDeviation * pBounce);
      const curZ = startZ + (endZ - startZ) * pBounce;
      const curY = 0.05 + Math.sin(pBounce * Math.PI) * ballTrajectory.apexHeight;

      if (ballMesh) ballMesh.position.set(curX, curY, curZ);
      if (ballShadow) {
        ballShadow.position.set(curX, 0.025, curZ);
        ballShadow.scale.set(1 - curY / 3, 1 - curY / 3, 1);
      }

      if (strikerChar) strikerChar.updateAnimation(seq.batterAnim, pBounce * 0.5);

      setPlayerDebugStates({
        bowlerState: 'FOLLOW_THROUGH',
        strikerState: seq.batterAnim,
        keeperState: 'KEEPER_CROUCH',
        targetFielder: null,
      });
    }

    // ── Phase 4: Bat Strike, Ball Flight, Running, & Fielding (phases.contactEnd - phases.fieldingEnd) ──
    else if (p < phases.fieldingEnd) {
      setCurrentActionState('SHOT_TRAVEL');
      if (!audioTriggersRef.current.contact && !seq.isLeave && !seq.isLBW) {
        audioTriggersRef.current.contact = true;
        playEventSound(seq.isSix ? 'BAT_SIX' : 'BAT_HIT', 0.8);
      }
      if (!audioTriggersRef.current.appeal && (seq.isLBW || (seq.isCaught && seq.isEdge))) {
        audioTriggersRef.current.appeal = true;
        playEventSound('APPEAL', 0.6);
      }

      const pShot = (p - phases.contactEnd) / (phases.fieldingEnd - phases.contactEnd);
      const startX = 0;
      const startZ = 9.5;

      if (strikerChar) strikerChar.updateAnimation(seq.batterAnim, 0.5 + pShot * 0.5);

      const curX = startX + (ballTrajectory.targetPos.x - startX) * pShot;
      const curZ = startZ + (ballTrajectory.targetPos.z - startZ) * pShot;
      let curY = 0.08;

      if (seq.isSix) {
        const apexHeight = 11.5;
        curY = 0.08 + Math.sin(pShot * Math.PI) * apexHeight;
      } else {
        let bounceSkip = 0;
        if (pShot < 0.35) bounceSkip = Math.sin((pShot / 0.35) * Math.PI) * 0.45;
        else if (pShot < 0.7) bounceSkip = Math.sin(((pShot - 0.35) / 0.35) * Math.PI) * 0.2;
        curY = 0.08 + bounceSkip;
      }

      if (ballMesh) {
        ballMesh.position.set(curX, curY, curZ);
        ballMesh.rotation.x += 0.45;
      }
      if (ballShadow) {
        ballShadow.position.set(curX, 0.025, curZ);
        const shadowScale = Math.max(0.2, 1 - (curY / 14));
        ballShadow.scale.set(shadowScale, shadowScale, 1);
      }

      if (seq.runs > 0 && !seq.isWicket) {
        const runMultiplier = seq.runs === 1 ? 1.0 : seq.runs === 2 ? 1.8 : 2.6;
        const runCycle = Math.min(1, pShot * runMultiplier);
        const sZ = 9.4 - (runCycle * 18.8);
        const nsZ = -9.4 + (runCycle * 18.8);

        if (strikerChar) {
          strikerChar.group.position.z = sZ;
          strikerChar.updateAnimation('RUN_BETWEEN_WICKETS', pShot * 3);
        }
        if (nonStrikerChar) {
          nonStrikerChar.group.position.z = nsZ;
          nonStrikerChar.updateAnimation('RUN_BETWEEN_WICKETS', pShot * 3);
        }
      }

      if (targetFielderItem) {
        const tf = targetFielderItem as FielderItem;
        const targetX = tf.basePos.x + (ballTrajectory.targetPos.x - tf.basePos.x) * (pShot * 0.6);
        const targetZ = tf.basePos.z + (ballTrajectory.targetPos.z - tf.basePos.z) * (pShot * 0.6);
        tf.char.group.position.set(targetX, tf.basePos.y, targetZ);
        tf.char.group.lookAt(ballTrajectory.targetPos.x, 0.04, ballTrajectory.targetPos.z);

        if (seq.isCatch) {
          if (pShot < 0.65) tf.char.updateAnimation('RUN_TO_BALL', pShot);
          else {
            tf.char.updateAnimation('HIGH_CATCH', (pShot - 0.65) / 0.35);
            if (!audioTriggersRef.current.catch) {
              audioTriggersRef.current.catch = true;
              playEventSound('CROWD_WICKET', 0.8);
            }
          }
        } else {
          if (pShot < 0.65) tf.char.updateAnimation('RUN_TO_BALL', pShot);
          else if (pShot < 0.85) tf.char.updateAnimation('GROUND_FIELD', (pShot - 0.65) / 0.2);
          else tf.char.updateAnimation('THROW', (pShot - 0.85) / 0.15);
        }
      }

      if (keeperChar) {
        if (seq.isWicket && seq.wicketType?.toLowerCase().includes('caught behind')) {
          keeperChar.updateAnimation('KEEPER_CATCH', pShot);
        } else if (seq.isWicket && seq.wicketType?.toLowerCase().includes('stump')) {
          keeperChar.updateAnimation('KEEPER_STUMPING', pShot);
        } else if (seq.runs === 0 && !seq.isFour && !seq.isSix) {
          keeperChar.updateAnimation('KEEPER_COLLECT', pShot);
        }
      }

      if (seq.isBowled && pShot > 0.05) {
        if (!audioTriggersRef.current.stumps) {
          audioTriggersRef.current.stumps = true;
          playEventSound('STUMPS_SHATTER', 0.9);
          playEventSound('CROWD_WICKET', 0.8);
        }
        bailsRef.current.forEach((bail, i) => {
          bail.position.y += 0.08;
          bail.position.x += i === 0 ? -0.05 : 0.05;
          bail.rotation.z += 0.2;
        });
        stumpsRef.current.forEach((stump) => {
          stump.rotation.x = -0.3;
        });
        if (bowlerChar) bowlerChar.updateAnimation('BOWLER_CELEBRATION', pShot);
        if (strikerChar) strikerChar.updateAnimation('BOWLED_REACTION', pShot);
      }

      if (!audioTriggersRef.current.boundary && (seq.isSix || seq.isFour) && pShot > 0.7) {
        audioTriggersRef.current.boundary = true;
        playEventSound(seq.isSix ? 'CROWD_CHEER_SIX' : 'CROWD_CHEER_FOUR', 0.8);
      }

      setPlayerDebugStates({
        bowlerState: seq.isBowled ? 'BOWLER_CELEBRATION' : 'IDLE',
        strikerState: seq.runs > 0 ? 'RUN_BETWEEN_WICKETS' : seq.batterAnim,
        keeperState: seq.isWicket ? 'KEEPER_CATCH' : 'KEEPER_COLLECT',
        targetFielder: targetFielderItem ? { name: (targetFielderItem as FielderItem).name, state: seq.isCatch ? 'HIGH_CATCH' : 'GROUND_FIELD' } : null,
      });
    }

    // ── Phase 5: Emotion, Celebration & Reactions (phases.fieldingEnd - phases.emotionEnd) ──
    else if (p < phases.emotionEnd) {
      setCurrentActionState('EMOTION_REACTION');
      const pEmotion = (p - phases.fieldingEnd) / (phases.emotionEnd - phases.fieldingEnd);

      if (!audioTriggersRef.current.emotion && (seq.milestone || seq.isMatchWinning)) {
        audioTriggersRef.current.emotion = true;
        playEventSound(seq.isMatchWinning ? 'VICTORY_ROAR' : 'MILESTONE_APPLAUSE', 0.9);
      }

      // Striker Reaction (Bat Raise on 50/100, Fist pump on 6, Disappointment walk on wicket)
      if (strikerChar) {
        strikerChar.updateAnimation(seq.strikerReactionAnim, pEmotion);
      }

      // Non-Striker Reaction (Bat tap, applause, high five)
      if (nonStrikerChar) {
        nonStrikerChar.updateAnimation(seq.nonStrikerReactionAnim, pEmotion);
      }

      // Bowler Reaction (Ecstatic jump, appeal, hands on head)
      if (bowlerChar) {
        bowlerChar.updateAnimation(seq.bowlerReactionAnim, pEmotion);
      }

      // Keeper Reaction
      if (keeperChar) {
        keeperChar.updateAnimation(seq.keeperReactionAnim, pEmotion);
      }

      // Nearby Fielders Celebrate
      fieldersListRef.current.forEach((f, idx) => {
        if (seq.isWicket || seq.isMatchWinning) {
          if (idx < 3) {
            f.char.updateAnimation(seq.fielderReactionAnim, pEmotion);
          } else {
            f.char.updateAnimation('FIELD_READY', 0);
          }
        } else {
          f.char.updateAnimation('FIELD_READY', 0);
        }
      });

      setPlayerDebugStates({
        bowlerState: `${seq.bowlerReactionAnim} (${seq.bowlerEmotion})`,
        strikerState: `${seq.strikerReactionAnim} (${seq.strikerEmotion})`,
        keeperState: `${seq.keeperReactionAnim} (${seq.keeperEmotion})`,
        targetFielder: targetFielderItem ? { name: (targetFielderItem as FielderItem).name, state: seq.fielderReactionAnim } : null,
      });
    }

    // ── Phase 6: TV Result Presentation & Score Sync (phases.emotionEnd - 1.00) ──
    else {
      setCurrentActionState('RESULT');
      setResultBanner(seq.resultLabel);
    }

    // ── Ball-Locked Camera Director ──
    if (camera && ballMesh && !isUserOrbitingRef.current) {
      if (cameraMode === 'BALL_FOLLOW' || cameraMode === 'BROADCAST') {
        const targetFielderPos = targetFielderItem?.basePos
          ? new THREE.Vector3(targetFielderItem.basePos.x, targetFielderItem.basePos.y, targetFielderItem.basePos.z)
          : null;
        const camResult = ballCameraControllerRef.current.update(
          camera,
          p,
          seq,
          ballMesh.position,
          targetFielderPos,
          0.016
        );
        setCameraStateName(camResult.state);
      } else if (cameraMode === 'CAMERA_WIDE') {
        camera.position.lerp(new THREE.Vector3(0, 32, 42), 0.12);
        camera.lookAt(0, 0, 0);
        setCameraStateName('WIDE');
      } else if (cameraMode === 'BATTER_FOCUS') {
        camera.position.lerp(new THREE.Vector3(-2.5, 3.0, 4.0), 0.12);
        camera.lookAt(0, 1.2, 9.4);
        setCameraStateName('BATTER');
      } else if (cameraMode === 'BOWLER_FOCUS') {
        camera.position.lerp(new THREE.Vector3(2.5, 3.0, -18.0), 0.12);
        camera.lookAt(0, 1.2, -10.0);
        setCameraStateName('BOWLER');
      } else if (cameraMode === 'WICKET_FOCUS') {
        camera.position.lerp(new THREE.Vector3(0, 2.0, 13.5), 0.12);
        camera.lookAt(0, 0.7, 10.1);
        setCameraStateName('STUMPS');
      }
    }
  }, [selectedTactic, tacticConfig.seamAngle, cameraMode]);

  /**
   * 3. Run Delivery Animation Controller
   */
  const run3DDeliveryAnimation = useCallback(() => {
    if (!lastBall || speed === 0) {
      if (lastBall) {
        setResultBanner(lastBall.isWicket ? 'WICKET!' : lastBall.runs === 6 ? 'SIX!' : lastBall.runs === 4 ? 'FOUR!' : `${lastBall.runs} RUNS`);
      }
      onAnimationComplete?.();
      return;
    }

    // Reset audio flags for this delivery
    audioTriggersRef.current = {
      bounce: false,
      contact: false,
      stumps: false,
      appeal: false,
      catch: false,
      boundary: false,
      emotion: false,
    };

    const seq: Action3DSequence = adaptDeliveryTo3DSequence(lastBall, selectedTactic, {
      strikerScore: strikerStats?.runs,
      strikerName: striker?.name,
      bowlerWickets: bowlerStats?.wickets,
      bowlerName: bowler?.name,
      partnershipRuns: partnership?.runs,
      partnershipBalls: partnership?.balls,
      target,
      currentScore: score,
      ballsRemaining: totalOvers ? Math.max(0, totalOvers * 6 - (balls || 0)) : undefined,
      isTestFormat: isTest,
    });
    currentSeqRef.current = seq;

    isSimulatingRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    setResultBanner(null);

    resetAllPlayersToReady();
    ballCameraControllerRef.current.reset(cameraRef.current || undefined);

    const speedMultiplier = speed === 1 ? 1.0 : speed === 1.5 ? 0.72 : 0.48;
    const baseDuration = seq.baseDurationMs * speedMultiplier;

    let startTime: number | null = null;
    let pausedTimeOffset = 0;
    let pauseStart: number | null = null;

    const step3D = (timestamp: number) => {
      if (isPausedRef.current) {
        if (!pauseStart) pauseStart = timestamp;
        animFrameIdRef.current = requestAnimationFrame(step3D);
        return;
      } else if (pauseStart) {
        pausedTimeOffset += timestamp - pauseStart;
        pauseStart = null;
      }

      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime - pausedTimeOffset;
      const p = Math.min(1, Math.max(0, elapsed / baseDuration));

      executeDeliveryFrame(p, seq);

      if (p < 1) {
        animFrameIdRef.current = requestAnimationFrame(step3D);
      } else {
        isSimulatingRef.current = false;
        onAnimationComplete?.();
      }
    };

    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    animFrameIdRef.current = requestAnimationFrame(step3D);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [lastBall, speed, selectedTactic, strikerStats, striker, bowlerStats, bowler, partnership, target, score, totalOvers, balls, isTest, resetAllPlayersToReady, executeDeliveryFrame, onAnimationComplete]);

  // Step action (+5% advance when paused)
  const handleStepAction = () => {
    if (!currentSeqRef.current) return;
    const nextP = Math.min(1, currentProgressRef.current + 0.05);
    executeDeliveryFrame(nextP, currentSeqRef.current);
  };

  // Toggle pause
  const handleTogglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
  };

  // Trigger on delivery change
  useEffect(() => {
    if (ballCount > 0) {
      run3DDeliveryAnimation();
    }
  }, [ballCount, run3DDeliveryAnimation]);

  return (
    <div className={cn("relative flex flex-col items-center select-none bg-[#030712] rounded-2xl overflow-hidden border border-white/10 shadow-2xl touch-none", className)}>
      {/* ── Broadcast Top Bar ── */}
      <div className="w-full px-4 py-2.5 bg-black/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between z-30 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isTest ? "bg-red-500" : "bg-cyan-400")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
            {format} 3D CRICKET BROADCAST
          </span>
          {isFreeHit && (
            <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-black uppercase animate-bounce">
              Free Hit
            </span>
          )}
        </div>

        {/* 3D Camera, Bowler Tactics & Match Speed Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Camera Presets */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setCameraMode('CAMERA_WIDE')}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                cameraMode === 'CAMERA_WIDE' ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
              )}
              title="Wide View (All Fielders Visible)"
            >
              🌐 Wide
            </button>
            <button
              onClick={() => setCameraMode('BROADCAST')}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                cameraMode === 'BROADCAST' ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
              )}
              title="Main Broadcast Camera"
            >
              🎥 TV
            </button>
            <button
              onClick={() => setCameraMode('BALL_FOLLOW')}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                cameraMode === 'BALL_FOLLOW' ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
              )}
              title="Follow Ball Flight"
            >
              ⚽ Ball
            </button>
            <button
              onClick={() => setCameraMode('BATTER_FOCUS')}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                cameraMode === 'BATTER_FOCUS' ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
              )}
              title="Batter Focus"
            >
              🏏 Batter
            </button>
          </div>

          {/* Bowler Tactics */}
          <button
            onClick={() => { setShowBowlerTactics(!showBowlerTactics); setShowFieldMenu(false); }}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border",
              showBowlerTactics 
                ? "bg-amber-500 text-black border-amber-400 font-black shadow-md" 
                : "bg-white/5 border-white/10 text-white/80 hover:text-white"
            )}
            title="Bowling Options"
          >
            <span>{tacticConfig.icon}</span>
            <span>{tacticConfig.name.split(' ')[0]}</span>
          </button>

          {/* Debug Panel Toggle */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={cn(
              "px-2 py-1 rounded-lg text-[9px] font-bold border transition-all",
              debugMode ? "bg-emerald-500 text-black border-emerald-400 font-black" : "bg-white/5 border-white/10 text-white/70"
            )}
            title="Toggle Debug Mode"
          >
            🛠️ Debug
          </button>

          {/* 2D / 3D Switch */}
          {onToggle2D && (
            <button
              onClick={onToggle2D}
              className="px-2 py-1 rounded-lg text-[9px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10"
              title="Switch to 2D Stadium Map"
            >
              2D Map
            </button>
          )}

          {/* Fast Match Speed Controls */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
            {([1, 1.5, 2] as AnimationSpeed[]).map((sp) => (
              <button
                key={sp}
                onClick={() => setSpeed(sp)}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                  speed === sp ? "bg-white text-black font-black shadow-sm" : "bg-white/5 text-white/50 hover:text-white"
                )}
                title={sp === 1.5 ? "Fast Match Speed (~2.2s per ball)" : sp === 2 ? "Very Fast Speed (~1.5s per ball)" : "Normal Speed (~2.8s per ball)"}
              >
                {sp}x
              </button>
            ))}
          </div>

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
        </div>
      </div>

      {/* ── Bowler Tactics Drawer ── */}
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
                <Flame className="w-3 h-3 text-amber-400" /> Select 3D Delivery Variations & Swing Physics
              </span>
              <span className="text-[9px] text-white/50">
                Active: <strong className="text-white">{tacticConfig.name}</strong> ({tacticConfig.speedLabel})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(Object.keys(BOWLING_TACTICS_CONFIG) as BowlingTactic[]).map((tac) => {
                const cfg = BOWLING_TACTICS_CONFIG[tac];
                const isSel = selectedTactic === tac;
                return (
                  <button
                    key={tac}
                    onClick={() => {
                      setSelectedTactic(tac);
                      onTacticChange?.(tac);
                    }}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3D Viewport with Realistic Character Rigging ── */}
      <div className="relative w-full aspect-[4/3] min-h-[300px] max-w-[640px] overflow-hidden flex items-center justify-center bg-[#050c1e]">
        {webglError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-400 animate-bounce" />
            <div className="text-sm font-bold text-white">3D Canvas Mode</div>
            <div className="text-xs text-white/60 max-w-xs">{webglError}</div>
            {onToggle2D && (
              <button
                onClick={onToggle2D}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-black text-xs shadow-lg hover:bg-cyan-400 transition-all"
              >
                Switch to 2D Stadium Map
              </button>
            )}
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        )}

        {/* Live Camera State Indicator */}
        <div className="absolute top-2.5 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-bold text-white/80 shadow-md">
          <Camera className="w-3 h-3 text-cyan-400" />
          <span className="text-cyan-300 font-mono font-black tracking-wider uppercase">{cameraStateName}</span>
        </div>

        {/* ── On-Screen Interactive Controls ── */}
        <div className="absolute bottom-2 left-3 z-30 flex items-center gap-1 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/10">
          <button
            onClick={run3DDeliveryAnimation}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 transition-all text-xs flex items-center gap-1 font-bold"
            title="Play / Replay Delivery"
          >
            <Play className="w-3.5 h-3.5" /> Replay
          </button>
          <button
            onClick={handleTogglePause}
            className={cn(
              "p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 font-bold",
              isPaused ? "bg-amber-500 text-black font-black" : "bg-white/10 hover:bg-white/20 text-white"
            )}
            title={isPaused ? "Resume" : "Pause Delivery"}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          {isPaused && (
            <button
              onClick={handleStepAction}
              className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-all text-xs flex items-center gap-1 font-bold"
              title="Step +5%"
            >
              <StepForward className="w-3.5 h-3.5" /> Step
            </button>
          )}
          <button
            onClick={resetAllPlayersToReady}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 transition-all text-xs"
            title="Reset Players to Ready Positions"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── TV Broadcast Action & Milestone Graphics Overlay (Appears during result/milestone phase) ── */}
        <AnimatePresence>
          {resultBanner && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 text-center pointer-events-none"
            >
              {/* Milestone Card (e.g. CENTURY, FIFTY, 5-WKT, MATCH WIN) */}
              {currentSeqRef.current?.milestone ? (
                <div className="flex flex-col items-center bg-black/90 backdrop-blur-2xl px-6 py-4 rounded-2xl border-2 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.35)] min-w-[240px]">
                  <div className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-black text-[9px] uppercase tracking-widest mb-1 shadow-sm">
                    {currentSeqRef.current.milestone.badge || 'MILESTONE'}
                  </div>
                  <div className="font-black text-2xl tracking-wider text-amber-300 drop-shadow-md flex items-center gap-1.5">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    {currentSeqRef.current.milestone.title}
                  </div>
                  <div className="text-xs font-bold text-white/90 mt-0.5">
                    {currentSeqRef.current.milestone.subtitle}
                  </div>
                  {currentSeqRef.current.milestone.statValue && (
                    <div className="mt-1 text-sm font-black font-mono text-cyan-300 bg-white/10 px-3 py-0.5 rounded-lg">
                      {currentSeqRef.current.milestone.statValue}
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Event Banner (SIX, FOUR, WICKET, RUNS) */
                <div
                  className={cn(
                    "px-7 py-3 rounded-2xl backdrop-blur-xl border font-black text-2xl tracking-wider shadow-2xl flex items-center justify-center gap-2",
                    resultBanner.includes('SIX') && "bg-purple-950/90 border-purple-400 text-purple-200 shadow-purple-500/50 text-3xl animate-pulse",
                    resultBanner.includes('FOUR') && "bg-blue-950/90 border-blue-400 text-blue-200 shadow-blue-500/50 text-3xl",
                    resultBanner.includes('WICKET') && "bg-red-950/95 border-red-500 text-red-100 shadow-red-500/60 text-3xl",
                    resultBanner.includes('RUN') && "bg-zinc-900/90 border-white/20 text-white text-xl",
                    resultBanner.includes('DOT') && "bg-black/90 border-white/10 text-white/70 text-base"
                  )}
                >
                  {resultBanner.includes('SIX') && <Sparkles className="w-6 h-6 text-amber-300 animate-spin" />}
                  {resultBanner.includes('WICKET') && <Flame className="w-6 h-6 text-red-400 animate-pulse" />}
                  {resultBanner}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Debug Overlay & Inspection Panel ── */}
        {debugMode && (
          <div className="absolute top-3 left-3 bg-black/95 border border-white/15 rounded-xl p-3 text-[9px] font-mono text-cyan-300 space-y-1.5 z-40 shadow-2xl max-w-[280px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="text-emerald-400 font-bold uppercase">🛠️ 3D MATCH DEBUG</span>
              <span className="text-white/60">{stateProgress}%</span>
            </div>

            <div className="space-y-0.5 text-[8.5px]">
              <div>FORMAT: <span className="text-white font-bold">{format}</span></div>
              <div>OVER: <span className="text-white font-bold">{overs ?? 0}.{(balls ?? 0) % 6}</span> | SCORE: <span className="text-amber-300 font-bold">{score ?? 0}/{wickets ?? 0}</span></div>
              <div>BATTER: <span className="text-emerald-300 font-bold">{striker?.name || 'Striker'} ({playerDebugStates.strikerState})</span></div>
              <div>BOWLER: <span className="text-amber-300 font-bold">{bowler?.name || 'Bowler'} ({selectedTactic})</span></div>
              <div>ACTION STATE: <span className="text-white font-bold">{currentActionState}</span></div>
              <div>TIMELINE: <span className="text-cyan-300 font-bold">{cameraStateName}</span></div>
              <div>SPEED: <span className="text-amber-300 font-bold">{speed}x</span></div>
              <div>KEEPER: <span className="text-cyan-300 font-bold">{playerDebugStates.keeperState}</span></div>
              {playerDebugStates.targetFielder && (
                <div>FIELDER: <span className="text-purple-300 font-bold">{playerDebugStates.targetFielder.name} ({playerDebugStates.targetFielder.state})</span></div>
              )}
            </div>

            {/* Quick Camera Jump Buttons */}
            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-white/10">
              <button
                onClick={() => setCameraMode('CAMERA_WIDE')}
                className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[8px] font-bold"
              >
                🌐 Wide View
              </button>
              <button
                onClick={() => setCameraMode('BROADCAST')}
                className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[8px] font-bold"
              >
                🎥 Broadcast
              </button>
              <button
                onClick={() => setCameraMode('BATTER_FOCUS')}
                className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[8px] font-bold"
              >
                🏏 Batter Cam
              </button>
              <button
                onClick={() => setCameraMode('BOWLER_FOCUS')}
                className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[8px] font-bold"
              >
                🎯 Bowler Cam
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Professional TV Broadcast Scoreboard Overlay ── */}
      <TVScoreboard
        battingTeamName={battingTeamName}
        bowlingTeamName={bowlingTeamName}
        battingTeamShortName={battingTeamShortName}
        teamLogo={teamLogo}
        teamAccentColor={teamAccentColor || (isTest ? '#991B1B' : '#2563EB')}
        score={score ?? (ballCount > 0 ? (lastBall?.runs ? 156 + (lastBall.runs || 0) : 156) : 0)}
        wickets={wickets ?? (lastBall?.isWicket ? 4 : 3)}
        overs={overs ?? Math.floor(ballCount / 6)}
        balls={balls ?? ballCount}
        totalOvers={totalOvers ?? (format === 'T20' || format === 'IPL' ? 20 : format === 'ODI' ? 50 : 90)}
        target={target}
        currentRunRate={currentRunRate}
        requiredRunRate={requiredRunRate}
        striker={strikerStats || (striker ? { name: striker.name, runs: 62, balls: 38, fours: 5, sixes: 2, strikeRate: 163.15, isStriker: true } : null)}
        nonStriker={nonStrikerStats || (nonStriker ? { name: nonStriker.name, runs: 21, balls: 15, fours: 2, sixes: 0, strikeRate: 140.0, isStriker: false } : null)}
        bowler={bowlerStats || (bowler ? { name: bowler.name, overs: 3.3, runs: 28, wickets: 2, economy: 8.0 } : null)}
        recentBalls={recentBalls || (lastBall ? [lastBall.isWicket ? 'W' : lastBall.runs === 6 ? '6' : lastBall.runs === 4 ? '4' : `${lastBall.runs}`] : ['1', '0', '4', '0', 'W', '2'])}
        partnership={partnership}
        format={format}
        innings={innings}
        day={day}
        session={session}
        lead={lead}
        trail={trail}
        activeEventBadge={resultBanner && (resultBanner.includes('SIX') ? 'SIX' : resultBanner.includes('FOUR') ? 'FOUR' : resultBanner.includes('WICKET') ? 'WICKET' : null)}
        isFreeHit={isFreeHit}
      />
    </div>
  );
}
