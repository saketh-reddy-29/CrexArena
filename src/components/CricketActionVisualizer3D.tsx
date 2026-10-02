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
  Move
} from 'lucide-react';
import { BallOutcome } from '../types/match';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { cn } from '../lib/utils';
import { BOWLING_TACTICS_CONFIG, BowlingTactic, FieldPreset } from './CricketActionVisualizer';

export type CameraMode = 'BROADCAST' | 'BALL_FOLLOW' | 'BATTER_FOCUS' | 'FIELDER_FOCUS' | 'WICKET_FOCUS';
export type AnimationSpeed = 1 | 2 | 4 | 0;

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

// Tactical Field presets in 3D Ground Coordinates (meters from ground center)
// Ground center is (0, 0, 0). Pitch is along Z-axis from z = -10 (bowler) to z = +10 (batter)
const FIELD_PRESETS_3D: Record<Exclude<FieldPreset, 'CUSTOM'>, { name: string; icon: string; positions: { name: string; x: number; z: number }[] }> = {
  BALANCED: {
    name: 'Balanced (4-5 Split)',
    icon: '🛡️',
    positions: [
      { name: 'Wicketkeeper', x: 0, z: 14.5 },
      { name: 'Slip', x: -3.8, z: 15.2 },
      { name: 'Gully', x: -8.5, z: 12.5 },
      { name: 'Point', x: -14.2, z: 9.5 },
      { name: 'Cover', x: -13.5, z: -1.5 },
      { name: 'Mid Off', x: -5.5, z: -11.0 },
      { name: 'Mid On', x: 5.5, z: -11.0 },
      { name: 'Mid Wicket', x: 13.0, z: -1.5 },
      { name: 'Square Leg', x: 14.5, z: 9.5 },
      { name: 'Deep Fine Leg', x: 12.0, z: 24.5 },
      { name: 'Deep Cover', x: -25.0, z: -8.0 },
    ],
  },
  POWERPLAY: {
    name: 'Powerplay (Ring Field)',
    icon: '⚡',
    positions: [
      { name: 'Wicketkeeper', x: 0, z: 14.5 },
      { name: 'First Slip', x: -3.5, z: 15.0 },
      { name: 'Backward Point', x: -12.5, z: 12.0 },
      { name: 'Cover Point', x: -14.0, z: 6.5 },
      { name: 'Extra Cover', x: -11.5, z: -3.0 },
      { name: 'Mid Off', x: -5.0, z: -9.5 },
      { name: 'Mid On', x: 5.0, z: -9.5 },
      { name: 'Mid Wicket', x: 12.0, z: -1.0 },
      { name: 'Square Leg', x: 13.5, z: 10.0 },
      { name: 'Deep Mid-Wicket', x: 25.0, z: -9.0 },
      { name: 'Deep Third Man', x: -18.0, z: 24.0 },
    ],
  },
  ATTACKING_TEST: {
    name: 'Slip Cordon (Test / Attack)',
    icon: '⚔️',
    positions: [
      { name: 'Wicketkeeper', x: 0, z: 14.5 },
      { name: '1st Slip', x: -2.5, z: 15.5 },
      { name: '2nd Slip', x: -4.5, z: 16.5 },
      { name: '3rd Slip', x: -6.5, z: 17.5 },
      { name: 'Gully', x: -9.0, z: 13.5 },
      { name: 'Silly Point', x: -4.5, z: 7.5 },
      { name: 'Short Leg', x: 4.5, z: 7.5 },
      { name: 'Cover', x: -12.5, z: 1.0 },
      { name: 'Mid Off', x: -5.5, z: -10.5 },
      { name: 'Mid On', x: 5.5, z: -10.5 },
      { name: 'Fine Leg', x: 14.0, z: 22.0 },
    ],
  },
  DEATH_OVERS: {
    name: 'Death Overs (5 Deep Protect)',
    icon: '🔒',
    positions: [
      { name: 'Wicketkeeper', x: 0, z: 14.5 },
      { name: 'Short Third Man', x: -6.5, z: 13.5 },
      { name: 'Point', x: -12.5, z: 8.5 },
      { name: 'Extra Cover', x: -11.0, z: -1.5 },
      { name: 'Mid Wicket', x: 11.5, z: 1.0 },
      { name: 'Deep Point', x: -28.0, z: 9.5 },
      { name: 'Long Off', x: -12.0, z: -27.0 },
      { name: 'Long On', x: 12.0, z: -27.0 },
      { name: 'Deep Mid-Wicket', x: 26.0, z: -9.5 },
      { name: 'Deep Square Leg', x: 27.0, z: 11.0 },
      { name: 'Deep Fine Leg', x: 16.0, z: 25.0 },
    ],
  },
  SPIN_TRAP: {
    name: 'Spin Web Trap',
    icon: '🕸️',
    positions: [
      { name: 'Wicketkeeper', x: 0, z: 13.5 },
      { name: 'Slip', x: -3.5, z: 14.5 },
      { name: 'Backward Point', x: -11.0, z: 11.5 },
      { name: 'Cover', x: -11.5, z: 0.0 },
      { name: 'Forward Short Leg', x: 4.0, z: 7.0 },
      { name: 'Catching Mid-Wicket', x: 9.5, z: 3.0 },
      { name: 'Mid Off', x: -5.0, z: -10.0 },
      { name: 'Mid On', x: 5.0, z: -10.0 },
      { name: 'Deep Sweeper Cover', x: -27.0, z: -2.0 },
      { name: 'Deep Mid-Wicket', x: 25.0, z: -7.0 },
      { name: 'Deep Backward Square', x: 24.0, z: 17.0 },
    ],
  },
};

