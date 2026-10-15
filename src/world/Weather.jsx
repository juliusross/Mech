import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sfx } from "../audio.js";

// Particle weather in a box that follows the camera, so it looks endless
// without simulating the whole planet.
const BOX = { x: 90, y: 45, z: 90 };
const KINDS = {
  rain: { count: 2600, speed: 38, drift: 2, color: "#a9c4dc", size: 0, streak: 1.3, opacity: 0.55 },
  drizzle: { count: 900, speed: 30, drift: 1, color: "#b7d3c3", size: 0, streak: 0.9, opacity: 0.4 },
  snow: { count: 2400, speed: 3.2, drift: 1.6, color: "#ffffff", size: 0.32, opacity: 0.9 },
  ash: { count: 1600, speed: 1.6, drift: 1.2, color: "#b9a59a", size: 0.22, opacity: 0.8, embers: 0.18 },
};

let dot = null;
// Soft round sprite so snow and ash read as flakes, not squares.
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

function Particles({ kind }) {
  const K = KINDS[kind];
  const { camera } = useThree();
  const ref = useRef();
  const { geo, seeds } = useMemo(() => {
    const n = K.count;
    const verts = new Float32Array(n * (K.streak ? 6 : 3));
    const colors = new Float32Array(n * (K.streak ? 6 : 3));
    const seeds = new Float32Array(n * 3);
    const c1 = new THREE.Color(K.color),
      c2 = new THREE.Color("#ff7a2a");
    for (let i = 0; i < n; i++) {
      seeds[i * 3] = (Math.random() - 0.5) * BOX.x;
      seeds[i * 3 + 1] = Math.random() * BOX.y;
      seeds[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
      const c = K.embers && Math.random() < K.embers ? c2 : c1;
      for (let k = 0; k < (K.streak ? 2 : 1); k++) colors.set([c.r, c.g, c.b], (i * (K.streak ? 2 : 1) + k) * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { geo: g, seeds };
  }, [kind]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position.array;
    const cx = camera.position.x,
      cz = camera.position.z;
    for (let i = 0; i < K.count; i++) {
      const sx = seeds[i * 3],
        sy = seeds[i * 3 + 1],
        sz = seeds[i * 3 + 2];
      // Fall and wrap within the box; sway sideways a little.
      let y = (((sy - t * K.speed) % BOX.y) + BOX.y) % BOX.y;
      const sway = Math.sin(t * 0.7 + i) * K.drift;
      const x = cx + ((((sx + sway - cx) % BOX.x) + BOX.x * 1.5) % BOX.x) - BOX.x / 2;
      const z = cz + ((((sz - cz) % BOX.z) + BOX.z * 1.5) % BOX.z) - BOX.z / 2;
      if (K.streak) {
        pos.set([x, y, z, x + 0.15, y + K.streak, z], i * 6);
      } else pos.set([x, y, z], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
  });
  return K.streak ? (
    <lineSegments ref={ref} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={K.opacity} depthWrite={false} />
    </lineSegments>
  ) : (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial vertexColors size={K.size} map={dotTexture()} alphaTest={0.02} transparent opacity={K.opacity} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/** Sky-wide lightning: brief flashes with thunder a moment later. */
function Lightning({ light }) {
  const next = useRef(3);
  const flash = useRef(0);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (t > next.current) {
      flash.current = 0.35;
      next.current = t + 4 + Math.random() * 7;
      setTimeout(() => sfx.strike(0.35), 400 + Math.random() * 900);
    }
    flash.current = Math.max(0, flash.current - dt);
    if (light.current) light.current.intensity = flash.current > 0 ? (Math.random() > 0.3 ? 9 : 2) : 0;
  });
  return null;
}

export function Weather({ kind, lightning }) {
  const light = useRef();
  return (
    <>
      {kind && <Particles kind={kind} />}
      {lightning && (
        <>
          <hemisphereLight ref={light} args={["#dfe9ff", "#223344", 0]} />
          <Lightning light={light} />
        </>
      )}
    </>
  );
}
