import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Mech } from "./Mech.jsx";
import { classOf } from "../shared/arena.js";

/* ---------- crew: merged-geometry workers that walk the bay ---------- */
const CREW = (() => {
  const piece = (geo, pos, color, rot) => {
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
  const body = mergeGeometries([
    piece(box(0.44, 0.55, 0.26), [0, 0.32, 0], "#2a2f36"),
    piece(box(0.47, 0.4, 0.29), [0, 0.38, 0], "#ff7a1a"), // hi-vis vest
    piece(box(0.48, 0.05, 0.3), [0, 0.33, 0], "#e8f05a"), // reflective stripe
    piece(new THREE.SphereGeometry(0.12, 10, 8), [0, 0.8, 0], "#c99a72"),
    piece(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.85, 0], "#ffd21a"), // hard hat
    piece(box(0.12, 0.42, 0.12), [-0.29, 0.38, 0], "#2a2f36", [0, 0, 0.1]),
    piece(box(0.12, 0.42, 0.12), [0.29, 0.38, 0], "#2a2f36", [0, 0, -0.1]),
    piece(box(0.22, 0.28, 0.04), [0.3, 0.2, -0.12], "#d9d9d9"), // clipboard / tablet
  ]);
  const leg = mergeGeometries([
    piece(box(0.16, 0.85, 0.18), [0, -0.42, 0], "#1f2a3a"),
    piece(box(0.17, 0.1, 0.28), [0, -0.86, -0.05], "#111111"),
  ]);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  return { body, leg, material };
})();

function Crew({ path, speed = 1.2, offset = 0, idle = false }) {
  const g = useRef();
  const legs = [useRef(), useRef()];
  const t = useRef(offset);
  const curve = useMemo(
    () => (idle ? null : new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), true)),
    [path, idle],
  );
  const length = useMemo(() => (curve ? curve.getLength() : 1), [curve]);
  useFrame((_, dt) => {
    if (!g.current) return;
    t.current += dt;
    if (idle) {
      // Standing at a station: small weight shifts.
      g.current.rotation.y = Math.sin(t.current * 0.4) * 0.4 + offset;
      return;
    }
    const u = ((t.current * speed) / length) % 1;
    const p = curve.getPointAt(u);
    const ahead = curve.getPointAt((u + 0.01) % 1);
    g.current.position.set(p.x, 0.95, p.z);
    g.current.rotation.y = Math.atan2(-(ahead.x - p.x), -(ahead.z - p.z));
    const s = Math.sin(t.current * 7);
    if (legs[0].current) legs[0].current.rotation.x = s * 0.5;
    if (legs[1].current) legs[1].current.rotation.x = -s * 0.5;
  });
  const start = path[0];
  return (
    <group ref={g} position={[start[0], 0.95, start[1]]}>
      <mesh geometry={CREW.body} material={CREW.material} castShadow />
      {[-0.11, 0.11].map((x, i) => (
        <group key={x} ref={legs[i]} position={[x, 0, 0]}>
          <mesh geometry={CREW.leg} material={CREW.material} />
        </group>
      ))}
    </group>
  );
}

