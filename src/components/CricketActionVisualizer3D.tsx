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
  Maximize2
} from 'lucide-react';
import { BallOutcome } from '../types/match';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { cn } from '../lib/utils';
import { BOWLING_TACTICS_CONFIG, BowlingTactic, FieldPreset } from './CricketActionVisualizer';
import { createCricketCharacter, CricketPlayer3DInstance, PlayerAnimState } from './CricketPlayer3D';
import { adaptDeliveryTo3DSequence, Action3DSequence } from './Delivery3DActionAdapter';

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
  isFreeHit?: boolean;
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
  isFreeHit = false,
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

  // Visualizer UI Controls (Default 1.5x = Fast ~2.0-2.5s)
  const [cameraMode, setCameraMode] = useState<CameraMode>('CAMERA_WIDE');
  const [speed, setSpeed] = useState<AnimationSpeed>(1.5);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [showBowlerTactics, setShowBowlerTactics] = useState<boolean>(false);
  const [showFieldMenu, setShowFieldMenu] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<FieldPreset>('BALANCED');
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const [stateProgress, setStateProgress] = useState<number>(0);
  const [currentActionState, setCurrentActionState] = useState<string>('READY');

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
    // Bowler at bowling mark
    const isSpinner = selectedTactic.includes('SPIN') || selectedTactic.includes('BREAK') || selectedTactic.includes('DOOSRA') || selectedTactic.includes('GOOGLY');
    const startZ = isSpinner ? -15.0 : -21.0;
    if (bowlerCharRef.current) {
      bowlerCharRef.current.group.position.set(-0.5, 0.04, startZ);
      bowlerCharRef.current.group.rotation.y = 0; // Look towards batter (+Z)
      bowlerCharRef.current.updateAnimation('BOWLING_READY', 0);
    }

    // Striker at batting crease
    if (strikerCharRef.current) {
      strikerCharRef.current.group.position.set(0, 0.04, 9.4);
      strikerCharRef.current.group.rotation.y = Math.PI; // Face down the pitch (-Z)
      strikerCharRef.current.updateAnimation('BATTING_READY', 0);
    }

    // Non-striker at bowling crease
    if (nonStrikerCharRef.current) {
      nonStrikerCharRef.current.group.position.set(1.4, 0.04, -9.4);
      nonStrikerCharRef.current.group.rotation.y = 0;
      nonStrikerCharRef.current.updateAnimation('IDLE', 0);
    }

    // Wicketkeeper crouched behind stumps
    if (keeperCharRef.current) {
      keeperCharRef.current.group.position.set(0, 0.04, 14.2);
      keeperCharRef.current.group.rotation.y = Math.PI; // Face pitch
      keeperCharRef.current.updateAnimation('KEEPER_CROUCH', 0);
    }

    // All 9 tactical fielders in stable FIELD_READY
    fieldersListRef.current.forEach((f) => {
      f.char.group.position.set(f.basePos.x, f.basePos.y, f.basePos.z);
      f.char.group.lookAt(0, 0.04, 9.5); // All watch striker
      f.char.updateAnimation('FIELD_READY', 0);
    });

    // Ball in bowler's hand
    if (ballMeshRef.current && bowlerCharRef.current) {
      const handPos = bowlerCharRef.current.getHandWorldPosition();
      ballMeshRef.current.position.copy(handPos);
    }
    if (ballShadowRef.current && ballMeshRef.current) {
      ballShadowRef.current.position.set(ballMeshRef.current.position.x, 0.025, ballMeshRef.current.position.z);
    }

    // Reset Stumps & Bails
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
  }, [selectedTactic]);

  /**
   * 1. Initialize High-Performance Three.js 3D Cricket World
   */
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

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

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // ── Lighting & Stadium Atmosphere ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1a331a, 0.45);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(25, 45, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
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
    const fieldGeo = new THREE.CylinderGeometry(fieldRadius, fieldRadius, 0.2, 64);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x194d19 });
    const field = new THREE.Mesh(fieldGeo, grassMat);
    field.position.y = -0.1;
    field.receiveShadow = true;
    scene.add(field);

    // Mower Stripe Pattern rings
    for (let r = 8; r < fieldRadius; r += 7) {
      const ringGeo = new THREE.RingGeometry(r, r + 3.5, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x1d581d, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      scene.add(ring);
    }

    // 30-Yard Circle Line
    const circleGeo = new THREE.RingGeometry(18.5, 18.7, 64);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.35, transparent: true, side: THREE.DoubleSide });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.01;
    scene.add(circle);

    // Boundary Rope & LED Cushion Ring
    const ropeGeo = new THREE.TorusGeometry(fieldRadius - 0.5, 0.18, 12, 64);
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
      // Popping crease
      const pLine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.01, 0.08), creaseMat);
      pLine.position.set(0, 0.045, zPos > 0 ? zPos - 0.6 : zPos + 0.6);
      scene.add(pLine);

      // Bowling crease
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

    // ── 1. Striker (Batsman in white kit with batting pads, helmet, and bat) ──
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

    // ── 2. Non-Striker (At non-striker bowling crease) ──
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

    // ── 3. Bowler (Aligned along pitch axis at bowling mark) ──
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

    // ── 4. Wicketkeeper (Crouched behind striker's stumps) ──
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

    // ── 5. 9 Tactical Fielders (All placed in stationary FIELD_READY) ──
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

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Continuous 60 FPS Render Loop
    let animId: number;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      renderer.render(scene, camera);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      scene.clear();
    };
  }, [format, ballColorHex, battingAccentHex, bowlingAccentHex, isTest, battingTeamName, bowlingTeamName, striker?.name, nonStriker?.name, bowler?.name]);

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

    // Find closest fielder to the target shot position
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

    // ── Phase 1: Bowler Run-Up (0.00 - 0.18) [~0.35s]
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

    // ── Phase 2: Delivery Stride & Windmill to Bounce (0.18 - 0.38) [~0.45s]
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

    // ── Phase 3: Bounce to Bat Contact (0.38 - 0.48) [~0.20s]
    else if (p < phases.contactEnd) {
      setCurrentActionState('BOUNCE');
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

    // ── Phase 4: Bat Strike, Ball Flight, Running, & Fielding (0.48 - 0.80) [~0.75s]
    else if (p < phases.fieldingEnd) {
      setCurrentActionState('SHOT_TRAVEL');
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

      // Accelerated running between wickets (1 run: 0.5s, 2 runs: 0.8s, 3 runs: 1.1s)
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

      // Target Fielder moves; other 8 fielders stay stationary
      if (targetFielderItem) {
        const tf = targetFielderItem as FielderItem;
        const targetX = tf.basePos.x + (ballTrajectory.targetPos.x - tf.basePos.x) * (pShot * 0.6);
        const targetZ = tf.basePos.z + (ballTrajectory.targetPos.z - tf.basePos.z) * (pShot * 0.6);
        tf.char.group.position.set(targetX, tf.basePos.y, targetZ);
        tf.char.group.lookAt(ballTrajectory.targetPos.x, 0.04, ballTrajectory.targetPos.z);

        if (seq.isCatch) {
          if (pShot < 0.65) tf.char.updateAnimation('RUN_TO_BALL', pShot);
          else tf.char.updateAnimation('HIGH_CATCH', (pShot - 0.65) / 0.35);
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

      setPlayerDebugStates({
        bowlerState: seq.isBowled ? 'BOWLER_CELEBRATION' : 'IDLE',
        strikerState: seq.runs > 0 ? 'RUN_BETWEEN_WICKETS' : seq.batterAnim,
        keeperState: seq.isWicket ? 'KEEPER_CATCH' : 'KEEPER_COLLECT',
        targetFielder: targetFielderItem ? { name: (targetFielderItem as FielderItem).name, state: seq.isCatch ? 'HIGH_CATCH' : 'GROUND_FIELD' } : null,
      });
    }

    // ── Phase 5: Final Result & Banner Trigger (0.80 - 1.00) [~0.30s]
    else {
      setCurrentActionState('RESULT');
      setResultBanner(seq.resultLabel);
    }

    // ── Fast Snappy Camera Lerp (0.12 lerp speed) ──
    if (camera && ballMesh && !isUserOrbitingRef.current) {
      if (cameraMode === 'CAMERA_WIDE') {
        camera.position.lerp(new THREE.Vector3(0, 32, 42), 0.12);
        camera.lookAt(0, 0, 0);
      } else if (cameraMode === 'BROADCAST') {
        camera.position.lerp(new THREE.Vector3(0, 14, 28), 0.12);
        camera.lookAt(0, 1, 0);
      } else if (cameraMode === 'BALL_FOLLOW') {
        const desiredCamPos = new THREE.Vector3(ballMesh.position.x * 0.6, 7 + ballMesh.position.y * 0.4, ballMesh.position.z + 12);
        camera.position.lerp(desiredCamPos, 0.14);
        camera.lookAt(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);
      } else if (cameraMode === 'BATTER_FOCUS') {
        camera.position.lerp(new THREE.Vector3(-2.5, 3.0, 4.0), 0.12);
        camera.lookAt(0, 1.2, 9.4);
      } else if (cameraMode === 'BOWLER_FOCUS') {
        camera.position.lerp(new THREE.Vector3(2.5, 3.0, -18.0), 0.12);
        camera.lookAt(0, 1.2, -10.0);
      } else if (cameraMode === 'WICKET_FOCUS') {
        camera.position.lerp(new THREE.Vector3(0, 2.0, 13.5), 0.12);
        camera.lookAt(0, 0.7, 10.1);
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

    const seq: Action3DSequence = adaptDeliveryTo3DSequence(lastBall, selectedTactic);
    currentSeqRef.current = seq;

    isSimulatingRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    setResultBanner(null);

    resetAllPlayersToReady();

    // Speed Multipliers: 1x (Normal ~2.5-3.0s), 1.5x (Fast ~2.0-2.5s, Default), 2x (Very Fast ~1.3-1.8s)
    const speedMultiplier = speed === 1 ? 1.0 : speed === 1.5 ? 0.68 : 0.45;
    const baseDuration = (seq.isSix ? 2800 : seq.isFour ? 2600 : seq.runs > 0 ? 2700 : seq.isCaught ? 3000 : 2200) * speedMultiplier;

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
        // Immediate event-driven completion — ready for next delivery without delay!
        onAnimationComplete?.();
      }
    };

    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    animFrameIdRef.current = requestAnimationFrame(step3D);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [lastBall, speed, selectedTactic, resetAllPlayersToReady, executeDeliveryFrame, onAnimationComplete]);

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

          {/* Fast Match Speed Controls: 1x, 1.5x (Default Fast), 2x (Very Fast) */}
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
      <div className="relative w-full aspect-[4/3] max-w-[620px] overflow-hidden flex items-center justify-center">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* ── On-Screen Interactive Controls ── */}
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/10">
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

        {/* ── Action Result Banner (Appears only after action completes) ── */}
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

        {/* ── Debug Overlay & Inspection Panel ── */}
        {debugMode && (
          <div className="absolute top-3 left-3 bg-black/95 border border-white/15 rounded-xl p-3 text-[9px] font-mono text-cyan-300 space-y-1.5 z-40 shadow-2xl max-w-[280px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="text-emerald-400 font-bold uppercase">🛠️ 3D MATCH DEBUG</span>
              <span className="text-white/60">{stateProgress}%</span>
            </div>

            <div className="space-y-0.5">
              <div>STATE: <span className="text-white font-bold">{currentActionState}</span></div>
              <div>SPEED: <span className="text-amber-300 font-bold">{speed}x ({speed === 1.5 ? 'FAST' : speed === 2 ? 'VERY_FAST' : 'NORMAL'})</span></div>
              <div>BOWLER: <span className="text-amber-300 font-bold">{playerDebugStates.bowlerState}</span></div>
              <div>BATTER: <span className="text-emerald-300 font-bold">{playerDebugStates.strikerState}</span></div>
              <div>KEEPER: <span className="text-cyan-300 font-bold">{playerDebugStates.keeperState}</span></div>
              {playerDebugStates.targetFielder && (
                <div>TARGET FIELDER: <span className="text-purple-300 font-bold">{playerDebugStates.targetFielder.name} ({playerDebugStates.targetFielder.state})</span></div>
              )}
              <div>CAMERA: <span className="text-cyan-300 font-bold">{cameraMode}</span></div>
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

      {/* ── Broadcast Footer ── */}
      <div className="w-full px-4 py-2 bg-black/80 backdrop-blur-md border-t border-white/5 flex items-center justify-between text-xs text-white/80 z-30 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{striker?.name || 'Striker'}</span>
          <span className="text-white/40 text-[10px]">facing</span>
          <span className="font-bold text-cyan-400">{bowler?.name || 'Bowler'}</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase">
          <span>Camera: <strong className="text-cyan-300">{cameraMode}</strong></span>
          <span>•</span>
          <span>Speed: <strong className="text-amber-300">{speed}x</strong></span>
        </div>
      </div>
    </div>
  );
}
