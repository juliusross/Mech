import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { armorMaps } from "./world/armorMaps.js";

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
