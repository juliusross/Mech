import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { classOf } from "../shared/arena.js";
import { DEFAULT_PAINT } from "../shared/planets.js";
import { RoundedGeometry } from "./RoundedPart.jsx";
import { armorMaps } from "./world/armorMaps.js";

// Procedural Titans. Every class has its own body; they share one gait system
// that reads walk speed from how far the mech actually moved, so remote pilots
// animate too.
const tmp = new THREE.Vector3();

function Part({ size, position, rotation, color, metal = 0.65, rough = 0.42, emissive, glow = 0 }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <RoundedGeometry size={size} />
      <meshStandardMaterial
        color={color}
        {...armorMaps()}
        metalness={metal}
        roughness={rough}
        emissive={emissive || "#000000"}
        emissiveIntensity={glow}
      />
    </mesh>
  );
}
function Joint({ r = 0.3, position, color }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[r, 12, 10]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} />
    </mesh>
  );
}
function Cyl({ args, position, rotation, color, metal = 0.85, rough = 0.3, glow, emissive }) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={args} />
      <meshStandardMaterial
        color={color}
        metalness={metal}
        roughness={rough}
        emissive={emissive || "#000000"}
        emissiveIntensity={glow || 0}
      />
    </mesh>
  );
}
function Thrusters({ flame, xs, y, z }) {
  return (
    <>
      {xs.map((x) => (
        <Cyl key={x} args={[0.2, 0.26, 0.5, 12]} position={[x, y + 0.3, z]} color="#2c3642" />
      ))}
      <group ref={flame} position={[0, y, z]}>
        {xs.map((x) => (
          <mesh key={x} position={[x, -0.3, 0]}>
            <coneGeometry args={[0.2, 0.9, 10]} />
            <meshBasicMaterial color="#7fd8ff" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Shared gait: returns refs updated every frame. */
function useGait(root, { idle, down, flame, thrust }) {
  const g = useRef({ phase: 0, stride: 0, airborne: false, last: null });
  useFrame((_, dt) => {
    if (!root.current) return;
    root.current.getWorldPosition(tmp);
    const s = g.current;
    let speed = 0;
    if (s.last && dt > 0) speed = Math.hypot(tmp.x - s.last.x, tmp.z - s.last.z) / dt;
    s.last = tmp.clone();
    s.airborne = tmp.y > 0.15;
    const target = down || s.airborne || idle ? 0 : Math.min(1, speed / 8);
    s.stride += (target - s.stride) * Math.min(1, dt * 8);
    s.phase += dt * (4 + speed * 0.55);
    if (flame.current) flame.current.scale.set(1, thrust ? 1 + Math.random() * 0.35 : 0.001, 1);
  });
  return g;
}

/* ---------------- Assault: balanced humanoid ---------------- */
function AssaultBody({ c, pitch, idle, down, thrust }) {
  const root = useRef(), body = useRef(), torso = useRef(), flame = useRef();
  const legs = [useRef(), useRef()], shins = [useRef(), useRef()];
  const gait = useGait(root, { idle, down, flame, thrust });
  useFrame((_, dt) => {
    const { phase, stride: a, airborne } = gait.current;
    const sw = Math.sin(phase);
    legs.forEach((l, i) => l.current && (l.current.rotation.x = (i ? -sw : sw) * 0.55 * a + (airborne ? (i ? 0.2 : -0.25) : 0)));
    shins.forEach((l, i) => l.current && (l.current.rotation.x = Math.max(0, i ? sw : -sw) * 0.8 * a + (airborne ? 0.45 : 0)));
    if (body.current) body.current.position.y = 2.55 + Math.abs(sw) * 0.09 * a;
    if (torso.current) {
      torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, pitch * 0.6, Math.min(1, dt * 10));
      torso.current.rotation.y = -sw * 0.06 * a;
    }
  });
  return (
    <group ref={root}>
      <group ref={body} position={[0, 2.55, 0]}>
        <Part size={[1.45, 0.5, 0.9]} color={c.dark} />
        <Part size={[0.9, 0.42, 0.2]} position={[0, -0.05, -0.5]} color={c.primary} />
        {[-1, 1].map((side, i) => (
          <group key={side} ref={legs[i]} position={[side * 0.62, 0, 0]}>
            <Joint r={0.36} color={c.dark} />
            <Part size={[0.58, 1.15, 0.7]} position={[0, -0.62, 0]} color={c.secondary} />
            <Part size={[0.62, 0.7, 0.18]} position={[0, -0.55, -0.4]} color={c.primary} />
            <group ref={shins[i]} position={[0, -1.22, 0]}>
              <Joint color={c.dark} />
              <Part size={[0.5, 1.15, 0.62]} position={[0, -0.6, 0.04]} color={c.secondary} />
              <Part size={[0.56, 0.95, 0.16]} position={[0, -0.5, -0.36]} rotation={[0.08, 0, 0]} color={c.primary} />
              <Cyl args={[0.07, 0.07, 0.9, 8]} position={[0, -0.55, 0.38]} color="#c9d2da" />
              <Part size={[0.78, 0.26, 1.3]} position={[0, -1.22, -0.18]} color={c.dark} />
            </group>
          </group>
        ))}
        <group ref={torso} position={[0, 0.35, 0]}>
          <Part size={[1.9, 1.35, 1.25]} position={[0, 0.85, 0]} color={c.secondary} />
          <Part size={[0.95, 1.1, 0.25]} position={[-0.47, 0.95, -0.66]} rotation={[0.12, 0.25, 0]} color={c.primary} />
          <Part size={[0.95, 1.1, 0.25]} position={[0.47, 0.95, -0.66]} rotation={[0.12, -0.25, 0]} color={c.primary} />
          <Part size={[0.7, 0.16, 0.1]} position={[0, 1.18, -0.86]} color={c.visor} emissive={c.visor} glow={c.glow} />
          <Part size={[0.85, 0.55, 0.8]} position={[0, 1.95, -0.05]} color={c.secondary} />
          <Part size={[0.9, 0.18, 0.12]} position={[0, 1.98, -0.48]} color={c.visor} emissive={c.visor} glow={c.glow * 1.2} />
          <Cyl args={[0.025, 0.025, 0.7, 6]} position={[0.3, 2.45, 0.15]} color="#9aa5b1" />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 1.32, 1.3, 0]}>
              <Part size={[0.95, 0.55, 1.15]} rotation={[0, 0, s * -0.22]} color={c.primary} />
              <Part size={[0.55, 1.0, 0.6]} position={[s * 0.05, -0.75, 0]} color={c.secondary} />
            </group>
          ))}
          <Part size={[0.25, 1.3, 1.05]} position={[-1.55, 0.25, -0.15]} color={c.primary} />
          <group position={[1.4, 0.35, -0.25]}>
            <Part size={[0.6, 0.6, 1.0]} color={c.dark} />
            <Cyl args={[0.2, 0.26, 1.6, 14]} position={[0, 0, -1.05]} rotation={[Math.PI / 2, 0, 0]} color="#1a222c" />
            <mesh position={[0, 0, -1.9]}>
              <torusGeometry args={[0.22, 0.05, 6, 18]} />
              <meshStandardMaterial color={c.visor} emissive={c.visor} emissiveIntensity={c.glow} />
            </mesh>
          </group>
          <Part size={[1.3, 1.1, 0.55]} position={[0, 0.95, 0.85]} color={c.dark} />
          <Thrusters flame={flame} xs={[-0.38, 0.38]} y={0.15} z={1.05} />
        </group>
      </group>
    </group>
  );
}

