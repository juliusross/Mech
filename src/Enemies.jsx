import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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

function Box({ size, position, color, rotation, metal = 0.5, rough = 0.55, glow, shadow = true }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow={shadow}>
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

// Infantry: jointed legs (thigh, shin, boot), arms (upper arm, forearm,
// hand) holding a rifle, vest, belt, backpack with bedroll and a helmet.
// Each body part is pre-merged into one vertex-coloured mesh so a squad costs
// seven draw calls per soldier instead of ~30.
const SOLDIER = (() => {
  const C = { uniform: "#4f5b3c", gear: "#3b3f2f", skin: "#c99a72", boot: "#1f1c18", dark: "#1b1b1b", pack: "#55603f", roll: "#6d6650", helmet: "#3d4630", belt: "#2a2620" };
  const piece = (geo, pos, rot, color) => {
    const g = geo.toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1)));
    const c = new THREE.Color(color);
    const cols = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < cols.length; i += 3) cols.set([c.r, c.g, c.b], i);
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute("uv");
    return g;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const merge = (parts) => mergeGeometries(parts);
  const body = merge([
    piece(box(0.42, 0.5, 0.24), [0, 0.3, 0], null, C.uniform),
    piece(box(0.46, 0.32, 0.28), [0, 0.36, 0], null, C.gear),
    piece(box(0.44, 0.07, 0.27), [0, 0.06, 0], null, C.belt),
    piece(box(0.1, 0.1, 0.06), [-0.12, 0.12, -0.15], null, C.gear),
    piece(box(0.1, 0.1, 0.06), [0.12, 0.12, -0.15], null, C.gear),
    piece(box(0.32, 0.4, 0.18), [0, 0.34, 0.22], null, C.pack),
    piece(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8), [0, 0.59, 0.22], [0, 0, Math.PI / 2], C.roll),
    piece(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 6), [0, 0.66, 0], null, C.skin),
    piece(new THREE.SphereGeometry(0.12, 10, 8), [0, 0.78, 0], null, C.skin),
    piece(new THREE.SphereGeometry(0.145, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.83, 0], null, C.helmet),
    piece(box(0.2, 0.04, 0.04), [0, 0.79, -0.11], null, C.dark),
    piece(box(0.07, 0.11, 0.8), [0.06, 0.33, -0.42], null, C.dark),
    piece(box(0.05, 0.16, 0.08), [0.06, 0.24, -0.3], null, C.dark),
  ]);
  const thigh = merge([piece(box(0.16, 0.46, 0.18), [0, -0.22, 0], null, C.uniform)]);
  const shin = merge([
    piece(box(0.15, 0.42, 0.16), [0, -0.21, 0], null, C.uniform),
    piece(box(0.17, 0.11, 0.3), [0, -0.45, -0.05], null, C.boot),
  ]);
  // Arm in shoulder space: upper arm, then the forearm bent at the elbow, then the hand.
  const arm = (side) => {
    const elbow = new THREE.Matrix4().compose(new THREE.Vector3(0, -0.3, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.7, 0, side * 0.35)), new THREE.Vector3(1, 1, 1));
    const fore = merge([
      piece(box(0.1, 0.28, 0.11), [0, -0.14, 0], null, C.uniform),
      piece(new THREE.SphereGeometry(0.05, 8, 6), [0, -0.3, 0], null, C.skin),
    ]).applyMatrix4(elbow);
    return merge([piece(box(0.11, 0.3, 0.12), [0, -0.15, 0], null, C.uniform), fore]);
  };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  return { body, thigh, shin, arms: [arm(-1), arm(1)], material };
})();

function Soldier({ e }) {
  const hips = useRef();
  const thighs = [useRef(), useRef()];
  const shins = [useRef(), useRef()];
  const arms = [useRef(), useRef()];
  const phase = useRef(Math.random() * 6);
  useFrame((_, dt) => {
    phase.current += dt * 9;
    const s = Math.sin(phase.current);
    thighs.forEach((t, i) => t.current && (t.current.rotation.x = (i ? -s : s) * 0.55));
    shins.forEach((t, i) => t.current && (t.current.rotation.x = Math.max(0, i ? s : -s) * 0.9));
    arms.forEach((a, i) => a.current && (a.current.rotation.x = -0.95 + (i ? s : -s) * 0.08));
    if (hips.current) hips.current.position.y = 0.95 + Math.abs(s) * 0.04;
  });
  const M = SOLDIER.material;
  return (
    <group ref={hips} position={[0, 0.95, 0]}>
      <mesh geometry={SOLDIER.body} material={M} castShadow />
      {[-0.11, 0.11].map((x, i) => (
        <group key={x} ref={thighs[i]} position={[x, 0, 0]}>
          <mesh geometry={SOLDIER.thigh} material={M} />
          <group ref={shins[i]} position={[0, -0.45, 0]}>
            <mesh geometry={SOLDIER.shin} material={M} />
          </group>
        </group>
      ))}
      {[-1, 1].map((side, i) => (
        <group key={side} ref={arms[i]} position={[side * 0.27, 0.5, 0]} rotation={[-0.95, 0, side * -0.15]}>
          <mesh geometry={SOLDIER.arms[i]} material={M} />
        </group>
      ))}
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
