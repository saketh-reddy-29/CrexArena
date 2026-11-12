import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface StadiumScoreboardData {
  battingTeamName: string;
  bowlingTeamName: string;
  score: { runs: number; wickets: number; overs: number; balls: number };
  target?: number;
  strikerName?: string;
  strikerRuns?: number;
  strikerBalls?: number;
  nonStrikerName?: string;
  nonStrikerRuns?: number;
  nonStrikerBalls?: number;
  bowlerName?: string;
  bowlerWickets?: number;
  bowlerRuns?: number;
  bowlerOvers?: number;
  bowlerBalls?: number;
  recentEvent?: string | null;
}

// Procedural texture for outfield circular mower rings
function createOutfieldTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base grass color
  ctx.fillStyle = '#227329';
  ctx.fillRect(0, 0, 1024, 1024);

  // Concentric rings to simulate circular outfield mower pattern
  const center = 512;
  const ringWidth = 32;
  const numRings = 24;

  for (let i = 0; i < numRings; i++) {
    const radius = i * ringWidth;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(46, 154, 61, 0.45)' : 'rgba(27, 95, 34, 0.45)';
    ctx.stroke();
  }

  // Radial mower stripes
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.cos(a) * 600, center + Math.sin(a) * 600);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 14;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Procedural texture for pitch clay and turf blend
function createPitchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Clay / turf base
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#9e8455');
  grad.addColorStop(0.15, '#c9ad76');
  grad.addColorStop(0.5, '#d6be8c');
  grad.addColorStop(0.85, '#c9ad76');
  grad.addColorStop(1, '#9e8455');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 1024);

  // Pitch wear markings (grass tufts and bowler footmarks)
  ctx.fillStyle = '#8f774a';
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 1024;
    const r = Math.random() * 3 + 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bowler landing scuff marks near both bowling creases
  ctx.fillStyle = 'rgba(110, 90, 55, 0.5)';
  ctx.fillRect(160, 80, 192, 120);
  ctx.fillRect(160, 824, 192, 120);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Procedural texture for perimeter LED advertising ribbons
function createLedAdTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, 2048, 128);

  const sponsors = [
    { text: 'CRIC ARENA', bg: '#0b2a66', color: '#ffd23f' },
    { text: 'POWERPLAY', bg: '#c8102e', color: '#ffffff' },
    { text: 'MAXIMUM 6', bg: '#105b38', color: '#e0ff4f' },
    { text: 'SUPER 4s', bg: '#5c1d73', color: '#ffb3ff' },
    { text: 'SPEED RADAR', bg: '#d44e13', color: '#ffffff' },
    { text: 'LIVE 3D', bg: '#0b5b66', color: '#5bf5ff' },
  ];

  const segW = 2048 / 8;
  for (let i = 0; i < 8; i++) {
    const sp = sponsors[i % sponsors.length];
    ctx.fillStyle = sp.bg;
    ctx.fillRect(i * segW + 4, 8, segW - 8, 112);

    ctx.fillStyle = sp.color;
    ctx.font = 'bold 36px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sp.text, i * segW + segW / 2, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

export function Stadium({
  scoreboardData,
  stumpHit = false,
}: {
  scoreboardData?: StadiumScoreboardData;
  stumpHit?: boolean;
}) {
  const ledAdRef = useRef<THREE.MeshBasicMaterial>(null);
  const scoreboardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreboardTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const flashGroupRef = useRef<THREE.Group>(null);

  // Dynamic Stumps state for striker end
  const strikerStumpRefs = useRef<THREE.Mesh[]>([]);
  const strikerBailRefs = useRef<THREE.Mesh[]>([]);

  // Create static textures
  const outfieldTexture = useMemo(() => createOutfieldTexture(), []);
  const pitchTexture = useMemo(() => createPitchTexture(), []);
  const ledTexture = useMemo(() => createLedAdTexture(), []);

  // Jumbotron scoreboard texture canvas
  const scoreboardTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    scoreboardCanvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    scoreboardTextureRef.current = tex;
    return tex;
  }, []);

  // Animate LED ribbons, spectator camera flashes, and update scoreboard
  useFrame((_, delta) => {
    if (ledTexture) {
      ledTexture.offset.x = (ledTexture.offset.x + delta * 0.08) % 1;
    }

    // Dynamic camera flashes in the crowd
    if (flashGroupRef.current) {
      flashGroupRef.current.children.forEach((flash) => {
        if (Math.random() < 0.05) {
          flash.visible = true;
          (flash as THREE.Sprite).material.opacity = 0.8 + Math.random() * 0.2;
        } else {
          (flash as THREE.Sprite).material.opacity *= 0.82;
          if ((flash as THREE.Sprite).material.opacity < 0.05) flash.visible = false;
        }
      });
    }

    // Dynamic stumps reaction if hit
    if (stumpHit) {
      strikerStumpRefs.current.forEach((stump, i) => {
        if (stump) {
          stump.rotation.z = Math.min(1.2, stump.rotation.z + delta * (2.5 + i * 0.8));
          stump.position.x += delta * (0.4 + i * 0.2);
          stump.position.y = Math.max(0.15, stump.position.y - delta * 0.2);
        }
      });
      strikerBailRefs.current.forEach((bail, i) => {
        if (bail) {
          bail.position.y += delta * 1.5;
          bail.position.x += delta * (i === 0 ? -0.8 : 0.8);
          bail.rotation.x += delta * 5;
          bail.rotation.z += delta * 4;
        }
      });
    } else {
      strikerStumpRefs.current.forEach((stump) => {
        if (stump) {
          stump.rotation.set(0, 0, 0);
          stump.position.y = 0.36;
        }
      });
      strikerBailRefs.current.forEach((bail, i) => {
        if (bail) {
          bail.position.set(i === 0 ? -0.06 : 0.06, 0.74, 0);
          bail.rotation.set(0, 0, 0);
        }
      });
    }

    // Update Scoreboard canvas
    const canvas = scoreboardCanvasRef.current;
    const tex = scoreboardTextureRef.current;
    if (canvas && tex) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a1020';
        ctx.fillRect(0, 0, 1024, 512);

        // Header border
        const headerGrad = ctx.createLinearGradient(0, 0, 1024, 0);
        headerGrad.addColorStop(0, '#0e2b5c');
        headerGrad.addColorStop(0.5, '#1e56c8');
        headerGrad.addColorStop(1, '#0e2b5c');
        ctx.fillStyle = headerGrad;
        ctx.fillRect(0, 0, 1024, 64);

        ctx.fillStyle = '#ffd23f';
        ctx.font = 'bold 32px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CRIC ARENA — INTERNATIONAL STADIUM', 512, 44);

        // Team names and Main Score
        const d = scoreboardData;
        const batTeam = d?.battingTeamName || 'INDIA';
        const bowlTeam = d?.bowlingTeamName || 'AUSTRALIA';
        const runs = d?.score?.runs ?? 158;
        const wkts = d?.score?.wickets ?? 3;
        const overs = d?.score?.overs ?? 16;
        const balls = d?.score?.balls ?? 4;
        const target = d?.target;

        // Score display
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 72px Impact, "Arial Black", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${batTeam.toUpperCase()}`, 40, 150);

        ctx.fillStyle = '#39ff14';
        ctx.font = '900 84px Impact, "Arial Black", sans-serif';
        ctx.fillText(`${runs} / ${wkts}`, 40, 240);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(`OVERS: ${overs}.${balls}`, 40, 290);

        const crr = overs > 0 || balls > 0 ? (runs / (overs + balls / 6)).toFixed(2) : '0.00';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px sans-serif';
        ctx.fillText(`CRR: ${crr}`, 40, 330);

        if (target && target > 0) {
          const needed = target - runs;
          const remBalls = Math.max(0, 120 - (overs * 6 + balls));
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 28px sans-serif';
          ctx.fillText(`NEED ${needed} RUNS IN ${remBalls} BALLS`, 40, 370);
        }

        // Batsmen Box
        ctx.fillStyle = '#111d33';
        ctx.fillRect(520, 80, 464, 180);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeRect(520, 80, 464, 180);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('BATTERS', 540, 112);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(`${d?.strikerName || 'Striker'} *`, 540, 154);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(`${d?.strikerRuns ?? 48} (${d?.strikerBalls ?? 29})`, 960, 154);

        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'left';
        ctx.fillText(`${d?.nonStrikerName || 'Non-striker'}`, 540, 204);
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(`${d?.nonStrikerRuns ?? 34} (${d?.nonStrikerBalls ?? 22})`, 960, 204);

        // Bowler Box
        ctx.fillStyle = '#111d33';
        ctx.fillRect(520, 280, 464, 120);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeRect(520, 280, 464, 120);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('BOWLER', 540, 312);

        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(`${d?.bowlerName || 'Bowler'}`, 540, 356);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        const bOv = d?.bowlerOvers ?? 3;
        const bBl = d?.bowlerBalls ?? 2;
        const bWk = d?.bowlerWickets ?? 1;
        const bRn = d?.bowlerRuns ?? 26;
        ctx.fillText(`${bWk} - ${bRn} (${bOv}.${bBl})`, 960, 356);

        // Bottom Match Ticker
        ctx.fillStyle = '#060c18';
        ctx.fillRect(0, 430, 1024, 82);
        ctx.fillStyle = d?.recentEvent ? '#ffd23f' : '#38bdf8';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d?.recentEvent ? `★ ${d.recentEvent.toUpperCase()} ★` : `CRIC ARENA NIGHT MATCH · ${bowlTeam.toUpperCase()} VS ${batTeam.toUpperCase()}`, 512, 482);

        tex.needsUpdate = true;
      }
    }
  });

  // Procedural Crowd Sprites & Flashes
  const crowdFlashes = useMemo(() => {
    const flashes: [number, number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const r = 42 + Math.random() * 8;
      const y = 8 + Math.random() * 12;
      flashes.push([Math.sin(angle) * r, y, Math.cos(angle) * r]);
    }
    return flashes;
  }, []);

  // Multi-tier Grandstand Rings
  const standsData = useMemo(() => {
    return [
      { radius: 38, height: 6, y: 3, color: '#162238' },
      { radius: 44, height: 8, y: 8, color: '#1a2942' },
      { radius: 50, height: 10, y: 14, color: '#142035' },
    ];
  }, []);

  // 4 Floodlight Tower Coordinates (high corner positions)
  const floodlightPositions: [number, number, number][] = [
    [-34, 38, -34],
    [34, 38, -34],
    [-34, 38, 34],
    [34, 38, 34],
  ];

  return (
    <group>
      {/* 1. OUTFIELD (Circular Mowed Grass) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[36, 96]} />
        <meshStandardMaterial
          map={outfieldTexture}
          roughness={0.88}
          metalness={0.05}
        />
      </mesh>

      {/* 2. PITCH (20.12m x 3.05m turf rectangle centered along Z axis) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[3.05, 20.12]} />
        <meshStandardMaterial
          map={pitchTexture}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      {/* Pitch Crease Markings */}
      {/* Bowling creases (at z = -10.06 and +10.06, or scaled relative to stumps z = -4.9 and +4.9) */}
      {/* Here striker end is at z = -4.9, bowler end at z = 4.9 */}
      {[-4.9, 4.9].map((z, idx) => {
        const sign = z < 0 ? 1 : -1;
        return (
          <group key={z}>
            {/* Bowling Crease across stumps */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, z]}>
              <planeGeometry args={[2.64, 0.06]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Popping Crease (1.22m forward into pitch) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, z + sign * 1.22]}>
              <planeGeometry args={[3.2, 0.07]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Return Creases (1.32m left & right) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.32, 0.015, z + sign * 0.61]}>
              <planeGeometry args={[0.06, 1.6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.32, 0.015, z + sign * 0.61]}>
              <planeGeometry args={[0.06, 1.6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        );
      })}

      {/* 3. WICKETS & BAILS */}
      {/* Striker Wickets (at z = -4.9) */}
      <group position={[0, 0, -4.9]}>
        {[-0.11, 0, 0.11].map((x, i) => (
          <mesh
            key={x}
            ref={(el) => {
              if (el) strikerStumpRefs.current[i] = el;
            }}
            position={[x, 0.36, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.024, 0.024, 0.72, 12]} />
            <meshStandardMaterial color="#f0d59e" roughness={0.6} />
          </mesh>
        ))}
        {/* Striker Bails */}
        <mesh
          ref={(el) => {
            if (el) strikerBailRefs.current[0] = el;
          }}
          position={[-0.06, 0.74, 0]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.028, 0.035]} />
          <meshStandardMaterial color="#fae6b8" roughness={0.6} />
        </mesh>
        <mesh
          ref={(el) => {
            if (el) strikerBailRefs.current[1] = el;
          }}
          position={[0.06, 0.74, 0]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.028, 0.035]} />
          <meshStandardMaterial color="#fae6b8" roughness={0.6} />
        </mesh>
      </group>

      {/* Non-Striker Wickets (at z = 4.9) */}
      <group position={[0, 0, 4.9]}>
        {[-0.11, 0, 0.11].map((x) => (
          <mesh key={x} position={[x, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.024, 0.024, 0.72, 12]} />
            <meshStandardMaterial color="#f0d59e" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[-0.06, 0.74, 0]} castShadow>
          <boxGeometry args={[0.12, 0.028, 0.035]} />
          <meshStandardMaterial color="#fae6b8" roughness={0.6} />
        </mesh>
        <mesh position={[0.06, 0.74, 0]} castShadow>
          <boxGeometry args={[0.12, 0.028, 0.035]} />
          <meshStandardMaterial color="#fae6b8" roughness={0.6} />
        </mesh>
      </group>

      {/* 4. 3D BOUNDARY ROPE */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <torusGeometry args={[35.8, 0.1, 12, 128]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {/* 30-Yard Circle Inner Restriction Line */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[18.5, 0.03, 6, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </mesh>

      {/* 5. 360° PERIMETER LED ADVERTISING BOARDS */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[36.4, 36.4, 1.0, 96, 1, true]} />
        <meshBasicMaterial
          ref={ledAdRef}
          map={ledTexture}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 6. MULTI-LEVEL GRANDSTANDS (Realistic Bowl Architecture) */}
      {standsData.map((stand, idx) => (
        <group key={idx}>
          {/* Tier structure */}
          <mesh position={[0, stand.y, 0]}>
            <cylinderGeometry
              args={[stand.radius + 4, stand.radius, stand.height, 64, 1, true]}
            />
            <meshStandardMaterial
              color={stand.color}
              roughness={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Seating Rows / Crowd band */}
          <mesh position={[0, stand.y + stand.height * 0.1, 0]}>
            <cylinderGeometry
              args={[stand.radius + 3.8, stand.radius + 0.2, stand.height * 0.9, 64, 1, true]}
            />
            <meshStandardMaterial
              color={idx === 1 ? '#283c5e' : '#1e304f'}
              roughness={1}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* VIP Hospitality Glass Band (between Tier 1 and 2) */}
      <mesh position={[0, 6.2, 0]}>
        <cylinderGeometry args={[42.2, 42.0, 1.4, 64, 1, true]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0d2b45"
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 7. GRANDSTAND ROOF & SUPPORT CANOPY */}
      <mesh position={[0, 24, 0]}>
        <cylinderGeometry args={[56, 52, 2.5, 64, 1, true]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.4}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Roof cantilever trusses */}
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * 51, 23.5, Math.cos(a) * 51]}
            rotation={[0, a, 0.25]}
          >
            <boxGeometry args={[0.5, 0.5, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.6} />
          </mesh>
        );
      })}

      {/* 8. SPECTATOR CROWD FLASHES (Dynamic Camera Flash Effect) */}
      <group ref={flashGroupRef}>
        {crowdFlashes.map((pos, i) => (
          <sprite key={i} position={pos} scale={[1.8, 1.8, 1]}>
            <spriteMaterial
              color="#ffffff"
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        ))}
      </group>

      {/* 9. GIANT STADIUM SCOREBOARD / JUMBOTRON */}
      <group position={[0, 20, -48]} rotation={[0, 0, 0]}>
        {/* Frame Structure */}
        <mesh castShadow>
          <boxGeometry args={[21, 11, 1.5]} />
          <meshStandardMaterial color="#0b1329" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Support Steel Columns */}
        <mesh position={[-9, -8, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 16, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.7} />
        </mesh>
        <mesh position={[9, -8, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 16, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.7} />
        </mesh>
        {/* LED Screen Plane */}
        <mesh position={[0, 0, 0.8]}>
          <planeGeometry args={[19.8, 9.8]} />
          <meshBasicMaterial map={scoreboardTexture} />
        </mesh>
      </group>

      {/* 10. SIGHT SCREENS */}
      {/* High white sight screen at bowler end (z = 35) */}
      <group position={[0, 3.5, 34.5]}>
        <mesh>
          <boxGeometry args={[8, 5, 0.3]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[-3.5, -2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 4, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[3.5, -2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 4, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>

      {/* 11. PLAYER DUGOUTS (Near Boundary) */}
      <group position={[-28, 1.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        {/* Dugout Canopy */}
        <mesh>
          <cylinderGeometry args={[3, 3, 7, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial
            color="#1e3a8a"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Dugout Bench */}
        <mesh position={[0, -0.6, 0]}>
          <boxGeometry args={[1.2, 0.4, 6.2]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>

      {/* 12. 4 FLOODLIGHT TOWERS & FLARE GLOW */}
      {floodlightPositions.map((pos, idx) => (
        <group key={idx} position={pos}>
          {/* Steel Lattice Pylon */}
          <mesh position={[0, -18, 0]}>
            <cylinderGeometry args={[0.7, 1.8, 36, 6]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Crossbars / Gantry */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[7, 4.5, 1.2]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </mesh>
          {/* Floodlight Lamps Panel (Emissive glow) */}
          <mesh position={[0, 0, 0.6]}>
            <planeGeometry args={[6.4, 3.8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Atmospheric Light Bloom Sprite */}
          <sprite scale={[26, 26, 1]} position={[0, 0, 1.5]}>
            <spriteMaterial
              color="#fff4cc"
              transparent
              opacity={0.35}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        </group>
      ))}

      {/* 13. STADIUM NIGHT DOME / ATMOSPHERE */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[120, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#080e1e" side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
export default Stadium;
