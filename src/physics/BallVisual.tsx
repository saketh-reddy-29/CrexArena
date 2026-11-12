import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface BallVisualProps {
  position: [number, number, number];
  visible: boolean;
  scale?: number;
  spinVelocity?: number;
  isHitFlash?: boolean;
}

export function BallVisual({
  position,
  visible,
  scale = 1.0,
  spinVelocity = 8.0,
  isHitFlash = false,
}: BallVisualProps) {
  const ballGroupRef = useRef<THREE.Group>(null);
  const flashMeshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ballGroupRef.current && visible) {
      ballGroupRef.current.position.set(position[0], position[1], position[2]);
      // Spin seam
      ballGroupRef.current.rotation.x += delta * spinVelocity;
      ballGroupRef.current.rotation.z += delta * spinVelocity * 0.7;
    }

    if (flashMeshRef.current) {
      if (isHitFlash) {
        flashMeshRef.current.visible = true;
        (flashMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.9;
        flashMeshRef.current.scale.setScalar(2.2);
      } else if (flashMeshRef.current.visible) {
        const mat = flashMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity *= 0.75;
        if (mat.opacity < 0.05) flashMeshRef.current.visible = false;
      }
    }
  });

  // Authentic white stitched seam geometry
  const seamGeometry = useMemo(() => new THREE.TorusGeometry(0.102, 0.008, 8, 32), []);

  if (!visible) return null;

  return (
    <group ref={ballGroupRef} scale={0.16 * scale}>
      {/* Red leather cricket ball sphere */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.1, 24, 20]} />
        <meshStandardMaterial
          color="#b91c1c"
          roughness={0.3}
          metalness={0.15}
          emissive="#3b0707"
        />
      </mesh>

      {/* White seam ring */}
      <mesh geometry={seamGeometry} rotation={[0, Math.PI / 2, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Bat contact impact flash */}
      <mesh ref={flashMeshRef} visible={false}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial
          color="#fef08a"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export default BallVisual;
