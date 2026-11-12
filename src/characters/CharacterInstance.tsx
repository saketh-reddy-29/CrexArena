import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { buildCharacterRig, CricketRigModel } from './CharacterRig';
import { CricketArenaAction, getCricketArenaPose } from '../lib/cricketArenaAnimations';

export interface CharacterInstanceProps {
  modelUrl: string;
  position: [number, number]; // [x, z] in 3D stadium coordinates
  yaw: number;                // Facing angle in radians
  action: CricketArenaAction;
  progress: number;
  hasBat?: boolean;
  isLeftHanded?: boolean;
  ballPos?: [number, number, number];
  showDebugSkeleton?: boolean;
}

export function CharacterInstance({
  modelUrl,
  position,
  yaw,
  action,
  progress,
  hasBat = false,
  isLeftHanded = false,
  ballPos,
  showDebugSkeleton = false,
}: CharacterInstanceProps) {
  const { scene } = useGLTF(modelUrl);
  const model: CricketRigModel = useMemo(() => buildCharacterRig(scene), [scene]);

  const rootRef = useRef<THREE.Group>(null);
  const modelWrapperRef = useRef<THREE.Group>(null);
  const batRef = useRef<THREE.Group>(null);
  const solverState = useRef<Record<string, unknown>>({});

  // Debug Skeleton Line Ref
  const debugLinesRef = useRef<THREE.LineSegments>(null);

  // 3D Bat geometry & materials
  const batGroup = useMemo(() => {
    const group = new THREE.Group();

    // Bat Handle (Dark cane rubber wrap)
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.024, 0.44, 12),
      new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.85 })
    );
    handle.position.y = -0.2;

    // Bat Grip (Textured rubber grip in orange/red)
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.6 })
    );
    grip.position.y = -0.11;

    // Bat Blade (English Willow wood with curved profile)
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.125, 0.68, 0.062),
      new THREE.MeshStandardMaterial({ color: '#d8aa62', roughness: 0.75, metalness: 0.05 })
    );
    blade.position.y = -0.68;

    // Bat Spine Ridge
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.52, 0.038),
      new THREE.MeshStandardMaterial({ color: '#c2924a', roughness: 0.8 })
    );
    spine.position.set(0, -0.68, -0.045);

    group.add(handle, grip, blade, spine);
    return group;
  }, []);

  useFrame((state, delta) => {
    const root = rootRef.current;
    const modelWrapper = modelWrapperRef.current;
    if (!root || !modelWrapper) return;

    const clock = state.clock.elapsedTime;
    let pose = getCricketArenaPose(action, progress, clock, isLeftHanded);

    // Dynamic Head Tracking: look towards ball if within 12 meters
    if (ballPos && root) {
      const charWorldPos = root.position;
      const dx = ballPos[0] - charWorldPos.x;
      const dz = ballPos[2] - charWorldPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 14) {
        const targetPitch = Math.atan2(dx, dz) - yaw;
        pose = {
          ...pose,
          head: (pose.head || 0) + THREE.MathUtils.clamp(targetPitch * 0.4, -0.6, 0.6),
        };
      }
    }

    // Update root position and rotation
    root.position.set(position[0], 0, position[1]);
    root.rotation.y = yaw - Math.PI / 2 + pose.yw * Math.PI / 2 + (pose.sp || 0);

    modelWrapper.position.y = pose.air || 0;
    modelWrapper.rotation.set(0, Math.PI / 2 - (pose.yw || 0) * Math.PI / 2, -(pose.rot || 0));

    // Solve kinematics and anatomical collision constraints
    const dt = Math.min(delta, 0.05);
    const output = model.rig.solve(pose, solverState.current, dt);

    // Apply solved bone quaternions
    const bones = model.description;
    for (let i = 0; i < bones.length; i++) {
      if (bones[i].isBone) {
        const node = model.nodes[bones[i].si];
        node.quaternion.set(
          output.lq[i * 4],
          output.lq[i * 4 + 1],
          output.lq[i * 4 + 2],
          output.lq[i * 4 + 3]
        );
      }
    }

    // Apply solved hips displacement
    const hipsIdx = model.rig.R.hips;
    if (hipsIdx !== undefined) {
      const hipsNode = model.nodes[model.description[hipsIdx].si];
      hipsNode.position.set(output.hipsLocal[0], output.hipsLocal[1], output.hipsLocal[2]);
    }

    // Update Bat position attached to hands
    const bat = batRef.current;
    if (bat && hasBat) {
      const isGripping = (pose.grip || 0) > 0.5;
      bat.visible = isGripping;
      if (isGripping) {
        const isTwoHand = (pose.grip || 0) > 1.5;
        const palm = isTwoHand ? output.palmL : output.palmR;
        const ba = output.ba;
        const dx = Math.sin(ba);
        const dy = -Math.cos(ba);

        bat.position.set(
          palm[0] - dx * 0.06,
          palm[1] - dy * 0.06,
          isTwoHand ? (output.palmL[2] + output.palmR[2]) * 0.5 : palm[2]
        );
        bat.rotation.set(0, 0, ba);
      }
    }

    // Update debug skeleton if enabled
    if (showDebugSkeleton && debugLinesRef.current) {
      const geom = debugLinesRef.current.geometry;
      const positions = geom.attributes.position.array as Float32Array;
      let ptr = 0;
      const R = model.rig.R;
      const pairs = [
        [R.hips, R.spine],
        [R.spine, R.chest],
        [R.chest, R.neck],
        [R.neck, R.head],
        [R.chest, R.Lua],
        [R.Lua, R.Lla],
        [R.Lla, R.Lhand],
        [R.chest, R.Rua],
        [R.Rua, R.Rla],
        [R.Rla, R.Rhand],
        [R.hips, R.Lul],
        [R.Lul, R.Lll],
        [R.Lll, R.Lfoot],
        [R.hips, R.Rul],
        [R.Rul, R.Rll],
        [R.Rll, R.Rfoot],
      ];

      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      pairs.forEach(([a, b]) => {
        if (a !== undefined && b !== undefined) {
          const nodeA = model.nodes[model.description[a].si];
          const nodeB = model.nodes[model.description[b].si];
          nodeA.getWorldPosition(vA);
          nodeB.getWorldPosition(vB);
          positions[ptr++] = vA.x;
          positions[ptr++] = vA.y;
          positions[ptr++] = vA.z;
          positions[ptr++] = vB.x;
          positions[ptr++] = vB.y;
          positions[ptr++] = vB.z;
        }
      });
      geom.attributes.position.needsUpdate = true;
    }
  });

  const debugGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 6), 3));
    return geom;
  }, []);

  return (
    <group ref={rootRef} position={[position[0], 0, position[1]]}>
      <group ref={modelWrapperRef} scale={model.rig.S}>
        <primitive object={model.scene} />
        {hasBat && <primitive object={batGroup} ref={batRef} />}
      </group>

      {showDebugSkeleton && (
        <lineSegments ref={debugLinesRef} geometry={debugGeometry}>
          <lineBasicMaterial color="#00ffcc" depthTest={false} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

export default CharacterInstance;
