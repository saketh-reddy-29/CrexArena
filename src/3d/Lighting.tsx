import React from 'react';

export function Lighting() {
  return (
    <>
      {/* Deep stadium night ambient light with cool blue tint to maintain pitch clarity */}
      <ambientLight intensity={0.85} color="#c0d4f5" />

      {/* Main Pitch Warm Ground-Level Fill */}
      <directionalLight
        position={[0, 15, 0]}
        intensity={0.65}
        color="#fff4e0"
      />

      {/* Tower 1: Front-Left Floodlight Spotlight */}
      <directionalLight
        position={[-34, 38, -34]}
        target-position={[0, 0, 0]}
        intensity={2.2}
        color="#fff9ed"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-camera-near={10}
        shadow-camera-far={80}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />

      {/* Tower 2: Front-Right Floodlight Spotlight */}
      <directionalLight
        position={[34, 38, -34]}
        target-position={[0, 0, 0]}
        intensity={2.2}
        color="#fff9ed"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-camera-near={10}
        shadow-camera-far={80}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />

      {/* Tower 3: Back-Left Floodlight Spotlight */}
      <directionalLight
        position={[-34, 38, 34]}
        target-position={[0, 0, 0]}
        intensity={1.8}
        color="#f2f7ff"
      />

      {/* Tower 4: Back-Right Floodlight Spotlight */}
      <directionalLight
        position={[34, 38, 34]}
        target-position={[0, 0, 0]}
        intensity={1.8}
        color="#f2f7ff"
      />

      {/* Subtle rim light for crisp character silhouette separation from dark stands */}
      <pointLight position={[0, 6, -10]} intensity={1.2} color="#90cdf4" distance={25} />
      <pointLight position={[0, 6, 10]} intensity={1.2} color="#90cdf4" distance={25} />
    </>
  );
}

export default Lighting;