/**
 * Creates a low-poly 3D humanoid cricket player model
 */
function create3DPlayerMesh(jerseyColorHex: number, pantsColorHex: number, isBatter = false): THREE.Group {
  const playerGroup = new THREE.Group();

  // Materials
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xD4A373 });
  const jerseyMat = new THREE.MeshLambertMaterial({ color: jerseyColorHex });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColorHex });
  const helmetMat = new THREE.MeshLambertMaterial({ color: 0x1E293B });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
  const padMat = new THREE.MeshLambertMaterial({ color: 0xF8FAFC });

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(0.55, 0.7, 0.3);
  const torso = new THREE.Mesh(torsoGeo, jerseyMat);
  torso.position.y = 1.25;
  torso.castShadow = true;
  torso.receiveShadow = true;
  playerGroup.add(torso);

  // 2. Head & Helmet
  const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.75;
  head.castShadow = true;
  playerGroup.add(head);

  const helmetGeo = new THREE.SphereGeometry(0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.y = 1.78;
  playerGroup.add(helmet);

  // 3. Legs (Thighs + Shins/Pads)
  const legGeo = new THREE.BoxGeometry(0.2, 0.45, 0.22);
  const leftThigh = new THREE.Mesh(legGeo, isBatter ? padMat : pantsMat);
  leftThigh.position.set(-0.16, 0.68, 0);
  leftThigh.castShadow = true;
  playerGroup.add(leftThigh);

  const rightThigh = new THREE.Mesh(legGeo, isBatter ? padMat : pantsMat);
  rightThigh.position.set(0.16, 0.68, 0);
  rightThigh.castShadow = true;
  playerGroup.add(rightThigh);

  const shinGeo = new THREE.BoxGeometry(0.19, 0.45, 0.22);
  const leftShin = new THREE.Mesh(shinGeo, isBatter ? padMat : pantsMat);
  leftShin.position.set(-0.16, 0.24, 0);
  leftShin.castShadow = true;
  playerGroup.add(leftShin);

  const rightShin = new THREE.Mesh(shinGeo, isBatter ? padMat : pantsMat);
  rightShin.position.set(0.16, 0.24, 0);
  rightShin.castShadow = true;
  playerGroup.add(rightShin);

  // 4. Shoes
  const shoeGeo = new THREE.BoxGeometry(0.2, 0.1, 0.32);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.16, 0.05, 0.05);
  playerGroup.add(leftShoe);

  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.16, 0.05, 0.05);
  playerGroup.add(rightShoe);

  // 5. Arms
  const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.16);
  const leftArm = new THREE.Mesh(armGeo, jerseyMat);
  leftArm.position.set(-0.38, 1.2, 0);
  leftArm.castShadow = true;
  playerGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, jerseyMat);
  rightArm.position.set(0.38, 1.2, 0);
  rightArm.castShadow = true;
  playerGroup.add(rightArm);

  // 6. Cricket Bat (Only for batter)
  if (isBatter) {
    const batBladeGeo = new THREE.BoxGeometry(0.14, 0.85, 0.04);
    const batMat = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
    const batBlade = new THREE.Mesh(batBladeGeo, batMat);
    batBlade.position.set(0.35, 0.55, 0.25);
    batBlade.rotation.x = -0.3;
    batBlade.rotation.z = -0.15;
    batBlade.castShadow = true;
    batBlade.name = 'cricketBat';
    playerGroup.add(batBlade);

    const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x1E293B });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0.35, 1.05, 0.25);
    playerGroup.add(handle);
  }

  return playerGroup;
}