/* ---------- facility set pieces ---------- */
function Gantry({ x, flip = 1 }) {
  return (
    <group position={[x, 0, 0]}>
      {[-3, 3].map((z) => (
        <mesh key={z} position={[0, 4.5, z]} castShadow receiveShadow>
          <boxGeometry args={[0.35, 9, 0.35]} />
          <meshStandardMaterial color="#3a3d42" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {[3.2, 6.4].map((y) => (
        <group key={y}>
          <mesh position={[-flip * 0.8, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 0.15, 6.6]} />
            <meshStandardMaterial color="#2c2f34" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[-flip * 1.75, y + 0.55, 0]}>
            <boxGeometry args={[0.06, 0.06, 6.6]} />
            <meshStandardMaterial color="#d6b21a" metalness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Beacon({ position }) {
  const light = useRef();
  useFrame(({ clock }) => {
    // Rotating-beacon pulse.
    if (light.current) light.current.intensity = 6 + Math.max(0, Math.sin(clock.elapsedTime * 6)) * 30;
  });
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.18, 0.18, 0.3, 12]} />
        <meshStandardMaterial color="#ffb21a" emissive="#ff9a00" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#ffa21a" intensity={20} distance={14} />
    </group>
  );
}

function Bay({ cls, paint, loadout }) {
  const scale = classOf(cls).scale;
  return (
    <>
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 18, 55]} />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={["#cfd8e0", "#111111", 0.35]} />
      {/* key spotlights on the Titan */}
      <spotLight position={[4, 13, 7]} angle={0.45} penumbra={0.7} intensity={420} color="#fff4e2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <spotLight position={[-6, 11, -3]} angle={0.5} penumbra={0.8} intensity={180} color="#bcd4ff" />
      <pointLight position={[0, 2, 5]} intensity={8} color="#ffffff" distance={10} />

      {/* floor and platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#1a1b1d" metalness={0.45} roughness={0.32} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[4.2, 64]} />
        <meshStandardMaterial color="#262729" metalness={0.6} roughness={0.25} />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, (i / 24) * Math.PI * 2]} position={[0, 0.03, 0]}>
          <ringGeometry args={[4.2, 4.6, 6, 1, 0, Math.PI / 12]} />
          <meshStandardMaterial color={i % 2 ? "#111111" : "#e0b21a"} />
        </mesh>
      ))}
      {/* floor guide lines */}
      {[-9, 9].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, -2]}>
          <planeGeometry args={[0.2, 40]} />
          <meshStandardMaterial color="#d6b21a" />
        </mesh>
      ))}

      {/* back wall with panel seams and lit strips */}
      <mesh position={[0, 9, -14]} receiveShadow>
        <boxGeometry args={[60, 18, 0.5]} />
        <meshStandardMaterial color="#202226" metalness={0.5} roughness={0.6} />
      </mesh>
      {[-20, -10, 0, 10, 20].map((x) => (
        <mesh key={x} position={[x, 9, -13.7]}>
          <boxGeometry args={[0.15, 18, 0.1]} />
          <meshStandardMaterial color="#0e0f11" />
        </mesh>
      ))}
      {[-15, -5, 5, 15].map((x) => (
        <mesh key={x} position={[x, 14, -13.6]}>
          <boxGeometry args={[6, 0.25, 0.1]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      ))}
      {/* bay door with light spilling under it */}
      <mesh position={[0, 5, -13.6]}>
        <boxGeometry args={[14, 10, 0.2]} />
        <meshStandardMaterial color="#2b2d31" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, -13.5]}>
        <boxGeometry args={[14, 0.5, 0.1]} />
        <meshStandardMaterial color="#ffe6b8" emissive="#ffd28a" emissiveIntensity={5} toneMapped={false} />
      </mesh>
      {/* ceiling light strips */}
      {[-6, 0, 6].map((z) => (
        <mesh key={z} position={[0, 17, z]}>
          <boxGeometry args={[24, 0.2, 0.5]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}

      <Gantry x={-4.2} flip={-1} />
      <Gantry x={4.2} flip={1} />
      <Beacon position={[-4.2, 9.2, -3]} />
      <Beacon position={[4.2, 9.2, 3]} />

      {/* crane hook */}
      <mesh position={[1.5, 12.5, 1]}>
        <cylinderGeometry args={[0.03, 0.03, 9, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[1.5, 8, 1]}>
        <boxGeometry args={[0.6, 0.5, 0.4]} />
        <meshStandardMaterial color="#e0b21a" metalness={0.5} />
      </mesh>

      {/* crates, carts and neighbouring bays with parked Titans */}
      {[[-9, 4], [-8.5, 6.2], [9.5, 5], [10.5, -4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.6, z]} rotation={[0, i, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 1.2, 1.4]} />
          <meshStandardMaterial color={i % 2 ? "#3b4a2c" : "#4a4f55"} roughness={0.8} />
        </mesh>
      ))}
      {[[-7, -6], [7.5, 1]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i ? -0.5 : 0.4, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.6, 0.5, 0.9]} />
            <meshStandardMaterial color="#b02a2a" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <boxGeometry args={[1.5, 0.4, 0.8]} />
            <meshStandardMaterial color="#8a2020" metalness={0.5} />
          </mesh>
        </group>
      ))}
      <group position={[-16, 0, -6]} rotation={[0, 0.4, 0]}>
        <Mech cls="heavy" paint={{ primary: "#3a3d42", secondary: "#24262a", visor: "#555555" }} idle />
      </group>
      <group position={[16, 0, -6]} rotation={[0, -0.4, 0]}>
        <Mech cls="scout" paint={{ primary: "#3a3d42", secondary: "#24262a", visor: "#555555" }} idle />
      </group>

      {/* the player's Titan */}
      <group scale={1 / scale}>
        <Mech cls={cls} paint={paint} loadout={loadout} idle />
      </group>

      {/* crew */}
      <Crew path={[[-6, 6], [6, 6], [7, 9], [-7, 9]]} speed={1.3} />
      <Crew path={[[6, -4], [8, 2], [3, 7], [-3, 7], [-8, 2], [-6, -4]]} speed={1.1} offset={3} />
      <Crew path={[[-11, -8], [-11, 8], [-9, 8], [-9, -8]]} speed={1.4} offset={1} />
      <Crew path={[[10, 8], [12, -8], [10, -9]]} speed={1} offset={5} />
      <Crew path={[[-5.5, 2.5]]} idle offset={0.8} />
      <Crew path={[[5.6, -1.5]]} idle offset={-2.4} />
    </>
  );
}

/** Slow cinematic dolly around the Titan. */
function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.08;
    const r = 15 + Math.sin(t * 2.3) * 1.5;
    camera.position.set(Math.sin(t) * r * 0.5 + 2, 4 + Math.sin(t * 1.7) * 0.7, Math.cos(t) * r * 0.3 + 13);
    camera.lookAt(0.6, 2.8, 0);
  });
  return null;
}

export function HangarBay({ cls, paint, loadout }) {
  return (
    <Canvas shadows="soft" camera={{ position: [2, 4, 16], fov: 44 }} dpr={[1, 2]}>
      <CameraRig />
      <Bay cls={cls} paint={paint} loadout={loadout} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} radius={0.75} />
        <Vignette offset={0.2} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
