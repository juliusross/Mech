import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { armorMaps } from "./world/armorMaps.js";
import { DamageSmoke, ImpactParticles } from "./DamageEffects.jsx";

// Snapshot positions arrive 20 times a second; ease toward them every frame.
function Follow({ p, rate = 18, children }) {
  const group = useRef();
  const first = useRef(p);
  useFrame((_, dt) => {
    group.current?.position.lerp(
      new THREE.Vector3(...p),
      1 - Math.exp(-rate * dt),
    );
  });
  return (
    <group ref={group} position={first.current}>
      {children}
    </group>
  );
}
export function Drone({ drone }) {
  const body = useRef();
  const rotors = useRef([]);
  useFrame((state, dt) => {
    if (body.current) {
      const delta = Math.atan2(
        Math.sin((drone.h || 0) - body.current.rotation.y),
        Math.cos((drone.h || 0) - body.current.rotation.y),
      );
      body.current.rotation.y += delta * (1 - Math.exp(-8 * dt));
      body.current.rotation.z = Math.sin(state.clock.elapsedTime * 2 + drone.id) * 0.035;
    }
    for (const rotor of rotors.current) if (rotor) rotor.rotation.y += dt * 32;
  });
  const damaged = drone.hp <= 2;
  return (
    <Follow p={drone.p} rate={12}>
      <group ref={body}>
        <mesh scale={[1.05, 0.35, 1.45]} castShadow receiveShadow>
          <sphereGeometry args={[1, 16, 10]} />
          <meshStandardMaterial color={damaged ? "#79513f" : "#394652"} metalness={0.65} roughness={0.43} {...armorMaps()} />
        </mesh>
        <mesh position={[0, 0.16, -0.42]} scale={[0.65, 0.28, 0.7]} castShadow>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#202d37" metalness={0.8} roughness={0.24} />
        </mesh>
        <mesh position={[0, -0.08, -1.29]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.38, 0.65, 10]} />
          <meshStandardMaterial color="#667a86" metalness={0.7} roughness={0.37} />
        </mesh>
        <mesh position={[0, 0.08, -1.57]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#a4f4ff" emissive="#18c4e5" emissiveIntensity={2.5} />
        </mesh>
        {[-1, 1].flatMap((side) => [-1, 1].map((end) => {
          const index = (side === -1 ? 0 : 2) + (end === -1 ? 0 : 1);
          return (
            <group key={index} position={[side * 1.35, 0.13, end * 0.85]}>
              <mesh position={[-side * 0.53, -0.03, -end * 0.31]} rotation={[0, side * end * 0.55, 0]} castShadow>
                <boxGeometry args={[1.08, 0.15, 0.22]} />
                <meshStandardMaterial color="#61717b" metalness={0.72} roughness={0.4} />
              </mesh>
              <mesh castShadow>
                <cylinderGeometry args={[0.25, 0.3, 0.25, 10]} />
                <meshStandardMaterial color="#273139" metalness={0.65} roughness={0.5} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.62, 0.07, 6, 20]} />
                <meshStandardMaterial color="#8496a0" metalness={0.7} roughness={0.38} />
              </mesh>
              <group ref={(g) => (rotors.current[index] = g)} position={[0, 0.16, 0]}>
                {[0, Math.PI / 2].map((angle) => (
                  <mesh key={angle} rotation={[0, angle, 0]}>
                    <boxGeometry args={[1.05, 0.035, 0.14]} />
                    <meshStandardMaterial color="#c5d3d8" metalness={0.4} roughness={0.48} side={THREE.DoubleSide} />
                  </mesh>
                ))}
              </group>
              <mesh position={[0, -0.16, 0]}>
                <sphereGeometry args={[0.1, 8, 6]} />
                <meshStandardMaterial color={end < 0 ? "#ff5752" : "#86e3ff"} emissive={end < 0 ? "#b42525" : "#37a9ce"} emissiveIntensity={2} />
              </mesh>
            </group>
          );
        }))}
        <mesh position={[0, -0.45, -0.6]} castShadow>
          <boxGeometry args={[0.62, 0.36, 0.72]} />
          <meshStandardMaterial color="#232c33" metalness={0.7} roughness={0.42} />
        </mesh>
        <mesh position={[0, -0.56, -1.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.19, 0.58, 10]} />
          <meshStandardMaterial color="#d65951" emissive="#77120d" emissiveIntensity={1.2} metalness={0.55} />
        </mesh>
        {[-0.68, 0.68].map((side) => (
          <mesh key={side} position={[side, -0.42, 0.45]} rotation={[0, 0, side * 0.3]} castShadow>
            <boxGeometry args={[0.1, 0.43, 0.8]} />
            <meshStandardMaterial color="#56646b" metalness={0.6} roughness={0.45} />
          </mesh>
        ))}
        {damaged && <DamageSmoke severity={1 - drone.hp / 4} position={[0, 0.2, 0.5]} />}
      </group>
    </Follow>
  );
}
export function Bolt({ bolt }) {
  return (
    <Follow p={bolt.p} rate={30}>
      <mesh>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshBasicMaterial color="#ff4a6a" />
      </mesh>
    </Follow>
  );
}
export const EFFECT_LIFE = {
  boom: 1.8,
  hit: 0.7,
  repair: 0.8,
  down: 1.8,
  fuse: 1.0,
  eject: 0.8,
  mechdrop: 1.6,
  unfuse: 0.7,
  strike: 0.6,
  beam: 0.16,
  slash: 0.35,
  pickup: 0.55,
};
export function Effect({ effect, onDone }) {
  const mesh = useRef();
  const material = useRef();
  const age = useRef(0);
  const finished = useRef(false);
  const life = EFFECT_LIFE[effect.kind] ?? 0.5;
  useFrame((_, dt) => {
    age.current += dt;
    const t = Math.min(1, age.current / life);
    const impact = effect.kind === "boom" || effect.kind === "hit" || effect.kind === "down";
    const flash = impact ? Math.max(0, 1 - age.current / (effect.kind === "hit" ? 0.18 : 0.33)) : 1 - t;
    const size =
      effect.kind === "beam"
        ? 1
      : effect.kind === "boom"
        ? 0.6 + (1 - flash) * 3.5
        : effect.kind === "repair"
          ? 1 + t * 13
          : effect.kind === "down"
            ? 0.5 + (1 - flash) * 3
            : effect.kind === "fuse" || effect.kind === "unfuse"
              ? 1 + t * 7
              : effect.kind === "strike"
                ? 5 * (1 - t * 0.6)
                : 0.3 + (1 - flash) * 0.9;
    mesh.current?.scale.setScalar(size);
    if (material.current) material.current.opacity = flash * 0.7;
    if (t >= 1 && !finished.current) {
      finished.current = true;
      onDone(effect.id);
    }
  });
  const color = {
    boom: "#ffb347",
    hit: "#fff3c4",
    repair: "#5dff9a",
    down: "#ff4a6a",
    fuse: "#c48bff",
    eject: "#ffd27a",
    mechdrop: "#9fe8ff",
    unfuse: "#c48bff",
    strike: "#dfe9ff",
    beam: "#9bf9ff",
    slash: "#bc8dff",
    pickup: "#a8ffb0",
  }[effect.kind];
  const from = new THREE.Vector3(...effect.p);
  const to = new THREE.Vector3(...(effect.q || effect.p));
  const beam = to.clone().sub(from);
  const beamRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beam.clone().normalize());
  return (
    <>
      <mesh
        ref={mesh}
        position={effect.kind === "beam" ? from.clone().add(to).multiplyScalar(0.5).toArray() : effect.p}
        quaternion={effect.kind === "beam" ? beamRotation : undefined}
        rotation={effect.kind === "repair" || effect.kind === "slash" || effect.kind === "pickup" ? [-Math.PI / 2, 0, 0] : undefined}
      >
        {effect.kind === "beam" ? (
          <cylinderGeometry args={[0.12, 0.12, Math.max(0.1, beam.length()), 8]} />
        ) : effect.kind === "repair" || effect.kind === "slash" || effect.kind === "pickup" ? (
          <torusGeometry args={[effect.kind === "slash" ? 2.8 : 1, effect.kind === "slash" ? 0.15 : 0.06, 6, 40, effect.kind === "slash" ? Math.PI : Math.PI * 2]} />
        ) : (
          <sphereGeometry args={[1, 14, 10]} />
        )}
        <meshBasicMaterial ref={material} color={color} transparent depthWrite={false} />
      </mesh>
      {(effect.kind === "boom" || effect.kind === "hit" || effect.kind === "down") && (
        <ImpactParticles effect={effect} age={age} />
      )}
    </>
  );
}