/* ---------------- Scout: light, reverse-jointed runner ---------------- */
function ScoutBody({ c, pitch, idle, down, thrust }) {
  const root = useRef(), body = useRef(), torso = useRef(), flame = useRef();
  const legs = [useRef(), useRef()], shins = [useRef(), useRef()], feet = [useRef(), useRef()];
  const gait = useGait(root, { idle, down, flame, thrust });
  useFrame((_, dt) => {
    const { phase, stride: a, airborne } = gait.current;
    const sw = Math.sin(phase * 1.15);
    legs.forEach((l, i) => l.current && (l.current.rotation.x = -0.55 + (i ? -sw : sw) * 0.5 * a + (airborne ? -0.3 : 0)));
    shins.forEach((l, i) => l.current && (l.current.rotation.x = 1.15 + Math.max(0, i ? sw : -sw) * 0.5 * a + (airborne ? 0.3 : 0)));
    feet.forEach((l, i) => l.current && (l.current.rotation.x = -0.6 + (i ? sw : -sw) * 0.2 * a));
    if (body.current) {
      body.current.position.y = 3.0 + Math.abs(sw) * 0.12 * a;
      body.current.rotation.x = 0.12 * a;
    }
    if (torso.current) torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, pitch * 0.6, Math.min(1, dt * 10));
  });
  return (
    <group ref={root}>
      <group ref={body} position={[0, 3.0, 0]}>
        {[-1, 1].map((side, i) => (
          <group key={side} ref={legs[i]} position={[side * 0.55, 0, 0]}>
            <Joint r={0.28} color={c.dark} />
            {/* thigh angles forward, shin back: a bird-like stance */}
            <Part size={[0.32, 1.25, 0.42]} position={[0, -0.62, 0]} color={c.primary} />
            <group ref={shins[i]} position={[0, -1.25, 0]}>
              <Joint r={0.22} color={c.dark} />
              <Part size={[0.26, 1.4, 0.32]} position={[0, -0.7, 0]} color={c.secondary} />
              <Cyl args={[0.05, 0.05, 1.1, 6]} position={[0, -0.6, -0.25]} color="#c9d2da" />
              <group ref={feet[i]} position={[0, -1.4, 0]}>
                <Joint r={0.17} color={c.dark} />
                <Part size={[0.22, 0.75, 0.24]} position={[0, -0.37, 0]} color={c.dark} />
                <Part size={[0.55, 0.12, 0.8]} position={[0, -0.75, -0.25]} color={c.dark} />
              </group>
            </group>
          </group>
        ))}
        <group ref={torso} position={[0, 0.25, 0]}>
          {/* teardrop hull with a glass canopy */}
          <Part size={[1.25, 0.9, 1.9]} position={[0, 0.55, 0.05]} color={c.secondary} />
          <Part size={[1.05, 0.5, 1.1]} position={[0, 0.25, -0.85]} rotation={[0.35, 0, 0]} color={c.primary} />
          <mesh position={[0, 1.05, -0.35]} scale={[0.55, 0.38, 0.75]} castShadow>
            <sphereGeometry args={[1, 18, 12]} />
            <meshStandardMaterial color={c.visor} emissive={c.visor} emissiveIntensity={c.glow * 0.35} metalness={0.2} roughness={0.08} transparent opacity={0.8} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <Part size={[0.08, 0.7, 0.9]} position={[s * 0.55, 1.2, 0.75]} rotation={[-0.5, 0, s * 0.35]} color={c.primary} />
              <group position={[s * 0.72, 0.15, -0.6]}>
                <Part size={[0.25, 0.25, 0.7]} color={c.dark} />
                <Cyl args={[0.07, 0.08, 1.0, 8]} position={[0, 0, -0.75]} rotation={[Math.PI / 2, 0, 0]} color="#1a222c" />
              </group>
            </group>
          ))}
          <Cyl args={[0.02, 0.02, 1.0, 6]} position={[-0.3, 1.5, 0.55]} rotation={[-0.4, 0, 0]} color="#9aa5b1" />
          <Cyl args={[0.02, 0.02, 0.8, 6]} position={[0.3, 1.45, 0.6]} rotation={[-0.5, 0, 0]} color="#9aa5b1" />
          <Thrusters flame={flame} xs={[0]} y={0.3} z={1.05} />
        </group>
      </group>
    </group>
  );
}

