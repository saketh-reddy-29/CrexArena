import * as THREE from 'three';
import { Player } from '../types/common';

export type PlayerRole3D = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKETKEEPER' | 'FIELDER';

export type PlayerAnimState = 
  | 'IDLE'
  | 'BATTING_READY'
  | 'BACKLIFT'
  | 'COVER_DRIVE'
  | 'STRAIGHT_DRIVE'
  | 'ON_DRIVE'
  | 'SQUARE_CUT'
  | 'CUT'
  | 'PULL_SHOT'
  | 'HOOK_SHOT'
  | 'PULL'
  | 'HOOK'
  | 'FLICK'
  | 'GLANCE'
  | 'SWEEP'
  | 'FORWARD_DEFENCE'
  | 'BACKFOOT_DEFENCE'
  | 'DEFEND'
  | 'LEAVE'
  | 'EDGE'
  | 'MISS'
  | 'LOFTED_SIX'
  | 'LOFT'
  | 'ATTACK'
  | 'BOWLING_READY'
  | 'BOWLER_RUNUP'
  | 'RUN_UP'
  | 'BOWLER_GATHER'
  | 'GATHER'
  | 'DELIVERY_STRIDE'
  | 'ARM_ROTATION'
  | 'RELEASE'
  | 'BALL_RELEASE'
  | 'FOLLOW_THROUGH'
  | 'FIELD_READY'
  | 'RUN_TO_BALL'
  | 'GROUND_FIELD'
  | 'GROUND_PICKUP'
  | 'DIVING_CATCH'
  | 'HIGH_CATCH'
  | 'LOW_CATCH'
  | 'DROP'
  | 'THROW'
  | 'KEEPER_READY'
  | 'KEEPER_CROUCH'
  | 'KEEPER_SHIFT_LEFT'
  | 'KEEPER_SHIFT_RIGHT'
  | 'KEEPER_COLLECT'
  | 'KEEPER_CATCH'
  | 'KEEPER_DIVE'
  | 'KEEPER_STUMPING'
  | 'KEEPER_THROW'
  | 'RUN_BETWEEN_WICKETS'
  | 'TURN_AT_CREASE'
  | 'SLIDE_BAT'
  | 'CELEBRATION'
  | 'BOWLER_CELEBRATION'
  | 'BATTER_DISMISSED'
  | 'BOWLED_REACTION'
  | 'BAT_RAISE'
  | 'HELMET_RAISE'
  | 'FIST_PUMP'
  | 'CONFIDENT_WALK'
  | 'BOWLER_APPEAL'
  | 'FIELDER_APPEAL'
  | 'HANDS_ON_HEAD'
  | 'BATTER_WALK_OFF'
  | 'HEAD_SHAKE'
  | 'TEAM_HUG'
  | 'HIGH_FIVE'
  | 'CAPTAIN_CELEBRATION'
  | 'MATCH_WIN_CELEBRATION'
  | 'BAT_TAP';

export interface Player3DConfig {
  id: string;
  name: string;
  role: PlayerRole3D;
  teamName?: string;
  teamAccentColorHex?: number;
  jerseyNumber?: number;
  isTestFormat?: boolean;
  hasBat?: boolean;
  hasPads?: boolean;
  hasHelmet?: boolean;
  isWicketkeeper?: boolean;
  isLeftHanded?: boolean;
}

export interface PlayerRigJoints {
  root: THREE.Group;
  pelvis: THREE.Mesh;
  spine: THREE.Group;
  torso: THREE.Mesh;
  neck: THREE.Mesh;
  head: THREE.Group;
  helmet?: THREE.Group;
  cap?: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftUpperArm: THREE.Mesh;
  rightUpperArm: THREE.Mesh;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHand: THREE.Mesh;
  rightHand: THREE.Mesh;
  bat?: THREE.Group;
  ballSocket: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftThigh: THREE.Mesh;
  rightThigh: THREE.Mesh;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftShin: THREE.Mesh;
  rightShin: THREE.Mesh;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
}

export interface CricketPlayer3DInstance {
  group: THREE.Group;
  joints: PlayerRigJoints;
  config: Player3DConfig;
  updateAnimation: (state: PlayerAnimState, progress: number, subProgress?: number) => void;
  getHandWorldPosition: () => THREE.Vector3;
  getBatContactWorldPosition: () => THREE.Vector3;
  setAccentColor: (hex: number) => void;
}

/**
 * Creates the realistic 3D Cricket Player Character Model
 * White uniform with team accents, athletic proportions, batting pads, gloves, shoes, helmet/cap, and wood bat.
 */
