import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { planetOf, STRIKE_RADIUS } from "../shared/planets.js";

// Deterministic scatter so every pilot sees the same scenery.
function scatter(seed, count) {
  let x = seed;
  const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const out = [];
  while (out.length < count) {
    const p = [(rand() - 0.5) * 140, (rand() - 0.5) * 160 - 10];
    // Keep the spawn area and the target field clear.
    const inField = Math.abs(p[0]) < 20 && p[1] < 12 && p[1] > -45;
    const inSpawn = Math.abs(p[0]) < 14 && p[1] > 0 && p[1] < 20;
    if (!inField && !inSpawn) out.push({ x: p[0], z: p[1], s: 0.6 + rand() * 1.4, r: rand() * Math.PI });
  }
  return out;
}

function Lava({ zone }) {
  const mat = useRef();
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 2 + zone.x) * 0.4;
  });
  return (
    <group position={[zone.x, 0.02, zone.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[zone.r, 40]} />
        <meshStandardMaterial ref={mat} color="#ff5a1a" emissive="#ff3a00" emissiveIntensity={1.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[zone.r, zone.r + 0.8, 40]} />
        <meshStandardMaterial color="#1a0d08" roughness={1} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#ff6a2a" intensity={12} distance={zone.r * 3} />
    </group>
  );
}

function StrikeZone({ strike }) {
  const ring = useRef();
  useFrame(({ clock }) => {
    if (ring.current) ring.current.material.opacity = 0.35 + Math.sin(clock.elapsedTime * 18) * 0.25;
  });
  return (
    <group position={[strike.p[0], 0.05, strike.p[2]]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[STRIKE_RADIUS, 36]} />
        <meshBasicMaterial color="#9fc3ff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Scenery({ planet, P }) {
  const items = useMemo(() => scatter(planet.length * 977 + 13, 28), [planet]);
  return items.map((it, i) => {
    const key = `${planet}-${i}`;
    if (planet === "verdant")
      return (
        <group key={key} position={[it.x, 0, it.z]} scale={it.s}>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.6, 6, 8]} />
            <meshStandardMaterial color="#3d2c1e" roughness={0.9} />
          </mesh>
          <mesh position={[0, 7, 0]} castShadow>
            <coneGeometry args={[3, 6, 9]} />
            <meshStandardMaterial color="#2f6b3a" roughness={0.85} />
          </mesh>
        </group>
      );
    if (planet === "cryo")
      return (
        <mesh key={key} position={[it.x, 2.5 * it.s, it.z]} rotation={[0.2, it.r, 0.15]} scale={it.s} castShadow>
          <octahedronGeometry args={[2.6, 0]} />
          <meshStandardMaterial color="#bfe6ff" metalness={0.1} roughness={0.08} transparent opacity={0.85} />
        </mesh>
      );
    if (planet === "selene")
      return (
        <mesh key={key} position={[it.x, 0.03, it.z]} rotation={[-Math.PI / 2, 0, 0]} scale={it.s}>
          <ringGeometry args={[2.2, 3.2, 28]} />
          <meshStandardMaterial color="#5f626b" roughness={1} />
        </mesh>
      );
    // Rocks and ruined pillars for the remaining worlds.
    return (
      <mesh key={key} position={[it.x, 2 * it.s, it.z]} rotation={[0, it.r, 0]} scale={it.s} castShadow receiveShadow>
        {i % 3 ? <dodecahedronGeometry args={[2.2, 0]} /> : <boxGeometry args={[2.5, 6, 2.5]} />}
        <meshStandardMaterial color={P.rock} roughness={0.85} metalness={0.1} />
      </mesh>
    );
  });
}

export function PlanetScene({ planet, strikes = [] }) {
  const P = planetOf(planet);
  return (
    <>
      <color attach="background" args={[P.sky]} />
      <fog attach="fog" args={[P.sky, ...P.fog]} />
      <hemisphereLight args={[P.sun, P.ground, P.ambient * 0.9]} />
      <ambientLight intensity={P.ambient * 0.35} />
      <directionalLight
        position={[25, 40, 18]}
        intensity={2.4}
        color={P.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-90}
        shadow-camera-far={140}
      />
      {planet === "selene" && <Stars radius={180} depth={40} count={2500} factor={5} fade />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -10]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial
          color={P.ground}
          roughness={planet === "cryo" ? 0.15 : 0.92}
          metalness={planet === "cryo" ? 0.2 : 0.05}
        />
      </mesh>
      <gridHelper args={[150, 50, P.grid[0], P.grid[1]]} position={[0, 0.01, -10]} />
      <Scenery planet={planet} P={P} />
      {(P.lava || []).map((z, i) => (
        <Lava key={i} zone={z} />
      ))}
      {strikes.map((st) => (
        <StrikeZone key={st.id} strike={st} />
      ))}
    </>
  );
}