/* ---------------- Heavy: hulking siege frame ---------------- */
function HeavyBody({ c, pitch, idle, down, thrust }) {
  const root = useRef(), body = useRef(), torso = useRef(), flame = useRef();
  const legs = [useRef(), useRef()], shins = [useRef(), useRef()];
  const gait = useGait(root, { idle, down, flame, thrust });
  useFrame((_, dt) => {
    const { phase, stride: a, airborne } = gait.current;
    const sw = Math.sin(phase * 0.75);
    legs.forEach((l, i) => l.current && (l.current.rotation.x = (i ? -sw : sw) * 0.35 * a + (airborne ? -0.15 : 0)));
    shins.forEach((l, i) => l.current && (l.current.rotation.x = Math.max(0, i ? sw : -sw) * 0.5 * a));
    if (body.current) {
      body.current.position.y = 2.3 + Math.abs(sw) * 0.06 * a;
      body.current.rotation.z = sw * 0.04 * a;
    }
    if (torso.current) torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, pitch * 0.5, Math.min(1, dt * 8));
  });
  return (
    <group ref={root}>
      <group ref={body} position={[0, 2.3, 0]}>
        <Part size={[2.0, 0.6, 1.2]} color={c.dark} />
        {/* armoured skirt */}
        {[-1, 1].map((s) => (
          <Part key={s} size={[0.9, 0.7, 0.2]} position={[s * 0.55, -0.25, -0.65]} rotation={[0.2, 0, 0]} color={c.primary} />
        ))}
        {[-1, 1].map((side, i) => (
          <group key={side} ref={legs[i]} position={[side * 0.95, 0, 0]}>
            <Joint r={0.48} color={c.dark} />
            <Part size={[0.9, 1.05, 0.95]} position={[0, -0.55, 0]} color={c.secondary} />
            <Part size={[0.95, 0.8, 0.25]} position={[0, -0.5, -0.55]} color={c.primary} />
            <group ref={shins[i]} position={[0, -1.1, 0]}>
              <Joint r={0.4} color={c.dark} />
              <Part size={[0.85, 0.95, 0.9]} position={[0, -0.5, 0]} color={c.secondary} />
              <Cyl args={[0.11, 0.11, 0.9, 8]} position={[0.3, -0.5, 0.5]} color="#c9d2da" />
              <Cyl args={[0.11, 0.11, 0.9, 8]} position={[-0.3, -0.5, 0.5]} color="#c9d2da" />
              <Part size={[1.25, 0.3, 1.7]} position={[0, -1.05, -0.15]} color={c.dark} />
            </group>
          </group>
        ))}
        <group ref={torso} position={[0, 0.35, 0]}>
          <Part size={[2.7, 1.7, 1.7]} position={[0, 1.0, 0]} color={c.secondary} />
          <Part size={[2.3, 1.3, 0.35]} position={[0, 1.05, -0.95]} rotation={[0.1, 0, 0]} color={c.primary} />
          {/* sensor slit instead of a head */}
          <Part size={[1.4, 0.16, 0.1]} position={[0, 1.55, -1.14]} color={c.visor} emissive={c.visor} glow={c.glow} />
          <Part size={[1.0, 0.45, 0.9]} position={[0, 2.05, 0.1]} color={c.dark} />
          {/* shoulder missile pods */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 1.75, 2.0, 0.1]}>
              <Part size={[1.0, 0.8, 1.3]} color={c.primary} />
              {[-0.25, 0.25].map((x) =>
                [-0.18, 0.18].map((y) => (
                  <Cyl key={`${x}${y}`} args={[0.11, 0.11, 0.05, 10]} position={[x, y, -0.66]} rotation={[Math.PI / 2, 0, 0]} color="#111" />
                )),
              )}
            </group>
          ))}
          {/* twin arm cannons */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 1.75, 0.6, -0.2]}>
              <Part size={[0.85, 0.85, 1.3]} color={c.dark} />
              <Cyl args={[0.36, 0.44, 1.9, 14]} position={[0, 0, -1.4]} rotation={[Math.PI / 2, 0, 0]} color="#1a222c" />
              <mesh position={[0, 0, -2.35]}>
                <torusGeometry args={[0.38, 0.06, 6, 18]} />
                <meshStandardMaterial color={c.visor} emissive={c.visor} emissiveIntensity={c.glow} />
              </mesh>
            </group>
          ))}
          {/* exhaust stacks */}
          {[-0.5, 0.5].map((x) => (
            <Cyl key={x} args={[0.16, 0.18, 1.0, 10]} position={[x, 2.2, 0.75]} color="#2c3642" />
          ))}
          <Thrusters flame={flame} xs={[-0.6, 0.6]} y={0.2} z={0.95} />
        </group>
      </group>
    </group>
  );
}

