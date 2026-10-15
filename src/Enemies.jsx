import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { Drone } from "./Combat.jsx";
import { Mech } from "./Mech.jsx";
import { RoundedGeometry } from "./RoundedPart.jsx";
import { ENEMY_TYPES } from "../shared/enemies.js";
import { DamageSmoke } from "./DamageEffects.jsx";

const ENEMY_PAINT = { primary: "#6e1f24", secondary: "#24272d", visor: "#ff3b3b" };
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

// Smoothly follows snapshot position and heading; exposes the aim angle.
function Mover({ e, rate = 10, children }) {
  const g = useRef();
  const first = useRef(e.p);
  useFrame((_, dt) => {
    if (!g.current) return;
    const k = 1 - Math.exp(-rate * dt);
    g.current.position.lerp(new THREE.Vector3(...e.p), k);
    g.current.rotation.y = turn(g.current.rotation.y, e.h, k);
  });
  return (
    <group ref={g} position={first.current}>
      {children}
    </group>
  );
}

function Box({ size, position, color, rotation, metal = 0.5, rough = 0.55, glow }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <RoundedGeometry size={size} radius={0.1} />
      <meshStandardMaterial
        color={color}
        metalness={metal}
        roughness={rough}
        emissive={glow || "#000000"}
        emissiveIntensity={glow ? 1.6 : 0}
      />
    </mesh>
  );
}

