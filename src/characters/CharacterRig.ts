import * as THREE from 'three';
import { clone as cloneSkinnedModel } from 'three/addons/utils/SkeletonUtils.js';
import '../lib/cricketArenaRig.js';
import { CricketArenaPose } from '../lib/cricketArenaAnimations';

export interface RigBoneDescription {
  n: string;
  si: number;
  isBone: boolean;
  p: number;
  lp: number[];
  lq: number[];
  wp: number[];
  wq: number[];
}

export interface RigResult {
  lq: Float32Array;
  hipsLocal: number[];
  palmL: number[];
  palmR: number[];
  wristL: number[];
  wristR: number[];
  elbowL: number[];
  elbowR: number[];
  shoulderL: number[];
  shoulderR: number[];
  ankleL: number[];
  ankleR: number[];
  kneeL: number[];
  kneeR: number[];
  ba: number;
  caps?: {
    body: Array<{ a: number[]; b: number[]; r: number; n: string }>;
    RAD: Record<string, number>;
  };
  dbg?: {
    armTorso: number;
    armArm: number;
    legLeg: number;
    legBody: number;
    bat: number;
    limit: number;
  };
}

export interface CricketRigModel {
  scene: THREE.Group;
  nodes: THREE.Object3D[];
  description: RigBoneDescription[];
  rig: {
    S: number;
    R: Record<string, number>;
    solve: (pose: CricketArenaPose, state: Record<string, unknown>, delta: number) => RigResult;
  };
}

export function buildCharacterRig(sourceScene: THREE.Group): CricketRigModel {
  const cloned = cloneSkinnedModel(sourceScene) as THREE.Group;
  cloned.updateMatrixWorld(true);

  const allNodes: THREE.Object3D[] = [];
  cloned.traverse((node) => allNodes.push(node));

  const keep = new Set<THREE.Object3D>();
  allNodes.forEach((node) => {
    if (node.type === 'Bone') {
      for (let parent: THREE.Object3D | null = node; parent; parent = parent.parent) {
        keep.add(parent);
      }
    }
  });

  const rigNodes = allNodes.filter((node) => keep.has(node));
  const nodeIndexes = new Map(rigNodes.map((node, index) => [node, index]));
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  const bones: RigBoneDescription[] = rigNodes.map((node) => {
    node.matrixWorld.decompose(pos, quat, scale);
    return {
      n: node.name || 'node',
      si: allNodes.indexOf(node),
      isBone: node.type === 'Bone',
      p: node.parent ? (nodeIndexes.get(node.parent) ?? -1) : -1,
      lp: node.position.toArray(),
      lq: node.quaternion.toArray(),
      wp: pos.toArray(),
      wq: quat.toArray(),
    };
  });

  let ground = 0;
  try {
    ground = new THREE.Box3().setFromObject(cloned).min.y;
  } catch {
    ground = 0;
  }

  const api = (window as unknown as { CARig?: { build: (d: { bones: RigBoneDescription[]; ground: number }) => CricketRigModel['rig'] } }).CARig;
  if (!api) {
    throw new Error('CARig system is not available in global window context.');
  }

  // Ensure materials are skinning-enabled and optimized for stadium floodlights
  cloned.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = child as THREE.SkinnedMesh;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            (mat as THREE.MeshStandardMaterial).roughness = 0.7;
          });
        } else {
          (mesh.material as THREE.MeshStandardMaterial).roughness = 0.7;
        }
      }
    }
  });

  return {
    scene: cloned,
    nodes: allNodes,
    description: bones,
    rig: api.build({ bones, ground }),
  };
}

export default buildCharacterRig;