/* ---------------- Support: four-legged field medic ---------------- */
const QUAD = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
function SupportBody({ c, pitch, idle, down, thrust }) {
  const root = useRef(), body = useRef(), torso = useRef(), flame = useRef(), dish = useRef();
  const uppers = QUAD.map(() => useRef());
  const gait = useGait(root, { idle, down, flame, thrust });
  useFrame((_, dt) => {
    const { phase, stride: a } = gait.current;
    // Diagonal pairs step together.
    uppers.forEach((u, i) => {
      const pair = i === 0 || i === 3 ? 0 : Math.PI;
      if (u.current) u.current.rotation.z = -QUAD[i][0] * (0.35 - Math.max(0, Math.sin(phase + pair)) * 0.3 * a);
      if (u.current) u.current.rotation.x = Math.cos(phase + pair) * 0.3 * a;
    });
    if (body.current) body.current.position.y = 2.2 + Math.sin(phase * 2) * 0.05 * a;
    if (dish.current) dish.current.rotation.y += dt * 1.6;
    if (torso.current) torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, pitch * 0.5, Math.min(1, dt * 8));
  });
  return (
    <group ref={root}>
      <group ref={body} position={[0, 2.2, 0]}>
        <Part size={[1.9, 0.55, 2.0]} color={c.dark} />
        {QUAD.map(([sx, sz], i) => (
          <group key={i} position={[sx * 0.85, 0, sz * 0.8]}>
            <group ref={uppers[i]}>
              <Joint r={0.28} color={c.dark} />
              <Part size={[1.25, 0.32, 0.36]} position={[sx * 0.62, 0, 0]} color={c.primary} />
              <group position={[sx * 1.25, 0, 0]} rotation={[0, 0, sx * 0.35]}>
                <Joint r={0.22} color={c.dark} />
                <Part size={[0.28, 1.6, 0.3]} position={[0, -0.8, 0]} color={c.secondary} />
                <Part size={[0.5, 0.18, 0.5]} position={[0, -1.62, 0]} color={c.dark} />
              </group>
            </group>
          </group>
        ))}
        <group ref={torso} position={[0, 0.3, 0]}>
          <mesh position={[0, 0.65, 0]} scale={[1.15, 0.75, 1.3]} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial color={c.secondary} metalness={0.55} roughness={0.4} />
          </mesh>
          <Part size={[1.0, 0.25, 0.12]} position={[0, 0.85, -1.27]} color={c.visor} emissive={c.visor} glow={c.glow} />
          {/* medical cross */}
          <Part size={[0.7, 0.2, 0.06]} position={[0, 1.2, 1.12]} rotation={[0.5, 0, 0]} color="#5dff9a" emissive="#1fbf5a" glow={c.glow * 0.8} />
          <Part size={[0.2, 0.7, 0.06]} position={[0, 1.2, 1.12]} rotation={[0.5, 0, 0]} color="#5dff9a" emissive="#1fbf5a" glow={c.glow * 0.8} />
          {/* radar dish */}
          <group ref={dish} position={[0, 1.45, 0.2]}>
            <Cyl args={[0.08, 0.08, 0.5, 8]} position={[0, -0.1, 0]} color="#9aa5b1" />
            <mesh position={[0, 0.25, 0]} rotation={[0.6, 0, 0]}>
              <cylinderGeometry args={[0.6, 0.15, 0.2, 18, 1, true]} />
              <meshStandardMaterial color={c.primary} metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
            </mesh>
          </group>
          {/* repair arms */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 1.0, 0.35, -0.9]} rotation={[0.3, s * -0.3, 0]}>
              <Part size={[0.22, 0.22, 0.9]} color={c.primary} />
              <Cyl args={[0.14, 0.1, 0.25, 10]} position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]} color="#5dff9a" emissive="#1fbf5a" glow={c.glow} />
            </group>
          ))}
          {/* light cannon */}
          <Cyl args={[0.16, 0.2, 1.3, 12]} position={[0.55, 0.2, -1.4]} rotation={[Math.PI / 2, 0, 0]} color="#1a222c" />
          <Thrusters flame={flame} xs={[-0.4, 0.4]} y={0.2} z={1.2} />
        </group>
      </group>
    </group>
  );
}