function Tank({ e }) {
  const turret = useRef();
  const treads = useRef([]);
  useFrame((_, dt) => {
    // Turret tracks the target independently of the hull.
    const hull = turret.current?.parent?.rotation.y ?? 0;
    if (turret.current) turret.current.rotation.y = turn(turret.current.rotation.y, e.a - hull, 1 - Math.exp(-6 * dt));
  });
  const camo = "#4d5a3a";
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.55, 0.55, 0]}>
          <Box size={[0.75, 1.1, 5]} color="#1e2226" metal={0.3} rough={0.9} />
          {[-1.8, -0.6, 0.6, 1.8].map((z) => (
            <mesh key={z} position={[s * 0.4, -0.05, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.1, 14]} />
              <meshStandardMaterial color="#3a3f45" metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      <Box size={[2.6, 0.9, 4.6]} position={[0, 1.15, 0]} color={camo} />
      <Box size={[2.2, 0.4, 1.2]} position={[0, 1.5, -1.9]} rotation={[-0.4, 0, 0]} color={camo} />
      <group ref={turret} position={[0, 1.85, 0.2]}>
        <Box size={[1.9, 0.75, 2.2]} color="#55633f" />
        <Box size={[0.6, 0.3, 0.6]} position={[0.5, 0.5, 0.3]} color="#2c3326" />
        <mesh position={[0, 0.05, -2.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 3, 12]} />
          <meshStandardMaterial color="#2a2f24" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function Buggy({ e }) {
  const wheels = useRef([]);
  const gun = useRef();
  useFrame((_, dt) => {
    for (const w of wheels.current) if (w) w.rotation.x -= dt * 14;
    const hull = gun.current?.parent?.rotation.y ?? 0;
    if (gun.current) gun.current.rotation.y = turn(gun.current.rotation.y, e.a - hull, 1 - Math.exp(-8 * dt));
  });
  return (
    <group>
      <Box size={[1.9, 0.5, 3.2]} position={[0, 0.85, 0]} color="#8a6d3b" />
      <Box size={[1.7, 0.45, 1.2]} position={[0, 1.3, 0.3]} color="#5b4a2c" />
      {/* roll cage */}
      {[-0.8, 0.8].map((x) => (
        <Box key={x} size={[0.1, 0.9, 0.1]} position={[x, 1.75, -0.2]} color="#2b2b2b" metal={0.8} />
      ))}
      <Box size={[1.7, 0.1, 0.1]} position={[0, 2.2, -0.2]} color="#2b2b2b" metal={0.8} />
      {[
        [-1.05, -1.1],
        [1.05, -1.1],
        [-1.05, 1.1],
        [1.05, 1.1],
      ].map(([x, z], i) => (
        <mesh key={i} ref={(m) => (wheels.current[i] = m)} position={[x, 0.5, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.4, 14]} />
          <meshStandardMaterial color="#1b1b1b" roughness={0.95} />
        </mesh>
      ))}
      <group ref={gun} position={[0, 1.9, 0.6]}>
        <Box size={[0.35, 0.35, 0.6]} color="#2e3236" metal={0.8} />
        <mesh position={[0, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.2, 8]} />
          <meshStandardMaterial color="#1a1c1f" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function Soldier({ e }) {
  const legs = useRef([]);
  const phase = useRef(Math.random() * 6);
  useFrame((_, dt) => {
    phase.current += dt * 9;
    const s = Math.sin(phase.current) * 0.6;
    if (legs.current[0]) legs.current[0].rotation.x = s;
    if (legs.current[1]) legs.current[1].rotation.x = -s;
  });
  const uniform = "#4f5b3c";
  return (
    <group>
      {[-0.12, 0.12].map((x, i) => (
        <group key={x} ref={(g) => (legs.current[i] = g)} position={[x, 0.75, 0]}>
          <Box size={[0.17, 0.75, 0.2]} position={[0, -0.37, 0]} color={uniform} metal={0} rough={0.9} />
        </group>
      ))}
      <Box size={[0.48, 0.6, 0.3]} position={[0, 1.05, 0]} color={uniform} metal={0} rough={0.9} />
      <Box size={[0.3, 0.38, 0.22]} position={[0, 1.05, 0.22]} color="#3b3f2f" metal={0} rough={0.9} />
      <mesh position={[0, 1.52, 0]} castShadow>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial color="#c99a72" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3d4630" roughness={0.8} />
      </mesh>
      <Box size={[0.08, 0.08, 0.75]} position={[0.2, 1.1, -0.3]} color="#1b1b1b" metal={0.8} />
    </group>
  );
}

export function Enemy({ e }) {
  if (e.t === "drone") return <Drone drone={e} />;
  const T = ENEMY_TYPES[e.t];
  return (
    <Mover e={e} rate={e.t === "vehicle" ? 14 : 9}>
      {e.t === "tank" && <Tank e={e} />}
      {e.t === "vehicle" && <Buggy e={e} />}
      {e.t === "soldier" && <Soldier e={e} />}
      {e.t === "mech" && (
        <group scale={0.95}>
          <Mech cls="assault" paint={ENEMY_PAINT} />
        </group>
      )}
      {e.t !== "soldier" && e.hp / T.hp <= 0.5 && (
        <DamageSmoke severity={1 - e.hp / T.hp} position={[0, T.center * 1.7 + 0.5, 0]} />
      )}
      {e.hp < T.hp && (
        // Damage indicator: a thin bar above the enemy.
        <Billboard position={[0, T.center * 2 + (e.t === "soldier" ? 0.4 : 1.6), 0]}>
          <mesh>
            <planeGeometry args={[1.6, 0.14]} />
            <meshBasicMaterial color="#300" depthWrite={false} />
          </mesh>
          <mesh position={[-0.8 + (0.8 * e.hp) / T.hp, 0, 0.01]}>
            <planeGeometry args={[(1.6 * e.hp) / T.hp, 0.14]} />
            <meshBasicMaterial color="#ff5a4a" depthWrite={false} />
          </mesh>
        </Billboard>
      )}
    </Mover>
  );
}

const BOLT_LOOK = {
  plasma: { r: 0.32, color: "#ff4a6a" },
  bullet: { r: 0.12, color: "#ffe27a" },
  shell: { r: 0.4, color: "#ff9a3c" },
};
export function EnemyBolt({ bolt }) {
  const g = useRef();
  const first = useRef(bolt.p);
  useFrame((_, dt) => g.current?.position.lerp(new THREE.Vector3(...bolt.p), 1 - Math.exp(-30 * dt)));
  const look = BOLT_LOOK[bolt.k] || BOLT_LOOK.plasma;
  return (
    <mesh ref={g} position={first.current}>
      <sphereGeometry args={[look.r, 8, 8]} />
      <meshBasicMaterial color={look.color} />
    </mesh>
  );
}