// Blood for crushed or shot infantry: a ground decal that fades out, plus
// droplets that spray outward and fall.
const SPLAT_LIFE = { splat: 9, ouch: 4 };
export function BloodSplat({ effect, onDone }) {
  const big = effect.kind === "splat";
  const group = useRef();
  const drops = useRef(null);
  const age = useRef(0);
  const blobs = React.useMemo(
    () =>
      Array.from({ length: big ? 7 : 3 }, (_, i) => ({
        x: (Math.random() - 0.5) * (big ? 2.4 : 0.9),
        z: (Math.random() - 0.5) * (big ? 2.4 : 0.9),
        r: (big ? 0.5 : 0.25) + Math.random() * (big ? 0.7 : 0.3),
        s: 0.6 + Math.random() * 0.8,
        a: Math.random() * Math.PI,
      })),
    [big],
  );
  const flying = React.useMemo(
    () =>
      Array.from({ length: big ? 16 : 7 }, () => {
        const a = Math.random() * Math.PI * 2,
          sp = 2 + Math.random() * (big ? 5 : 3);
        return { p: new THREE.Vector3(0, big ? 0.3 : 0.9, 0), v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp) };
      }),
    [big],
  );
  const life = SPLAT_LIFE[effect.kind];
  useFrame((_, dt) => {
    age.current += dt;
    const t = age.current / life;
    group.current?.children.forEach((m) => {
      if (m.material && m.userData.decal) m.material.opacity = Math.min(0.92, (1 - t) * 1.6);
    });
    if (drops.current)
      drops.current.children.forEach((m, i) => {
        const d = flying[i];
        if (d.p.y <= 0) return;
        d.v.y -= 22 * dt;
        d.p.addScaledVector(d.v, dt);
        m.position.copy(d.p);
        if (d.p.y <= 0) m.visible = false;
      });
    if (t >= 1) onDone(effect.id);
  });
  return (
    <group ref={group} position={effect.p}>
      {blobs.map((b, i) => (
        <mesh key={i} userData={{ decal: true }} position={[b.x, 0.02 + i * 0.002, b.z]} rotation={[-Math.PI / 2, 0, b.a]} scale={[1, b.s, 1]}>
          <circleGeometry args={[b.r, 14]} />
          <meshStandardMaterial color="#6e0a0a" roughness={0.35} metalness={0.1} transparent opacity={0.92} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      <group ref={drops}>
        {flying.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[big ? 0.09 : 0.06, 6, 5]} />
            <meshBasicMaterial color="#8c0d0d" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Laser bolt: a white-hot core inside a coloured glow, pointed along its
// direction of travel. Colours exceed 1 so the bloom pass makes them shine.
const Y = new THREE.Vector3(0, 1, 0);
const LASER_SIZE = {
  normal: [2.6, 0.06, 0.2],
  minigun: [1.6, 0.04, 0.13],
  rail: [6, 0.07, 0.24],
  rocket: [1.4, 0.16, 0.42],
  cannon: [2, 0.22, 0.55],
  shotgun: [1, 0.04, 0.12],
  pilot: [1.1, 0.03, 0.1],
  plasma: [2.2, 0.07, 0.24],
  bullet: [1.3, 0.035, 0.11],
  shell: [1.8, 0.16, 0.42],
};
export function Laser({ pos, dir, color, kind = "normal" }) {
  const g = useRef();
  const [len, core, glow] = LASER_SIZE[kind] || LASER_SIZE.normal;
  const c = React.useMemo(() => new THREE.Color(color).multiplyScalar(4), [color]);
  React.useLayoutEffect(() => {
    if (!g.current || !dir) return;
    g.current.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...dir).normalize());
  });
  return (
    <group ref={g} position={pos}>
      <mesh position={[0, -len / 2, 0]}>
        <cylinderGeometry args={[core, core, len, 6]} />
        <meshBasicMaterial color={[3, 3, 3]} toneMapped={false} />
      </mesh>
      <mesh position={[0, -len / 2, 0]}>
        <cylinderGeometry args={[glow, glow * 0.6, len * 1.05, 8]} />
        <meshBasicMaterial color={c} toneMapped={false} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// A replacement Titan arrives: a bright column from the sky and a shock ring.
export function DropBeam({ effect, onDone }) {
  const beam = useRef(),
    ring = useRef(),
    age = useRef(0);
  useFrame((_, dt) => {
    age.current += dt;
    const t = Math.min(1, age.current / 1.6);
    if (beam.current) {
      beam.current.scale.set(1 - t * 0.7, 1, 1 - t * 0.7);
      beam.current.material.opacity = (1 - t) * 0.8;
    }
    if (ring.current) {
      ring.current.scale.setScalar(1 + t * 10);
      ring.current.material.opacity = (1 - t) * 0.9;
    }
    if (t >= 1) onDone(effect.id);
  });
  return (
    <group position={effect.p}>
      <mesh ref={beam} position={[0, 40, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 80, 16, 1, true]} />
        <meshBasicMaterial color={[1.2, 3, 4]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <ringGeometry args={[0.8, 1.1, 40]} />
        <meshBasicMaterial color={[1.5, 3, 4]} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