const BODIES = { assault: AssaultBody, scout: ScoutBody, heavy: HeavyBody, support: SupportBody };

function SpecialWeapon({ type }) {
  if (!type) return null;
  return <group position={[1.65, 3.3, -1.45]}>
    {type === "sword" ? <>
      <Cyl args={[0.16, 0.18, 0.85, 10]} position={[0, -0.35, 0]} color="#30323e" />
      <mesh position={[0, 1.25, 0]}>
        <RoundedGeometry size={[0.25, 3.1, 0.1]} radius={0.08} />
        <meshStandardMaterial color="#decaff" emissive="#a063ff" emissiveIntensity={3} />
      </mesh>
    </> : type === "shotgun" ? [-0.2, 0, 0.2].map((x) => (
      <Cyl key={x} args={[0.13, 0.16, 2, 10]} position={[x, 0, -1.3]} rotation={[Math.PI / 2, 0, 0]} color="#414e53" />
    )) : <>
      <Cyl args={[type === "cannon" ? 0.42 : 0.22, type === "cannon" ? 0.5 : 0.28, 2.6, 12]} position={[0, 0, -1.6]} rotation={[Math.PI / 2, 0, 0]} color="#35464f" />
      <mesh position={[0, 0, -3]}>
        <torusGeometry args={[type === "cannon" ? 0.38 : 0.21, 0.07, 8, 20]} />
        <meshStandardMaterial color={type === "laser" ? "#7cf3ff" : "#ff8a54"} emissive={type === "laser" ? "#24c8ed" : "#ed4b22"} emissiveIntensity={2} />
      </mesh>
    </>}
  </group>;
}

export function Mech({ paint = DEFAULT_PAINT, cls, down = false, fused = false, pitch = 0, thrust = false, idle = false, weapon = null }) {
  const spec = classOf(cls);
  const colors = useMemo(() => {
    const base = down ? { primary: "#3a3f47", secondary: "#2b3038", visor: "#40464f" } : paint;
    return { ...base, dark: down ? "#22262c" : "#1d2733", glow: down ? 0 : 1.8 };
  }, [paint, down]);
  const Body = BODIES[cls] || AssaultBody;
  return (
    <group scale={spec.scale * (fused ? 1.8 : 1)} rotation={[down ? -0.5 : 0, 0, 0]}>
      <Body c={colors} pitch={pitch} idle={idle} down={down} thrust={thrust} />
      <SpecialWeapon type={weapon} />
    </group>
  );
}
