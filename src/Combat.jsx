import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

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
  useFrame((state) => {
    if (body.current) body.current.rotation.y = state.clock.elapsedTime * 2;
  });
  return (
    <Follow p={drone.p} rate={12}>
      <group ref={body}>
        <mesh>
          <octahedronGeometry args={[1.35, 0]} />
          <meshStandardMaterial
            color={drone.hp > 2 ? "#c24a63" : "#e38a3c"}
            emissive={drone.hp > 2 ? "#4a0b1a" : "#5a2a08"}
            emissiveIntensity={1.4}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.8, 0.14, 6, 24]} />
          <meshStandardMaterial
            color="#ffc2cc"
            emissive="#ff5a78"
            emissiveIntensity={1.2}
          />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[0.38, 10, 10]} />
        <meshStandardMaterial
          color="#ff3355"
          emissive="#ff1e46"
          emissiveIntensity={3}
        />
      </mesh>
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
  boom: 0.7,
  hit: 0.25,
  repair: 0.8,
  down: 0.9,
  fuse: 1.0,
  unfuse: 0.7,
  strike: 0.6,
};
export function Effect({ effect, onDone }) {
  const mesh = useRef();
  const material = useRef();
  const age = useRef(0);
  const life = EFFECT_LIFE[effect.kind] ?? 0.5;
  useFrame((_, dt) => {
    age.current += dt;
    const t = Math.min(1, age.current / life);
    const size =
      effect.kind === "boom"
        ? 0.6 + t * 4.2
        : effect.kind === "repair"
          ? 1 + t * 13
          : effect.kind === "down"
            ? 0.5 + t * 3
            : effect.kind === "fuse" || effect.kind === "unfuse"
              ? 1 + t * 7
              : effect.kind === "strike"
                ? 5 * (1 - t * 0.6)
                : 0.3 + t * 0.9;
    mesh.current?.scale.setScalar(size);
    if (material.current) material.current.opacity = (1 - t) * 0.85;
    if (t >= 1) onDone(effect.id);
  });
  const color = {
    boom: "#ffb347",
    hit: "#fff3c4",
    repair: "#5dff9a",
    down: "#ff4a6a",
    fuse: "#c48bff",
    unfuse: "#c48bff",
    strike: "#dfe9ff",
  }[effect.kind];
  return (
    <mesh
      ref={mesh}
      position={effect.p}
      rotation={effect.kind === "repair" ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
    >
      {effect.kind === "repair" ? (
        <torusGeometry args={[1, 0.06, 6, 40]} />
      ) : (
        <sphereGeometry args={[1, 14, 10]} />
      )}
      <meshBasicMaterial
        ref={material}
        color={color}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