/**
 * Creates 3D Stumps and Bails Model
 */
function create3DStumpsSet(): { group: THREE.Group; bails: THREE.Mesh[] } {
  const setGroup = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0xCD853F });
  const bailMat = new THREE.MeshLambertMaterial({ color: 0xFDE047 });

  // 3 Stumps (height 0.72m, radius 0.02m, spaced 0.11m apart)
  [-0.11, 0, 0.11].forEach((xPos) => {
    const stumpGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.72, 10);
    const stump = new THREE.Mesh(stumpGeo, woodMat);
    stump.position.set(xPos, 0.36, 0);
    stump.castShadow = true;
    stump.receiveShadow = true;
    setGroup.add(stump);
  });

  // 2 Bails on top
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

  return { group: setGroup, bails };
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
  const isSimulatingRef = useRef<boolean>(false);

  // Dynamic 3D Scene Entity References
  const ballMeshRef = useRef<THREE.Mesh | null>(null);
  const ballShadowRef = useRef<THREE.Mesh | null>(null);
  const bowlerMeshRef = useRef<THREE.Group | null>(null);
  const strikerMeshRef = useRef<THREE.Group | null>(null);
  const nonStrikerMeshRef = useRef<THREE.Group | null>(null);
  const keeperMeshRef = useRef<THREE.Group | null>(null);
  const fielders3DRef = useRef<THREE.Group[]>([]);
  const bailsRef = useRef<THREE.Mesh[]>([]);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);

  // Visualizer UI Controls
  const [cameraMode, setCameraMode] = useState<CameraMode>('BROADCAST');
  const [speed, setSpeed] = useState<AnimationSpeed>(1);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [showBowlerTactics, setShowBowlerTactics] = useState<boolean>(false);
  const [showFieldMenu, setShowFieldMenu] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<FieldPreset>('BALANCED');
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const [stateProgress, setStateProgress] = useState<number>(0);
  const [currentActionState, setCurrentActionState] = useState<string>('IDLE');

  const isTest = format === 'Test';
  const ballColorHex = isTest ? 0xDC2626 : 0xFFFFFF;
  const jerseyBattingHex = isTest ? 0xF8FAFC : 0x2563EB;
  const jerseyBowlingHex = isTest ? 0xF8FAFC : 0xDC2626;
  const pantsHex = isTest ? 0xF8FAFC : 0x1E293B;

  const [selectedTactic, setSelectedTactic] = useState<BowlingTactic>(
    activeBowlingTactic || (bowler?.bowlingStyle?.toLowerCase().includes('spin') ? 'OFF_BREAK' : 'OUTSWING')
  );

  const tacticConfig = BOWLING_TACTICS_CONFIG[selectedTactic] || BOWLING_TACTICS_CONFIG.OUTSWING;

  // Sync prop changes
  useEffect(() => {
    if (activeBowlingTactic) setSelectedTactic(activeBowlingTactic);
  }, [activeBowlingTactic]);

  /**
   * 1. Initialize High-Performance Three.js 3D Cricket World
   */
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050c1e);
    scene.fog = new THREE.FogExp2(0x050c1e, 0.008);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 300);
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // WebGL Renderer with High-DPI & Soft Shadow Support
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // ── Lighting ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1a331a, 0.4);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    sunLight.position.set(25, 45, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -35;
    sunLight.shadow.camera.right = 35;
    sunLight.shadow.camera.top = 35;
    sunLight.shadow.camera.bottom = -35;
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
    const circleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.25, transparent: true, side: THREE.DoubleSide });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.01;
    scene.add(circle);

    // Boundary Rope & LED Cushion Ring
    const ropeGeo = new THREE.TorusGeometry(fieldRadius - 0.5, 0.18, 12, 64);
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0x2563EB });
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

    // Crease Lines (Bowling Creases & Popping Creases)
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

    // ── Stumps & Bails at Both Ends ──
    const batterStumps = create3DStumpsSet();
    batterStumps.group.position.set(0, 0.04, 10.1);
    scene.add(batterStumps.group);
    bailsRef.current = batterStumps.bails;

    const bowlerStumps = create3DStumpsSet();
    bowlerStumps.group.position.set(0, 0.04, -10.1);
    scene.add(bowlerStumps.group);

    // ── 3D Cricket Ball & Dynamic Ground Shadow ──
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

    // ── 3D Players ──
    // 1. Striker (Batsman)
    const striker3D = create3DPlayerMesh(jerseyBattingHex, pantsHex, true);
    striker3D.position.set(0, 0.04, 9.4);
    striker3D.rotation.y = Math.PI; // Faces down the pitch
    scene.add(striker3D);
    strikerMeshRef.current = striker3D;

    // 2. Non-Striker
    const nonStriker3D = create3DPlayerMesh(jerseyBattingHex, pantsHex, true);
    nonStriker3D.position.set(1.4, 0.04, -9.4);
    scene.add(nonStriker3D);
    nonStrikerMeshRef.current = nonStriker3D;

    // 3. Bowler
    const bowler3D = create3DPlayerMesh(jerseyBowlingHex, pantsHex, false);
    bowler3D.position.set(-0.8, 0.04, -18);
    scene.add(bowler3D);
    bowlerMeshRef.current = bowler3D;

    // 4. Wicketkeeper
    const keeper3D = create3DPlayerMesh(jerseyBowlingHex, pantsHex, false);
    keeper3D.position.set(0, 0.04, 14.5);
    scene.add(keeper3D);
    keeperMeshRef.current = keeper3D;

    // 5. 9 Fielders based on preset
    const presetPositions = FIELD_PRESETS_3D.BALANCED.positions.slice(2); // exclude keeper & slip (handled)
    const fieldersList: THREE.Group[] = [];
    presetPositions.forEach((pos) => {
      const fielder = create3DPlayerMesh(jerseyBowlingHex, pantsHex, false);
      fielder.position.set(pos.x, 0.04, pos.z);
      // Look toward batter
      fielder.lookAt(0, 0.04, 9.5);
      scene.add(fielder);
      fieldersList.push(fielder);
    });
    fielders3DRef.current = fieldersList;

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

    // Continuous Render Loop
    let animId: number;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      renderer.render(scene, camera);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, [format, ballColorHex, jerseyBattingHex, jerseyBowlingHex, pantsHex]);

  /**
   * 2. Full 3D Physics & Delivery Animation Engine
   */
  const run3DDeliveryAnimation = useCallback(() => {
    if (!lastBall || speed === 0) {
      if (lastBall) {
        setResultBanner(lastBall.isWicket ? 'WICKET!' : lastBall.runs === 6 ? 'SIX!' : lastBall.runs === 4 ? 'FOUR!' : `${lastBall.runs} RUNS`);
      }
      onAnimationComplete?.();
      return;
    }

    const { runs, isWicket, isExtra, extraType, wicketType } = lastBall;
    const currentTactic = lastBall.bowlingTactic || selectedTactic;
    const tacticData = BOWLING_TACTICS_CONFIG[currentTactic] || BOWLING_TACTICS_CONFIG.OUTSWING;

    isSimulatingRef.current = true;
    setResultBanner(null);

    const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 0.5 : 0.25;
    const baseDuration = (runs === 6 ? 3200 : runs === 4 ? 2800 : runs > 0 ? 2400 : 2000) * speedMultiplier;

    let startTime: number | null = null;

    // Reset Entities
    const ballMesh = ballMeshRef.current;
    const ballShadow = ballShadowRef.current;
    const bowlerMesh = bowlerMeshRef.current;
    const strikerMesh = strikerMeshRef.current;
    const nonStrikerMesh = nonStrikerMeshRef.current;
    const camera = cameraRef.current;

    if (bowlerMesh) bowlerMesh.position.set(-0.8, 0.04, -18);
    if (strikerMesh) strikerMesh.position.set(0, 0.04, 9.4);
    if (nonStrikerMesh) nonStrikerMesh.position.set(1.4, 0.04, -9.4);

    // Reset bails
    bailsRef.current.forEach((bail, idx) => {
      bail.position.set(idx === 0 ? -0.055 : 0.055, 0.73, 0);
      bail.rotation.set(0, 0, Math.PI / 2);
    });

    // Determine 3D Shot Target Angle & Direction
    let shotAngleDeg = -45; // Default cover drive
    let isAerial = runs === 6;
    let targetDist = runs === 6 ? 41 : runs === 4 ? 37.5 : runs * 4.5 + 4;

    if (runs === 6) {
      const angles = [-65, -20, 15, 55, 75, 95, -130, 145];
      shotAngleDeg = angles[Math.floor(Math.random() * angles.length)];
    } else if (runs === 4) {
      const angles = [-55, -40, -5, 25, 65, -95, -135, 100, 140];
      shotAngleDeg = angles[Math.floor(Math.random() * angles.length)];
    } else if (runs > 0) {
      const angles = [-75, -25, 20, 55, 90, 130, -125];
      shotAngleDeg = angles[Math.floor(Math.random() * angles.length)];
    }

    const rad = (shotAngleDeg - 90) * (Math.PI / 180);
    const targetX = Math.cos(rad) * targetDist;
    const targetZ = 9.5 + Math.sin(rad) * targetDist;

    // Pitch bounce point
    let bounceZ = currentTactic === 'YORKER' ? 8.8 : currentTactic === 'BOUNCER' ? -2.0 : 4.5;
    let bounceX = currentTactic === 'OUTSWING' ? 0.35 : currentTactic === 'INSWING' ? -0.35 : 0;

    const step3D = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const p = Math.min(1, elapsed / baseDuration);
      setStateProgress(Math.round(p * 100));

      // ── Phase 1: Bowler Run-Up (0.00 - 0.25)
      if (p < 0.25) {
        setCurrentActionState('BOWLER_RUNUP');
        const pRun = p / 0.25;
        const curZ = -18 + pRun * 8.5; // -18 to -9.5
        if (bowlerMesh) {
          bowlerMesh.position.z = curZ;
          bowlerMesh.position.y = 0.04 + Math.abs(Math.sin(pRun * Math.PI * 4)) * 0.15; // running bounce
        }
        if (ballMesh) {
          ballMesh.position.set(bowlerMesh?.position.x || 0, 1.8 + Math.sin(pRun * Math.PI * 4) * 0.1, curZ + 0.3);
        }
        if (ballShadow) {
          ballShadow.position.set(ballMesh?.position.x || 0, 0.025, curZ + 0.3);
          ballShadow.scale.set(1, 1, 1);
        }
      }

      // ── Phase 2: Delivery Release & Flight with Swing Curvature (0.25 - 0.50)
      else if (p < 0.50) {
        setCurrentActionState('BALL_FLIGHT');
        const pFlight = (p - 0.25) / 0.25;
        const startZ = -9.5;
        const endZ = bounceZ;

        // Swing curvature lateral offset
        const swingOffset = tacticData.swingFactor * Math.sin(pFlight * Math.PI) * 0.12;
        const curX = bounceX * pFlight + swingOffset;
        const curZ = startZ + (endZ - startZ) * pFlight;
        const curY = 1.9 * (1 - pFlight) + 0.04 + Math.sin(pFlight * Math.PI) * (0.8 * tacticData.bounceMultiplier);

        if (ballMesh) {
          ballMesh.position.set(curX, curY, curZ);
          ballMesh.rotation.z = (tacticData.seamAngle * Math.PI) / 180;
        }
        if (ballShadow) {
          ballShadow.position.set(curX, 0.025, curZ);
          const shadowScale = 1 - (curY / 4);
          ballShadow.scale.set(shadowScale, shadowScale, 1);
        }
      }

      // ── Phase 3: Bounce to Bat Contact (0.50 - 0.65)
      else if (p < 0.65) {
        setCurrentActionState('BOUNCE');
        const pBounce = (p - 0.50) / 0.15;
        const startZ = bounceZ;
        const endZ = 9.5;

        let deviation = 0;
        if (currentTactic === 'OFF_BREAK' || currentTactic === 'GOOGLY') deviation = pBounce * 0.25;
        else if (currentTactic === 'LEG_BREAK' || currentTactic === 'DOOSRA') deviation = -pBounce * 0.25;

        const curX = bounceX + deviation;
        const curZ = startZ + (endZ - startZ) * pBounce;
        const apexY = currentTactic === 'BOUNCER' ? 1.6 : currentTactic === 'YORKER' ? 0.2 : 0.85;
        const curY = 0.05 + Math.sin(pBounce * Math.PI) * apexY;

        if (ballMesh) ballMesh.position.set(curX, curY, curZ);
        if (ballShadow) {
          ballShadow.position.set(curX, 0.025, curZ);
          ballShadow.scale.set(1 - curY / 3, 1 - curY / 3, 1);
        }

        // Striker backlift anticipation
        if (strikerMesh) {
          const bat = strikerMesh.getObjectByName('cricketBat');
          if (bat) bat.rotation.x = -0.3 - (pBounce * 0.8);
        }
      }

      // ── Phase 4: Bat Strike & Shot Trajectory Travel (0.65 - 0.90)
      else if (p < 0.90) {
        setCurrentActionState('SHOT_TRAVEL');
        const pShot = (p - 0.65) / 0.25;
        const startX = 0;
        const startZ = 9.5;

        const curX = startX + (targetX - startX) * pShot;
        const curZ = startZ + (targetZ - startZ) * pShot;
        let curY = 0.08;

        if (isAerial) {
          // 3D Parabolic Six Arc
          const apexHeight = 11.5;
          curY = 0.08 + Math.sin(pShot * Math.PI) * apexHeight;
        } else {
          // Ground rolling Four / Single
          let bounceSkip = 0;
          if (pShot < 0.35) bounceSkip = Math.sin((pShot / 0.35) * Math.PI) * 0.45;
          else if (pShot < 0.7) bounceSkip = Math.sin(((pShot - 0.35) / 0.35) * Math.PI) * 0.2;
          curY = 0.08 + bounceSkip;
        }

        if (ballMesh) {
          ballMesh.position.set(curX, curY, curZ);
          ballMesh.rotation.x += 0.35;
        }
        if (ballShadow) {
          ballShadow.position.set(curX, 0.025, curZ);
          const shadowScale = Math.max(0.2, 1 - (curY / 14));
          ballShadow.scale.set(shadowScale, shadowScale, 1);
        }

        // Bat follow-through
        if (strikerMesh) {
          const bat = strikerMesh.getObjectByName('cricketBat');
          if (bat) bat.rotation.x = 0.5 * (1 - pShot);
        }

        // Nearest fielder chases the ball
        if (fielders3DRef.current.length > 0) {
          const nearestFielder = fielders3DRef.current[0];
          nearestFielder.position.x += (targetX - nearestFielder.position.x) * (pShot * 0.04);
          nearestFielder.position.z += (targetZ - nearestFielder.position.z) * (pShot * 0.04);
        }

        // Bowled dismissal bails physics
        if (isWicket && wicketType?.toLowerCase().includes('bowled') && pShot > 0.1) {
          bailsRef.current.forEach((bail, i) => {
            bail.position.y += 0.08;
            bail.position.x += i === 0 ? -0.05 : 0.05;
            bail.rotation.z += 0.2;
          });
        }
      }

      // ── Phase 5: Result & Banner Trigger (0.90 - 1.00)
      else {
        setCurrentActionState('RESULT');
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

      // ── Dynamic 3D Camera Modes with Smooth Lerp ──
      if (camera && ballMesh) {
        if (cameraMode === 'BALL_FOLLOW') {
          const desiredCamPos = new THREE.Vector3(ballMesh.position.x * 0.6, 7 + ballMesh.position.y * 0.4, ballMesh.position.z + 12);
          camera.position.lerp(desiredCamPos, 0.06);
          camera.lookAt(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);
        } else if (cameraMode === 'BATTER_FOCUS') {
          camera.position.lerp(new THREE.Vector3(0, 3.2, 0), 0.06);
          camera.lookAt(0, 1.2, 9.5);
        } else if (cameraMode === 'WICKET_FOCUS') {
          camera.position.lerp(new THREE.Vector3(0, 2.0, 13.5), 0.06);
          camera.lookAt(0, 0.7, 10.1);
        } else {
          // BROADCAST Default
          camera.position.lerp(new THREE.Vector3(0, 15, 24), 0.04);
          camera.lookAt(0, 0, 0);
        }
      }

      if (p < 1) {
        animFrameIdRef.current = requestAnimationFrame(step3D);
      } else {
        isSimulatingRef.current = false;
        onAnimationComplete?.();
      }
    };

    animFrameIdRef.current = requestAnimationFrame(step3D);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [lastBall, speed, selectedTactic, cameraMode, onAnimationComplete]);

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
            {format} 3D ARENA BROADCAST
          </span>
          {isFreeHit && (
            <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-black uppercase animate-bounce">
              Free Hit
            </span>
          )}
        </div>

        {/* 3D Camera, Bowler Tactics & Speed Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Camera Switcher */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
            {(['BROADCAST', 'BALL_FOLLOW', 'BATTER_FOCUS'] as CameraMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setCameraMode(mode)}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                  cameraMode === mode ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
                )}
                title={`Switch Camera: ${mode}`}
              >
                {mode === 'BROADCAST' ? '🎥 Broadcast' : mode === 'BALL_FOLLOW' ? '⚽ Follow' : '🏏 Batter'}
              </button>
            ))}
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

      {/* ── 3D Canvas Viewport ── */}
      <div className="relative w-full aspect-[4/3] max-w-[560px] overflow-hidden flex items-center justify-center">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* ── Action Result Banner ── */}
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

        {/* ── Debug Overlay ── */}
        {debugMode && (
          <div className="absolute top-3 left-3 bg-black/90 border border-white/10 rounded-xl p-3 text-[9px] font-mono text-cyan-300 space-y-0.5 z-40 pointer-events-none shadow-xl">
            <div>3D ENGINE: <span className="text-emerald-400 font-bold">THREE.JS v184</span></div>
            <div>STATE: <span className="text-white font-bold">{currentActionState}</span></div>
            <div>PROGRESS: <span className="text-white font-bold">{stateProgress}%</span></div>
            <div>CAMERA: <span className="text-cyan-300 font-bold">{cameraMode}</span></div>
            <div>TACTIC: <span className="text-amber-300 font-bold">{tacticConfig.name}</span></div>
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
          <span>Tactic: <strong className="text-amber-300">{tacticConfig.name}</strong></span>
        </div>
      </div>
    </div>
  );
}