export function createCricketCharacter(config: Player3DConfig): CricketPlayer3DInstance {
  const root = new THREE.Group();
  root.name = `player-${config.id}`;

  const isTest = Boolean(config.isTestFormat);
  const teamAccentHex = config.teamAccentColorHex ?? (isTest ? 0x991B1B : 0x2563EB);

  // Common Shared Materials
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xD7A17C });
  const whiteKitMat = new THREE.MeshLambertMaterial({ color: 0xF3F4F6 }); // Crisp cricket white
  const teamAccentMat = new THREE.MeshLambertMaterial({ color: teamAccentHex });
  const padWhiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
  const padStrapMat = new THREE.MeshLambertMaterial({ color: 0xCBD5E1 });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0xFAFAFA });
  const shoeSpikesMat = new THREE.MeshLambertMaterial({ color: 0x1E293B });
  const gloveMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
  const helmetMat = new THREE.MeshLambertMaterial({ color: teamAccentHex });
  const grilleMat = new THREE.MeshLambertMaterial({ color: 0x94A3B8 });
  const woodBatMat = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
  const batGripMat = new THREE.MeshLambertMaterial({ color: teamAccentHex });

  // ── 1. Pelvis / Hips (Root of skeleton) ──
  const pelvisGeo = new THREE.BoxGeometry(0.44, 0.22, 0.28);
  const pelvis = new THREE.Mesh(pelvisGeo, whiteKitMat);
  pelvis.position.y = 0.95;
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  root.add(pelvis);

  // ── 2. Spine & Torso (Jerseys with team accent stripes & collar) ──
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, 0.11, 0);
  pelvis.add(spineGroup);

  const torsoGeo = new THREE.BoxGeometry(0.52, 0.58, 0.3);
  const torso = new THREE.Mesh(torsoGeo, whiteKitMat);
  torso.position.y = 0.29;
  torso.castShadow = true;
  torso.receiveShadow = true;
  spineGroup.add(torso);

  // Jersey Accent Stripe on ribs
  const stripeGeo = new THREE.BoxGeometry(0.04, 0.56, 0.31);
  const leftStripe = new THREE.Mesh(stripeGeo, teamAccentMat);
  leftStripe.position.set(-0.25, 0.29, 0);
  spineGroup.add(leftStripe);

  const rightStripe = new THREE.Mesh(stripeGeo, teamAccentMat);
  rightStripe.position.set(0.25, 0.29, 0);
  spineGroup.add(rightStripe);

  // Collar
  const collarGeo = new THREE.BoxGeometry(0.26, 0.08, 0.22);
  const collar = new THREE.Mesh(collarGeo, teamAccentMat);
  collar.position.set(0, 0.60, 0);
  spineGroup.add(collar);

  // ── 3. Neck & Head ──
  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.12, 10);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.set(0, 0.64, 0);
  neck.castShadow = true;
  spineGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.76, 0);
  spineGroup.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.16, 14, 14);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Helmet / Cap
  let helmetGroup: THREE.Group | undefined;
  let capGroup: THREE.Group | undefined;

  if (config.hasHelmet || config.role === 'BATTER' || config.role === 'WICKETKEEPER') {
    helmetGroup = new THREE.Group();
    // Helmet dome
    const domeGeo = new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const dome = new THREE.Mesh(domeGeo, helmetMat);
    dome.position.y = 0.02;
    dome.castShadow = true;
    helmetGroup.add(dome);

    // Peak
    const peakGeo = new THREE.BoxGeometry(0.18, 0.02, 0.12);
    const peak = new THREE.Mesh(peakGeo, helmetMat);
    peak.position.set(0, 0.05, 0.16);
    peak.rotation.x = -0.15;
    helmetGroup.add(peak);

    // Metallic Grille / Visor
    const grilleGeo = new THREE.TorusGeometry(0.14, 0.012, 8, 16, Math.PI);
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0, -0.04, 0.08);
    grille.rotation.x = Math.PI / 2;
    helmetGroup.add(grille);

    headGroup.add(helmetGroup);
  } else {
    // Cricket Cap
    capGroup = new THREE.Group();
    const capDomeGeo = new THREE.SphereGeometry(0.175, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const capDome = new THREE.Mesh(capDomeGeo, teamAccentMat);
    capDome.position.y = 0.04;
    capGroup.add(capDome);

    const capPeakGeo = new THREE.BoxGeometry(0.16, 0.018, 0.14);
    const capPeak = new THREE.Mesh(capPeakGeo, teamAccentMat);
    capPeak.position.set(0, 0.03, 0.16);
    capPeak.rotation.x = -0.1;
    capGroup.add(capPeak);

    headGroup.add(capGroup);
  }

  // ── 4. Left Arm Hierarchy (Shoulder -> UpperArm -> Forearm -> Hand) ──
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.34, 0.52, 0);
  spineGroup.add(leftShoulder);

  const upperArmGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.32, 10);
  const leftUpperArm = new THREE.Mesh(upperArmGeo, whiteKitMat);
  leftUpperArm.position.set(0, -0.16, 0);
  leftUpperArm.castShadow = true;
  leftShoulder.add(leftUpperArm);

  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.32, 0);
  leftShoulder.add(leftForearm);

  const forearmGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.30, 10);
  const leftForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
  leftForearmMesh.position.set(0, -0.15, 0);
  leftForearmMesh.castShadow = true;
  leftForearm.add(leftForearmMesh);

  const handGeo = new THREE.BoxGeometry(0.11, 0.12, 0.1);
  const leftHand = new THREE.Mesh(handGeo, (config.hasBat || config.isWicketkeeper) ? gloveMat : skinMat);
  leftHand.position.set(0, -0.34, 0);
  leftHand.castShadow = true;
  leftForearm.add(leftHand);

  // ── 5. Right Arm Hierarchy (Shoulder -> UpperArm -> Forearm -> Hand -> Bat/Ball Socket) ──
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.34, 0.52, 0);
  spineGroup.add(rightShoulder);

  const rightUpperArm = new THREE.Mesh(upperArmGeo, whiteKitMat);
  rightUpperArm.position.set(0, -0.16, 0);
  rightUpperArm.castShadow = true;
  rightShoulder.add(rightUpperArm);

  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.32, 0);
  rightShoulder.add(rightForearm);

  const rightForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
  rightForearmMesh.position.set(0, -0.15, 0);
  rightForearmMesh.castShadow = true;
  rightForearm.add(rightForearmMesh);

  const rightHand = new THREE.Mesh(handGeo, (config.hasBat || config.isWicketkeeper) ? gloveMat : skinMat);
  rightHand.position.set(0, -0.34, 0);
  rightHand.castShadow = true;
  rightForearm.add(rightHand);

  // Ball Socket (Right hand release point)
  const ballSocket = new THREE.Group();
  ballSocket.position.set(0, -0.06, 0.05);
  rightHand.add(ballSocket);

  // ── 6. 3D Cricket Bat (Attached to Hand Bone Socket) ──
  let batGroup: THREE.Group | undefined;
  if (config.hasBat || config.role === 'BATTER' || config.role === 'ALL_ROUNDER') {
    batGroup = new THREE.Group();
    batGroup.name = 'cricketBat';
    batGroup.position.set(0, -0.05, 0.08);
    batGroup.rotation.set(-Math.PI / 4, 0, 0);

    // Cane Handle
    const handleGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.32, 8);
    const handle = new THREE.Mesh(handleGeo, batGripMat);
    handle.position.set(0, 0.12, 0);
    handle.castShadow = true;
    batGroup.add(handle);

    // Willow Blade
    const bladeGeo = new THREE.BoxGeometry(0.12, 0.72, 0.045);
    const blade = new THREE.Mesh(bladeGeo, woodBatMat);
    blade.position.set(0, -0.34, 0);
    blade.castShadow = true;
    blade.receiveShadow = true;
    batGroup.add(blade);

    // Sponsor sticker on front
    const stickerGeo = new THREE.PlaneGeometry(0.09, 0.22);
    const stickerMat = new THREE.MeshBasicMaterial({ color: teamAccentHex, side: THREE.DoubleSide });
    const sticker = new THREE.Mesh(stickerGeo, stickerMat);
    sticker.position.set(0, -0.18, 0.024);
    batGroup.add(sticker);

    rightHand.add(batGroup);
  }

  // ── 7. Left Leg Hierarchy (Hip -> Thigh -> Knee -> Shin/Pads -> Foot) ──
  const leftHip = new THREE.Group();
  leftHip.position.set(-0.16, -0.1, 0);
  pelvis.add(leftHip);

  const thighGeo = new THREE.CylinderGeometry(0.095, 0.085, 0.42, 10);
  const leftThigh = new THREE.Mesh(thighGeo, whiteKitMat);
  leftThigh.position.set(0, -0.21, 0);
  leftThigh.castShadow = true;
  leftHip.add(leftThigh);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.42, 0);
  leftHip.add(leftKnee);

  const shinGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.44, 10);
  const leftShin = new THREE.Mesh(shinGeo, whiteKitMat);
  leftShin.position.set(0, -0.22, 0);
  leftShin.castShadow = true;
  leftKnee.add(leftShin);

  // Batting Pad on Left Shin
  if (config.hasPads || config.role === 'BATTER' || config.role === 'WICKETKEEPER') {
    const padGeo = new THREE.BoxGeometry(0.18, 0.52, 0.12);
    const leftPad = new THREE.Mesh(padGeo, padWhiteMat);
    leftPad.position.set(0, -0.20, 0.06);
    leftPad.castShadow = true;
    leftKnee.add(leftPad);

    // Knee roll horizontal bar
    const rollGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8);
    const kneeRoll = new THREE.Mesh(rollGeo, padStrapMat);
    kneeRoll.rotation.z = Math.PI / 2;
    kneeRoll.position.set(0, 0.02, 0.08);
    leftKnee.add(kneeRoll);
  }

  const footGeo = new THREE.BoxGeometry(0.14, 0.09, 0.28);
  const leftFoot = new THREE.Mesh(footGeo, shoeMat);
  leftFoot.position.set(0, -0.46, 0.06);
  leftFoot.castShadow = true;
  leftKnee.add(leftFoot);

  // ── 8. Right Leg Hierarchy (Hip -> Thigh -> Knee -> Shin/Pads -> Foot) ──
  const rightHip = new THREE.Group();
  rightHip.position.set(0.16, -0.1, 0);
  pelvis.add(rightHip);

  const rightThigh = new THREE.Mesh(thighGeo, whiteKitMat);
  rightThigh.position.set(0, -0.21, 0);
  rightThigh.castShadow = true;
  rightHip.add(rightThigh);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.42, 0);
  rightHip.add(rightKnee);

  const rightShin = new THREE.Mesh(shinGeo, whiteKitMat);
  rightShin.position.set(0, -0.22, 0);
  rightShin.castShadow = true;
  rightKnee.add(rightShin);

  // Batting Pad on Right Shin
  if (config.hasPads || config.role === 'BATTER' || config.role === 'WICKETKEEPER') {
    const padGeo = new THREE.BoxGeometry(0.18, 0.52, 0.12);
    const rightPad = new THREE.Mesh(padGeo, padWhiteMat);
    rightPad.position.set(0, -0.20, 0.06);
    rightPad.castShadow = true;
    rightKnee.add(rightPad);

    const rollGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8);
    const kneeRoll = new THREE.Mesh(rollGeo, padStrapMat);
    kneeRoll.rotation.z = Math.PI / 2;
    kneeRoll.position.set(0, 0.02, 0.08);
    rightKnee.add(kneeRoll);
  }

  const rightFoot = new THREE.Mesh(footGeo, shoeMat);
  rightFoot.position.set(0, -0.46, 0.06);
  rightFoot.castShadow = true;
  rightKnee.add(rightFoot);

  const joints: PlayerRigJoints = {
    root,
    pelvis,
    spine: spineGroup,
    torso,
    neck,
    head: headGroup,
    helmet: helmetGroup,
    cap: capGroup,
    leftShoulder,
    rightShoulder,
    leftUpperArm,
    rightUpperArm,
    leftForearm,
    rightForearm,
    leftHand,
    rightHand,
    bat: batGroup,
    ballSocket,
    leftHip,
    rightHip,
    leftThigh,
    rightThigh,
    leftKnee,
    rightKnee,
    leftShin,
    rightShin,
    leftFoot,
    rightFoot,
  };

  let currentAnimState: PlayerAnimState = 'IDLE';

  /**
   * Complete Skeletal Animation Controller
   * Applies smooth joint rotations based on high-level cricket animation states.
   */
  const updateAnimation = (state: PlayerAnimState, progress: number, subProgress = 0) => {
    currentAnimState = state;
    // Reset defaults
    pelvis.rotation.set(0, 0, 0);
    spineGroup.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftShoulder.rotation.set(0, 0, 0);
    rightShoulder.rotation.set(0, 0, 0);
    leftForearm.rotation.set(0, 0, 0);
    rightForearm.rotation.set(0, 0, 0);
    leftHip.rotation.set(0, 0, 0);
    rightHip.rotation.set(0, 0, 0);
    leftKnee.rotation.set(0, 0, 0);
    rightKnee.rotation.set(0, 0, 0);
    pelvis.position.y = 0.95;

    if (joints.bat) joints.bat.rotation.set(-Math.PI / 4, 0, 0);

    // ── 1. IDLE / NON-STRIKER WAITING ──
    if (state === 'IDLE') {
      spineGroup.rotation.set(0.08, 0, 0);
      rightShoulder.rotation.set(0.3, 0.1, 0);
      leftShoulder.rotation.set(0.3, -0.1, 0);
      if (joints.bat) joints.bat.rotation.set(-0.3, 0, 0);
    }

    // ── 2. BATTING STATES ──
    else if (state === 'BATTING_READY') {
      // Crouch stance, side-on to bowler
      spineGroup.rotation.set(0.15, -0.4, 0);
      headGroup.rotation.set(-0.1, 0.4, 0); // Head looks down the pitch
      pelvis.position.y = 0.90;

      // Bent knees in athletic stance
      leftHip.rotation.set(-0.25, 0, 0.1);
      leftKnee.rotation.set(0.35, 0, 0);
      rightHip.rotation.set(-0.25, 0, -0.1);
      rightKnee.rotation.set(0.35, 0, 0);

      // Two hands holding bat near waist
      rightShoulder.rotation.set(0.4, 0.2, -0.2);
      rightForearm.rotation.set(0.6, 0, 0);
      leftShoulder.rotation.set(0.3, -0.2, 0.2);
      leftForearm.rotation.set(0.7, 0, 0);

      if (joints.bat) {
        // Tapping bat on turf
        const tap = Math.sin(progress * Math.PI * 6) * 0.12;
        joints.bat.rotation.set(-0.6 + tap, 0, 0.2);
      }
    }

    else if (state === 'BACKLIFT') {
      // High backlift as bowler strides in
      spineGroup.rotation.set(0.18, -0.5, 0);
      headGroup.rotation.set(-0.1, 0.5, 0);

      rightShoulder.rotation.set(-0.8 * progress, 0.3, -0.4);
      rightForearm.rotation.set(0.9, 0, 0);
      leftShoulder.rotation.set(-0.6 * progress, -0.3, 0.4);

      if (joints.bat) joints.bat.rotation.set(-1.2 * progress, 0, 0.3);
    }

    else if (state === 'COVER_DRIVE' || state === 'STRAIGHT_DRIVE' || state === 'ON_DRIVE') {
      // Front foot leaning forward into drive
      const swingP = Math.min(1, progress * 1.5);
      const isCover = state === 'COVER_DRIVE';
      const isOn = state === 'ON_DRIVE';
      const sideAngle = isCover ? -0.35 : isOn ? 0.35 : 0;

      spineGroup.rotation.set(0.35, sideAngle * swingP, 0);
      pelvis.position.y = 0.82;

      // Front leg strides forward
      leftHip.rotation.set(-0.65 * swingP, 0, 0);
      leftKnee.rotation.set(0.8 * swingP, 0, 0);
      rightHip.rotation.set(0.35 * swingP, 0, 0);

      // High elbow and bat swing down the vertical arc
      rightShoulder.rotation.set(-0.8 + (swingP * 2.2), sideAngle * 0.5, -0.3);
      rightForearm.rotation.set(0.4 * (1 - swingP), 0, 0);
      leftShoulder.rotation.set(-0.5 + (swingP * 1.8), -0.4 + sideAngle * 0.5, 0.3);

      if (joints.bat) joints.bat.rotation.set(-1.2 + (swingP * 2.4), sideAngle, -0.2);
    }

    else if (state === 'SQUARE_CUT' || state === 'CUT') {
      // Backfoot transfer, horizontal slashing swing
      const swingP = Math.min(1, progress * 1.6);
      spineGroup.rotation.set(0.1, -0.6 * swingP, 0);
      rightHip.rotation.set(-0.4, 0, 0);
      rightKnee.rotation.set(0.5, 0, 0);

      rightShoulder.rotation.set(-0.4 + (swingP * 1.5), 0.8 * swingP, -0.6);
      leftShoulder.rotation.set(-0.2 + (swingP * 1.2), 0.6 * swingP, -0.3);
      if (joints.bat) joints.bat.rotation.set(-0.8, -0.8 * swingP, -0.9 * swingP);
    }

    else if (state === 'PULL_SHOT' || state === 'HOOK_SHOT' || state === 'PULL' || state === 'HOOK') {
      // Swivelling pull shot over mid-wicket
      const swingP = Math.min(1, progress * 1.6);
      spineGroup.rotation.set(-0.1, 0.9 * swingP, 0);
      pelvis.rotation.y = 0.7 * swingP;

      rightShoulder.rotation.set(0.5, -0.9 * swingP, 0.6);
      leftShoulder.rotation.set(0.4, -0.8 * swingP, 0.4);
      if (joints.bat) joints.bat.rotation.set(0.2, 1.2 * swingP, 0.8 * swingP);
    }

    else if (state === 'FLICK' || state === 'GLANCE') {
      // Wristy flick off the pads
      const swingP = Math.min(1, progress * 1.6);
      spineGroup.rotation.set(0.2, 0.5 * swingP, 0);
      leftHip.rotation.set(-0.4 * swingP, 0, 0);
      leftKnee.rotation.set(0.5 * swingP, 0, 0);

      rightShoulder.rotation.set(0.2 + swingP * 1.2, 0.4 * swingP, 0.3);
      leftShoulder.rotation.set(0.3 + swingP * 1.0, -0.2, 0.2);
      if (joints.bat) joints.bat.rotation.set(-0.4 + swingP * 1.4, 0.7 * swingP, 0.5 * swingP);
    }

    else if (state === 'SWEEP') {
      // Down on one knee sweep
      const swingP = Math.min(1, progress * 1.5);
      spineGroup.rotation.set(0.4, 0.6 * swingP, 0);
      pelvis.position.y = 0.60;
      rightHip.rotation.set(-0.7, 0, 0);
      rightKnee.rotation.set(1.4, 0, 0); // Back knee on ground
      leftHip.rotation.set(-0.5, 0, 0);
      leftKnee.rotation.set(0.7, 0, 0);

      rightShoulder.rotation.set(0.4, 0.8 * swingP, 0.3);
      leftShoulder.rotation.set(0.4, 0.6 * swingP, 0.2);
      if (joints.bat) joints.bat.rotation.set(0.3, 1.2 * swingP, 0.2);
    }

    else if (state === 'LOFTED_SIX' || state === 'LOFT' || state === 'ATTACK') {
      // Monster aerial launch with full follow-through
      const swingP = Math.min(1, progress * 1.4);
      spineGroup.rotation.set(-0.25 * swingP, 0.3 * swingP, 0);
      headGroup.rotation.set(-0.4 * swingP, 0, 0); // Watching ball soar

      rightShoulder.rotation.set(-0.8 + (swingP * 2.8), 0.3, -0.2);
      leftShoulder.rotation.set(-0.6 + (swingP * 2.6), -0.3, 0.2);
      if (joints.bat) joints.bat.rotation.set(-1.4 + (swingP * 3.0), 0, 0);
    }

    else if (state === 'FORWARD_DEFENCE' || state === 'DEFEND') {
      // Solid forward defensive block
      const defP = Math.min(1, progress * 1.8);
      spineGroup.rotation.set(0.3 * defP, -0.1, 0);
      leftHip.rotation.set(-0.5 * defP, 0, 0);
      leftKnee.rotation.set(0.6 * defP, 0, 0);

      rightShoulder.rotation.set(0.4 * defP, 0.1, -0.1);
      rightForearm.rotation.set(0.5, 0, 0);
      leftShoulder.rotation.set(0.5 * defP, -0.2, 0.1);
      if (joints.bat) joints.bat.rotation.set(-0.2 * defP, 0, 0.1);
    }

    else if (state === 'BACKFOOT_DEFENCE') {
      const defP = Math.min(1, progress * 1.8);
      spineGroup.rotation.set(0.15 * defP, 0, 0);
      rightHip.rotation.set(-0.3 * defP, 0, 0);
      rightKnee.rotation.set(0.4 * defP, 0, 0);

      rightShoulder.rotation.set(0.3 * defP, 0, 0);
      leftShoulder.rotation.set(0.3 * defP, 0, 0);
      if (joints.bat) joints.bat.rotation.set(-0.3 * defP, 0, 0);
    }

    else if (state === 'LEAVE') {
      // Shoulders arms, lifts bat away from off-stump
      const leaveP = Math.min(1, progress * 1.6);
      spineGroup.rotation.set(0.05, -0.3, 0);
      rightShoulder.rotation.set(-0.9 * leaveP, 0.4, -0.3);
      leftShoulder.rotation.set(-0.8 * leaveP, -0.3, 0.3);
      if (joints.bat) joints.bat.rotation.set(-1.1 * leaveP, 0, 0.4);
    }

    else if (state === 'EDGE' || state === 'MISS') {
      // Pushing outside off stump with inside/outside edge
      const edgeP = Math.min(1, progress * 1.5);
      spineGroup.rotation.set(0.25, -0.3, 0);
      rightShoulder.rotation.set(0.2 + edgeP * 0.9, 0.4, -0.2);
      leftShoulder.rotation.set(0.2 + edgeP * 0.8, -0.2, 0.2);
      if (joints.bat) joints.bat.rotation.set(-0.4 + edgeP * 0.6, 0.2, -0.3);
    }

    // ── 3. BOWLER STATES ──
    else if (state === 'BOWLING_READY') {
      // Stable at the top of bowling mark: holding ball with both hands in front of chest
      spineGroup.rotation.set(0.12, 0, 0);
      rightShoulder.rotation.set(0.45, 0.25, -0.15);
      rightForearm.rotation.set(0.95, 0, 0);
      leftShoulder.rotation.set(0.45, -0.25, 0.15);
      leftForearm.rotation.set(0.95, 0, 0);
      pelvis.position.y = 0.95;
    }

    else if (state === 'RUN_UP' || state === 'BOWLER_RUNUP') {
      // Full athletic sprint strides & arm pumping
      const runCycle = progress * Math.PI * 8;
      const legSwing = Math.sin(runCycle) * 0.75;
      const armSwing = Math.sin(runCycle) * 0.85;

      leftHip.rotation.set(legSwing, 0, 0);
      leftKnee.rotation.set(Math.max(0, -legSwing * 1.2), 0, 0);
      rightHip.rotation.set(-legSwing, 0, 0);
      rightKnee.rotation.set(Math.max(0, legSwing * 1.2), 0, 0);

      leftShoulder.rotation.set(-armSwing, 0, 0);
      rightShoulder.rotation.set(armSwing, 0, 0);
      rightForearm.rotation.set(0.5, 0, 0);
      spineGroup.rotation.set(0.20, 0, 0); // Forward athletic lean
      pelvis.position.y = 0.95 + Math.abs(Math.sin(runCycle)) * 0.12;
    }

    else if (state === 'GATHER' || state === 'BOWLER_GATHER') {
      // Bowler bounds into gather: leaps onto back foot, side-on chest, non-bowling arm reaches up high
      const gP = Math.min(1, progress * 1.8);
      pelvis.position.y = 1.05 + Math.sin(gP * Math.PI) * 0.15; // Vertical bound
      spineGroup.rotation.set(0.1, -0.45 * gP, 0); // Side-on turn
      headGroup.rotation.set(0, 0.45 * gP, 0); // Eyes stay locked on batter

      // Back leg lands slightly bent
      rightHip.rotation.set(-0.35, 0, 0);
      rightKnee.rotation.set(0.55, 0, 0);
      leftHip.rotation.set(0.65 * gP, 0, 0); // Front leg raised in air
      leftKnee.rotation.set(1.1 * gP, 0, 0);

      // Non-bowling arm aims high at batsman, bowling arm tucked ready
      leftShoulder.rotation.set(-1.8 * gP, -0.3, 0.3);
      rightShoulder.rotation.set(0.4, 0.5 * gP, -0.3);
      rightForearm.rotation.set(1.4, 0, 0);
    }

    else if (state === 'DELIVERY_STRIDE') {
      // Front foot plant at crease, hips rotating forward, torso leaning over front knee
      const strP = Math.min(1, progress * 1.5);
      pelvis.position.y = 0.88;

      // Front leg braced straight, back leg trailing
      leftHip.rotation.set(-0.75 * strP, 0, 0);
      leftKnee.rotation.set(0.15, 0, 0); // Braced front knee
      rightHip.rotation.set(0.60 * strP, 0, 0);
      rightKnee.rotation.set(0.40, 0, 0);

      spineGroup.rotation.set(0.25 * strP, -0.2 * (1 - strP), 0);
      // Non-bowling arm pulls down hard
      leftShoulder.rotation.set(-1.2 * (1 - strP) + strP * 0.8, -0.2, -0.2);
      // Bowling arm begins cocking back
      rightShoulder.rotation.set(-1.5 * strP, 0.2, 0.1);
      rightForearm.rotation.set(0.3 * (1 - strP), 0, 0);
    }

    else if (state === 'ARM_ROTATION') {
      // Full 360-degree overarm windmill rotation
      const armProg = Math.min(1, Math.max(0, progress));
      // Sweeps from behind (-PI*0.8) all the way up through vertical (PI*0.95)
      const armRotationAngle = -Math.PI * 0.8 + (armProg * Math.PI * 1.85);

      rightShoulder.rotation.set(armRotationAngle, 0, 0.12);
      rightForearm.rotation.set(0.08, 0, 0); // Straight arm (legal delivery)
      leftShoulder.rotation.set(1.1 * armProg, 0, -0.35); // Non-bowling arm tucked into side

      // Torso arches and snaps forward
      spineGroup.rotation.set(0.35 + armProg * 0.25, 0, 0);
      pelvis.position.y = 0.88;
      leftHip.rotation.set(-0.75, 0, 0);
      leftKnee.rotation.set(0.20, 0, 0);
      rightHip.rotation.set(0.65, 0, 0);
    }

    else if (state === 'RELEASE' || state === 'BALL_RELEASE') {
      // High arm release at the top of arc, head leaning toward target, hand open
      rightShoulder.rotation.set(Math.PI * 0.96, 0, 0.08);
      rightForearm.rotation.set(0.02, 0, 0); // Fully extended vertical arm
      leftShoulder.rotation.set(0.9, 0, -0.4);
      spineGroup.rotation.set(0.50, 0, 0); // Flexed over front knee
      pelvis.position.y = 0.87;

      leftHip.rotation.set(-0.70, 0, 0);
      leftKnee.rotation.set(0.25, 0, 0);
      rightHip.rotation.set(0.70, 0, 0);
    }

    else if (state === 'FOLLOW_THROUGH') {
      // Deceleration into follow-through leap across the crease
      const ftP = Math.min(1, progress * 1.5);
      spineGroup.rotation.set(0.45 * (1 - ftP) + 0.15 * ftP, 0.2, 0);
      rightShoulder.rotation.set(1.2 * (1 - ftP) + 0.3 * ftP, 0.4, 0.3); // Bowling arm across opposite hip
      leftShoulder.rotation.set(0.4, -0.2, 0.2);
      leftHip.rotation.set(0.4 * (1 - ftP) - 0.2 * ftP, 0, 0);
      rightHip.rotation.set(-0.3 * (1 - ftP) + 0.3 * ftP, 0, 0);
      pelvis.position.y = 0.88 + Math.sin(ftP * Math.PI) * 0.08;
    }

    // ── 4. WICKETKEEPER STATES ──
    else if (state === 'KEEPER_CROUCH' || state === 'KEEPER_READY') {
      // WICKETKEEPER CROUCH: Deep knee bend, pelvis low, hands ready
      spineGroup.rotation.set(0.5, 0, 0);
      headGroup.rotation.set(-0.35, 0, 0); // Head up watching bowler & pitch
      pelvis.position.y = 0.66;

      leftHip.rotation.set(-0.75, 0, 0.2);
      leftKnee.rotation.set(1.25, 0, 0);
      rightHip.rotation.set(-0.75, 0, -0.2);
      rightKnee.rotation.set(1.25, 0, 0);

      rightShoulder.rotation.set(0.65, 0.25, 0);
      leftShoulder.rotation.set(0.65, -0.25, 0);
      rightForearm.rotation.set(0.5, 0, 0);
      leftForearm.rotation.set(0.5, 0, 0);
    }

    else if (state === 'KEEPER_COLLECT' || state === 'KEEPER_CATCH') {
      // Rises slightly to gather ball into gloves
      const colP = Math.min(1, progress * 1.8);
      spineGroup.rotation.set(0.35, 0, 0);
      headGroup.rotation.set(-0.2, 0, 0);
      pelvis.position.y = 0.75;

      leftHip.rotation.set(-0.5, 0, 0.1);
      leftKnee.rotation.set(0.9, 0, 0);
      rightHip.rotation.set(-0.5, 0, -0.1);
      rightKnee.rotation.set(0.9, 0, 0);

      rightShoulder.rotation.set(0.8 * colP, 0.1, 0);
      leftShoulder.rotation.set(0.8 * colP, -0.1, 0);
      rightForearm.rotation.set(0.6, 0, 0);
      leftForearm.rotation.set(0.6, 0, 0);
    }

    else if (state === 'KEEPER_STUMPING' || state === 'STUMPING') {
      // Rapid swipe of gloves at stumps
      const stpP = Math.min(1, progress * 2.0);
      spineGroup.rotation.set(0.6, -0.3 * stpP, 0);
      pelvis.position.y = 0.65;
      rightShoulder.rotation.set(1.1 * stpP, -0.4 * stpP, 0);
      leftShoulder.rotation.set(1.1 * stpP, -0.4 * stpP, 0);
    }

    // ── 5. FIELDING & RUNNING STATES ──
    else if (state === 'FIELD_READY') {
      // Athletic ready posture: Hands on knees, slightly bent waist, alert & stationary
      spineGroup.rotation.set(0.3, 0, 0);
      headGroup.rotation.set(-0.2, 0, 0);
      pelvis.position.y = 0.88;

      leftHip.rotation.set(-0.35, 0, 0.1);
      leftKnee.rotation.set(0.5, 0, 0);
      rightHip.rotation.set(-0.35, 0, -0.1);
      rightKnee.rotation.set(0.5, 0, 0);

      rightShoulder.rotation.set(0.5, 0.2, 0);
      leftShoulder.rotation.set(0.5, -0.2, 0);
      rightForearm.rotation.set(0.4, 0, 0);
      leftForearm.rotation.set(0.4, 0, 0);
    }

    else if (state === 'RUN_BETWEEN_WICKETS' || state === 'RUN_TO_BALL') {
      const runCycle = progress * Math.PI * 7;
      const legSwing = Math.sin(runCycle) * 0.7;
      const armSwing = Math.sin(runCycle) * 0.75;

      leftHip.rotation.set(legSwing, 0, 0);
      leftKnee.rotation.set(Math.max(0, -legSwing * 1.1), 0, 0);
      rightHip.rotation.set(-legSwing, 0, 0);
      rightKnee.rotation.set(Math.max(0, legSwing * 1.1), 0, 0);

      leftShoulder.rotation.set(-armSwing, 0, 0);
      rightShoulder.rotation.set(armSwing, 0, 0);
      pelvis.position.y = 0.95 + Math.abs(Math.sin(runCycle)) * 0.1;
    }

    else if (state === 'GROUND_FIELD' || state === 'GROUND_PICKUP') {
      // Bend down low with cupped hands
      spineGroup.rotation.set(0.7, 0, 0);
      pelvis.position.y = 0.65;
      leftHip.rotation.set(-0.6, 0, 0);
      leftKnee.rotation.set(0.9, 0, 0);
      rightHip.rotation.set(-0.6, 0, 0);
      rightKnee.rotation.set(0.9, 0, 0);
      rightShoulder.rotation.set(0.8, 0, 0);
      leftShoulder.rotation.set(0.8, 0, 0);
    }

    else if (state === 'DIVING_CATCH' || state === 'HIGH_CATCH' || state === 'LOW_CATCH') {
      // Leaping dive with outstretched hands
      spineGroup.rotation.set(0.5, 0, 0);
      pelvis.position.y = 0.55;
      rightShoulder.rotation.set(-1.4, 0.2, 0);
      leftShoulder.rotation.set(-1.4, -0.2, 0);
    }

    else if (state === 'THROW') {
      // Step and overhand throw directly aimed at stumps
      const throwP = Math.min(1, progress * 2.0);
      spineGroup.rotation.set(0.2, -0.4 * (1 - throwP) + 0.4 * throwP, 0);
      rightShoulder.rotation.set(-1.2 + (throwP * 2.4), 0, 0);
      leftShoulder.rotation.set(0.6 * (1 - throwP), 0, 0);
    }

    // ── 6. CELEBRATIONS, REACTION & EMOTION STATES ──
    else if (state === 'CELEBRATION' || state === 'BOWLER_CELEBRATION') {
      // Bowler jump & ecstatic fist pump
      const celebP = Math.sin(progress * Math.PI * 4);
      spineGroup.rotation.set(-0.2, 0, 0);
      pelvis.position.y = 0.95 + Math.abs(celebP) * 0.2;
      rightShoulder.rotation.set(-2.2 + (celebP * 0.4), 0, 0.2);
      leftShoulder.rotation.set(-1.4, 0, -0.4);
      rightForearm.rotation.set(0.6, 0, 0);
      leftForearm.rotation.set(0.6, 0, 0);
    }

    else if (state === 'BAT_RAISE') {
      // Batter raises bat aloft to salute 50 / crowd / milestone
      const raiseP = Math.min(1, progress * 2.0);
      spineGroup.rotation.set(-0.1, 0, 0);
      headGroup.rotation.set(-0.15, Math.sin(progress * Math.PI * 2) * 0.25, 0); // nods / looks around
      pelvis.position.y = 0.95;

      rightShoulder.rotation.set(-2.4 * raiseP, 0.2, 0.1);
      rightForearm.rotation.set(0.2, 0, 0);
      if (joints.bat) joints.bat.rotation.set(0.2, 0, 0);

      leftShoulder.rotation.set(0.2, 0, 0); // resting left arm
    }

    else if (state === 'HELMET_RAISE') {
      // Century / 150 / 200: Raises bat in right hand, lifts helmet in left hand
      const raiseP = Math.min(1, progress * 2.0);
      spineGroup.rotation.set(-0.15, 0, 0);
      headGroup.rotation.set(-0.2, Math.sin(progress * Math.PI * 2) * 0.3, 0);
      pelvis.position.y = 0.95;

      rightShoulder.rotation.set(-2.5 * raiseP, 0.3, 0.2);
      if (joints.bat) joints.bat.rotation.set(0.3, 0, 0);

      leftShoulder.rotation.set(-2.3 * raiseP, -0.3, -0.2); // holding helmet high
    }

    else if (state === 'FIST_PUMP') {
      // Passionate power fist pump
      const pumpP = Math.sin(progress * Math.PI * 5);
      spineGroup.rotation.set(0.15, 0.1, 0);
      pelvis.position.y = 0.95;

      rightShoulder.rotation.set(-0.5 + (pumpP * 0.8), 0.3, -0.2);
      rightForearm.rotation.set(1.2, 0, 0);
      leftShoulder.rotation.set(0.3, -0.2, 0.1);
    }

    else if (state === 'CONFIDENT_WALK') {
      // Batter smiling, confident stride tapping the pitch
      const walkCycle = progress * Math.PI * 6;
      spineGroup.rotation.set(0.05, 0, 0);
      pelvis.position.y = 0.95 + Math.abs(Math.sin(walkCycle)) * 0.05;

      leftHip.rotation.set(Math.sin(walkCycle) * 0.35, 0, 0);
      rightHip.rotation.set(-Math.sin(walkCycle) * 0.35, 0, 0);
      rightShoulder.rotation.set(0.2, 0, 0);
      leftShoulder.rotation.set(0.2, 0, 0);
    }

    else if (state === 'BOWLER_APPEAL' || state === 'FIELDER_APPEAL') {
      // Explosive appeal: Both arms thrust into air, shouting "HOWZAT"
      const appealP = Math.min(1, progress * 2.5);
      spineGroup.rotation.set(-0.25 * appealP, 0, 0);
      headGroup.rotation.set(-0.4 * appealP, 0, 0);
      pelvis.position.y = 0.95 + Math.sin(progress * Math.PI * 4) * 0.1;

      rightShoulder.rotation.set(-2.6 * appealP, 0.2, 0.2);
      leftShoulder.rotation.set(-2.6 * appealP, -0.2, -0.2);
      rightForearm.rotation.set(0.1, 0, 0);
      leftForearm.rotation.set(0.1, 0, 0);
    }

    else if (state === 'HANDS_ON_HEAD') {
      // Dropped catch or missed opportunity: Both hands placed on head in shock
      spineGroup.rotation.set(0.15, 0, 0);
      headGroup.rotation.set(0.3, 0, 0);
      pelvis.position.y = 0.92;

      rightShoulder.rotation.set(-2.1, 0.6, -0.4);
      leftShoulder.rotation.set(-2.1, -0.6, 0.4);
      rightForearm.rotation.set(1.5, 0, 0);
      leftForearm.rotation.set(1.5, 0, 0);
    }

    else if (state === 'BATTER_WALK_OFF' || state === 'BATTER_DISMISSED' || state === 'BOWLED_REACTION') {
      // Head down, disconsolate slow walk off the pitch
      const walkCycle = progress * Math.PI * 4;
      spineGroup.rotation.set(0.35, 0, 0);
      headGroup.rotation.set(0.45, 0, 0);
      pelvis.position.y = 0.92 + Math.abs(Math.sin(walkCycle)) * 0.04;

      leftHip.rotation.set(Math.sin(walkCycle) * 0.25, 0, 0);
      rightHip.rotation.set(-Math.sin(walkCycle) * 0.25, 0, 0);

      rightShoulder.rotation.set(0.4, 0, 0);
      leftShoulder.rotation.set(0.4, 0, 0);
      if (joints.bat) joints.bat.rotation.set(0.2, 0, 0);
    }

    else if (state === 'HEAD_SHAKE') {
      // Batter shaking head in disbelief looking at edge / replay
      spineGroup.rotation.set(0.2, 0, 0);
      headGroup.rotation.set(0.1, Math.sin(progress * Math.PI * 6) * 0.4, 0);
      rightShoulder.rotation.set(0.2, 0, 0);
      leftShoulder.rotation.set(0.2, 0, 0);
    }

    else if (state === 'TEAM_HUG' || state === 'HIGH_FIVE') {
      // Teammates leaping and clapping hands
      const hugP = Math.sin(progress * Math.PI * 3);
      spineGroup.rotation.set(-0.1, 0, 0);
      pelvis.position.y = 0.95 + Math.abs(hugP) * 0.15;

      rightShoulder.rotation.set(-1.8, 0.4, 0.3);
      leftShoulder.rotation.set(-1.8, -0.4, -0.3);
    }

    else if (state === 'CAPTAIN_CELEBRATION' || state === 'MATCH_WIN_CELEBRATION') {
      // Epic match victory celebration: Arms wide in glory
      spineGroup.rotation.set(-0.3, 0, 0);
      headGroup.rotation.set(-0.35, 0, 0);
      pelvis.position.y = 1.05 + Math.sin(progress * Math.PI * 3) * 0.15;

      rightShoulder.rotation.set(-1.5, 0, 1.2);
      leftShoulder.rotation.set(-1.5, 0, -1.2);
      rightForearm.rotation.set(0.2, 0, 0);
      leftForearm.rotation.set(0.2, 0, 0);
    }

    else if (state === 'BAT_TAP') {
      // Batters meet mid-pitch and tap bats together
      spineGroup.rotation.set(0.15, 0.2, 0);
      pelvis.position.y = 0.95;
      rightShoulder.rotation.set(0.6, 0.3, 0);
      if (joints.bat) joints.bat.rotation.set(0.8, 0.3, 0);
    }
  };

  const getHandWorldPosition = (): THREE.Vector3 => {
    const pos = new THREE.Vector3();
    ballSocket.getWorldPosition(pos);
    return pos;
  };

  const getBatContactWorldPosition = (): THREE.Vector3 => {
    const pos = new THREE.Vector3();
    if (joints.bat) {
      joints.bat.getWorldPosition(pos);
      pos.y -= 0.3; // Center of blade
    } else {
      rightHand.getWorldPosition(pos);
    }
    return pos;
  };

  const setAccentColor = (hex: number) => {
    teamAccentMat.color.setHex(hex);
    helmetMat.color.setHex(hex);
  };

  return {
    group: root,
    joints,
    config,
    updateAnimation,
    getHandWorldPosition,
    getBatContactWorldPosition,
    setAccentColor,
  };
}
