import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

export type CameraViewMode = 'EA_BATTER' | 'BROADCAST' | 'BOWLER_CAM' | 'ACTION_CAM' | 'ORBIT';

export interface CameraSystemProps {
  mode?: CameraViewMode;
  ballPos?: [number, number, number];
  strikerPos?: [number, number];
  bowlerPos?: [number, number];
  isBallTravelling?: boolean;
}

export function CameraSystem({
  mode = 'EA_BATTER',
  ballPos = [0, 0.18, 0],
  strikerPos = [0, -4.9],
  bowlerPos = [0, 12],
  isBallTravelling = false,
}: CameraSystemProps) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3(0, 1.2, 2));
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 2));

  useFrame((_, delta) => {
    if (mode === 'ORBIT') return;

    const lerpSpeed = Math.min(1, delta * 5.0);

    if (mode === 'EA_BATTER') {
      // Classic EA Cricket 07 camera behind the striker looking towards the bowler
      const camPos = new THREE.Vector3(0, 2.2, -8.2);
      let lookTarget = new THREE.Vector3(0, 1.1, 4.5);

      if (isBallTravelling && ballPos) {
        // Smoothly track ball if it's travelling fast or hit into outfield
        lookTarget = new THREE.Vector3(ballPos[0] * 0.45, Math.max(1.0, ballPos[1] * 0.5), ballPos[2]);
        // Slight dynamic camera pan to maintain visual on ball
        camPos.x = THREE.MathUtils.lerp(camPos.x, ballPos[0] * 0.18, lerpSpeed * 0.5);
      }

      camera.position.lerp(camPos, lerpSpeed);
      currentLookAt.current.lerp(lookTarget, lerpSpeed);
      camera.lookAt(currentLookAt.current);
    } else if (mode === 'BROADCAST') {
      // Elevated TV Broadcast angle
      const camPos = new THREE.Vector3(-12, 13, -18);
      const lookTarget = isBallTravelling && ballPos
        ? new THREE.Vector3(ballPos[0], ballPos[1], ballPos[2])
        : new THREE.Vector3(0, 0.8, 0);

      camera.position.lerp(camPos, lerpSpeed);
      currentLookAt.current.lerp(lookTarget, lerpSpeed);
      camera.lookAt(currentLookAt.current);
    } else if (mode === 'BOWLER_CAM') {
      // Behind bowler running in towards striker
      const camPos = new THREE.Vector3(0, 2.6, 12.5);
      const lookTarget = new THREE.Vector3(strikerPos[0], 1.1, strikerPos[1]);

      camera.position.lerp(camPos, lerpSpeed);
      currentLookAt.current.lerp(lookTarget, lerpSpeed);
      camera.lookAt(currentLookAt.current);
    } else if (mode === 'ACTION_CAM') {
      // Dynamic Action Cam tracking ball closely
      if (ballPos) {
        const camPos = new THREE.Vector3(ballPos[0] - 3.5, ballPos[1] + 2.5, ballPos[2] - 4.5);
        camera.position.lerp(camPos, lerpSpeed * 1.5);
        currentLookAt.current.lerp(new THREE.Vector3(ballPos[0], ballPos[1], ballPos[2]), lerpSpeed * 1.5);
        camera.lookAt(currentLookAt.current);
      }
    }
  });

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 2.2, -8.2]}
        fov={48}
        near={0.1}
        far={250}
      />
      {mode === 'ORBIT' && (
        <OrbitControls
          makeDefault
          target={[0, 1.0, 0]}
          minDistance={3}
          maxDistance={65}
          maxPolarAngle={Math.PI / 2.05}
          enablePan={true}
        />
      )}
    </>
  );
}

export default CameraSystem;
