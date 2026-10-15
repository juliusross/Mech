import React, { useMemo } from "react";
import * as THREE from "three";
import { Instanced } from "./Instanced.jsx";

/* ---------- shared textures ---------- */
let windowTex = null;
function windowsTexture() {
  if (windowTex) return windowTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 10)
    for (let x = 4; x < 64; x += 10) {
      const lit = Math.random() < 0.45;
      g.fillStyle = lit ? `hsl(${40 + Math.random() * 20},80%,${55 + Math.random() * 25}%)` : "#0b0f14";
      g.fillRect(x, y, 6, 6);
    }
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  windowTex.repeat.set(2, 3);
  return windowTex;
}

/* ---------- roads ---------- */
function Road({ road, snowy }) {
  const dx = road.x1 - road.x0,
    dz = road.z1 - road.z0;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);
  const cx = (road.x0 + road.x1) / 2,
    cz = (road.z0 + road.z1) / 2;
  const y = road.elevated || 0;
  const dashes = useMemo(() => {
    const out = [];
    for (let t = 4; t < len - 4; t += 9) out.push(t - len / 2);
    return out;
  }, [len]);
  const pillars = useMemo(() => (road.elevated ? dashes.filter((_, i) => i % 3 === 0) : []), [dashes, road.elevated]);
  const barrierRows = road.highway ? [-road.w / 2 + 0.3, road.w / 2 - 0.3] : [];
  return (
    <group position={[cx, 0, cz]} rotation={[0, ang, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.03, 0]} receiveShadow>
        <planeGeometry args={[road.w, len]} />
        <meshStandardMaterial color={snowy ? "#9aa6ad" : road.cracked ? "#1f1a18" : "#2b2e33"} roughness={0.95} />
      </mesh>
      {road.elevated && (
        <mesh position={[0, y - 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[road.w, 1, len]} />
          <meshStandardMaterial color="#5e6670" roughness={0.9} />
        </mesh>
      )}
      {dashes.map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.05, z]}>
          <planeGeometry args={[0.25, 4]} />
          <meshBasicMaterial color={road.highway ? "#e8c34a" : "#e8e8e8"} />
        </mesh>
      ))}
      {barrierRows.map((x) => (
        <mesh key={x} position={[x, y + 0.45, 0]} castShadow>
          <boxGeometry args={[0.4, 0.9, len]} />
          <meshStandardMaterial color="#b9bdc2" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      {pillars.map((z) => (
        <mesh key={z} position={[0, y / 2 - 0.5, z]} castShadow>
          <boxGeometry args={[2.2, y - 1, 2.2]} />
          <meshStandardMaterial color="#6b737d" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
export function Roads({ roads = [], snowy, streetlights }) {
  const lights = useMemo(() => {
    if (!streetlights) return [];
    const out = [];
    for (const r of roads) {
      if (r.elevated) continue;
      const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
      const nx = -(r.z1 - r.z0) / len,
        nz = (r.x1 - r.x0) / len;
      for (let t = 10; t < len; t += 24) {
        const k = t / len;
        const x = r.x0 + (r.x1 - r.x0) * k,
          z = r.z0 + (r.z1 - r.z0) * k;
        const off = r.w / 2 + 1;
        if (Math.abs(x) < 66 && z > -86 && z < 66) continue;
        out.push({ x: x + nx * off, z: z + nz * off }, { x: x - nx * off, z: z - nz * off });
      }
    }
    return out;
  }, [roads, streetlights]);
  return (
    <>
      {roads.map((r, i) => (
        <Road key={i} road={r} snowy={snowy && r.snowy} />
      ))}
      <Instanced items={lights} place={placeLightPole}>
        <cylinderGeometry args={[0.1, 0.14, 7, 6]} />
        <meshStandardMaterial color="#3d434a" metalness={0.6} />
      </Instanced>
      <Instanced items={lights} place={placeLightHead} castShadow={false}>
        <boxGeometry args={[0.8, 0.25, 0.5]} />
        <meshStandardMaterial color="#fff2c4" emissive="#ffd27a" emissiveIntensity={2.2} />
      </Instanced>
    </>
  );
}
const placeLightPole = (l) => ({ p: [l.x, 3.5, l.z] });
const placeLightHead = (l) => ({ p: [l.x, 7, l.z] });

/* ---------- buildings ---------- */
const placeBuilding = (b) => ({ p: [b.x, b.h / 2, b.z], s: [b.w, b.h, b.d], c: b.color });
const placeRoofBox = (b) => ({ p: [b.x, b.h + 0.6, b.z], s: [b.w * 0.4, 1.2, b.d * 0.4] });
const placeRuinChunk = (b) => ({ p: [b.x + b.w * 0.2, b.h + 0.8, b.z], s: [b.w * 0.5, 1.6, b.d * 0.6], r: [0.3, 0, 0.4], c: b.color });
export function Buildings({ buildings = [], night }) {
  const tex = useMemo(() => windowsTexture(), []);
  const ruined = useMemo(() => buildings.filter((b) => b.ruined), [buildings]);
  const intact = useMemo(() => buildings.filter((b) => !b.ruined), [buildings]);
  return (
    <>
      <Instanced items={buildings} place={placeBuilding}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.75}
          metalness={0.15}
          emissiveMap={tex}
          emissive={night ? "#ffd9a0" : "#000000"}
          emissiveIntensity={night ? 1.1 : 0}
          map={tex}
        />
      </Instanced>
      <Instanced items={intact} place={placeRoofBox}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4a525c" roughness={0.8} />
      </Instanced>
      <Instanced items={ruined} place={placeRuinChunk}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </Instanced>
    </>
  );
}

/* ---------- houses ---------- */
const placeHouse = (h) => ({ p: [h.x, h.h / 2, h.z], s: [h.w, h.h, h.d], r: [0, h.r, 0], c: h.wall });
// Triangular prism roof: a 3-sided cylinder lying along the house's depth.
const placeRoof = (h) => ({ p: [h.x, h.h + 0.9, h.z], s: [h.w * 0.62, h.d * 1.05, 1.4], r: [Math.PI / 2, 0, h.r + Math.PI / 2], c: h.roof });
const placeChimney = (h) => ({ p: [h.x + h.w * 0.2, h.h + 1.6, h.z], s: [0.6, 1.6, 0.6], r: [0, h.r, 0] });
export function Houses({ houses = [] }) {
  return (
    <>
      <Instanced items={houses} place={placeHouse}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </Instanced>
      <Instanced items={houses} place={placeRoof}>
        <cylinderGeometry args={[1, 1, 1, 3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} flatShading />
      </Instanced>
      <Instanced items={houses} place={placeChimney}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6b5a4e" roughness={0.9} />
      </Instanced>
    </>
  );
}

/* ---------- construction sites ---------- */
function Crane({ h = 34, jib = 26 }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[1.6, h, 1.6]} />
        <meshStandardMaterial color="#e2b23a" roughness={0.6} metalness={0.3} wireframe={false} />
      </mesh>
      <mesh position={[jib / 2 - 4, h + 0.6, 0]} castShadow>
        <boxGeometry args={[jib, 1.1, 1.1]} />
        <meshStandardMaterial color="#e2b23a" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[-6, h + 0.2, 0]} castShadow>
        <boxGeometry args={[3, 2, 2.2]} />
        <meshStandardMaterial color="#5c6168" roughness={0.8} />
      </mesh>
      <mesh position={[0, h + 1.8, 0]} castShadow>
        <boxGeometry args={[2.2, 2, 2.2]} />
        <meshStandardMaterial color="#d8dde2" roughness={0.6} />
      </mesh>
      <mesh position={[jib - 8, h - 6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 12, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[jib - 8, h - 12.5, 0]} castShadow>
        <boxGeometry args={[4, 0.6, 1.2]} />
        <meshStandardMaterial color="#8a4b2b" />
      </mesh>
    </group>
  );
}
function Frame({ floors = 4, w = 16, d = 12 }) {
  const cols = useMemo(() => {
    const out = [];
    for (let x = -w / 2; x <= w / 2; x += w / 3) for (let z = -d / 2; z <= d / 2; z += d / 2) out.push([x, z]);
    return out;
  }, [w, d]);
  return (
    <group>
      {Array.from({ length: floors }, (_, f) => (
        <mesh key={f} position={[0, (f + 1) * 3.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 1, 0.35, d + 1]} />
          <meshStandardMaterial color="#a8a39b" roughness={0.95} />
        </mesh>
      ))}
      {cols.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, (floors * 3.6) / 2, z]} castShadow>
          <boxGeometry args={[0.45, floors * 3.6, 0.45]} />
          <meshStandardMaterial color="#8c8a86" roughness={0.9} />
        </mesh>
      ))}
      {/* scaffolding on one face */}
      {Array.from({ length: floors }, (_, f) => (
        <mesh key={`s${f}`} position={[0, f * 3.6 + 1.8, d / 2 + 1.2]}>
          <boxGeometry args={[w, 0.12, 1.2]} />
          <meshStandardMaterial color="#c47a2c" />
        </mesh>
      ))}
    </group>
  );
}
export function ConstructionSites({ sites = [] }) {
  return sites.map((s, i) => (
    <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.r, 0]}>
      <Frame floors={3 + (i % 3)} />
      <group position={[-14, 0, 8]}>
        <Crane />
      </group>
      {/* girder stack, concrete barriers and cones */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[12, 0.3 + k * 0.6, -6]} castShadow>
          <boxGeometry args={[9, 0.5, 0.6]} />
          <meshStandardMaterial color="#7a3b2a" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={x} position={[x, 0.5, -11]} castShadow>
          <boxGeometry args={[3.4, 1, 0.8]} />
          <meshStandardMaterial color="#cfcac2" roughness={0.95} />
        </mesh>
      ))}
      {[-10, -6, 6, 10].map((x) => (
        <mesh key={`c${x}`} position={[x, 0.4, -13]} castShadow>
          <coneGeometry args={[0.35, 0.8, 10]} />
          <meshStandardMaterial color="#ff6a1a" />
        </mesh>
      ))}
      <mesh position={[16, 1.4, 6]} castShadow>
        <boxGeometry args={[6, 2.8, 2.6]} />
        <meshStandardMaterial color="#3f6d9e" roughness={0.7} />
      </mesh>
    </group>
  ));
}

/* ---------- jungle temples & stilt huts ---------- */
export function Temples({ temples = [] }) {
  return temples.map((t, i) => (
    <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[0, 1.5 + k * 3, 0]} castShadow receiveShadow>
          <boxGeometry args={[26 - k * 5, 3, 26 - k * 5]} />
          <meshStandardMaterial color={k % 2 ? "#7f8a6a" : "#8f977a"} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 7, 13.5]} rotation={[-0.62, 0, 0]} receiveShadow>
        <boxGeometry args={[4, 0.6, 20]} />
        <meshStandardMaterial color="#6f7a5c" roughness={1} />
      </mesh>
      <mesh position={[0, 17, 0]} castShadow>
        <boxGeometry args={[5, 4, 5]} />
        <meshStandardMaterial color="#6d7558" roughness={1} />
      </mesh>
    </group>
  ));
}
const placeHut = (h) => ({ p: [h.x, 3.6, h.z], r: [0, h.r, 0] });
const placeHutRoof = (h) => ({ p: [h.x, 6.4, h.z], r: [0, h.r, 0] });
const placeStilts = (h) => ({ p: [h.x, 1.25, h.z], r: [0, h.r, 0] });
export function Huts({ huts = [] }) {
  return (
    <>
      <Instanced items={huts} place={placeStilts}>
        <boxGeometry args={[4.2, 2.5, 4.2]} />
        <meshStandardMaterial color="#5a4330" roughness={1} wireframe />
      </Instanced>
      <Instanced items={huts} place={placeHut}>
        <boxGeometry args={[4.5, 2.4, 4.5]} />
        <meshStandardMaterial color="#8a6a45" roughness={1} />
      </Instanced>
      <Instanced items={huts} place={placeHutRoof}>
        <coneGeometry args={[4.4, 3.2, 4]} />
        <meshStandardMaterial color="#b89a5a" roughness={1} />
      </Instanced>
    </>
  );
}

/* ---------- lunar colony ---------- */
export function Colony({ domes = [], modules = [], pads = [], earth }) {
  return (
    <>
      {domes.map((d, i) => (
        <group key={i} position={[d.x, 0, d.z]}>
          <mesh castShadow>
            <sphereGeometry args={[d.r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#cfe9ff" metalness={0.3} roughness={0.08} transparent opacity={0.55} emissive="#3a6a8a" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[d.r + 0.6, d.r + 0.8, 0.8, 28]} />
            <meshStandardMaterial color="#8d939b" metalness={0.5} />
          </mesh>
          <pointLight position={[0, d.r * 0.4, 0]} color="#ffe2b0" intensity={20} distance={d.r * 2.4} />
        </group>
      ))}
      <Instanced items={modules} place={placeModule}>
        <cylinderGeometry args={[2.2, 2.2, 1, 16]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.5} roughness={0.4} />
      </Instanced>
      {pads.map((p, i) => (
        <group key={i} position={[p.x, 0.05, p.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[10, 32]} />
            <meshStandardMaterial color="#6d7179" roughness={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[8.6, 9.2, 32]} />
            <meshBasicMaterial color="#ffcf4a" />
          </mesh>
        </group>
      ))}
      {earth && (
        <mesh position={[-260, 190, -420]}>
          <sphereGeometry args={[46, 32, 20]} />
          <meshStandardMaterial color="#3a78c8" emissive="#1c4c8c" emissiveIntensity={0.9} roughness={0.7} />
        </mesh>
      )}
    </>
  );
}
const placeModule = (m) => ({ p: [m.x, 2.2, m.z], s: [1, m.l, 1], r: [0, m.r, Math.PI / 2] });

/* ---------- volcano, smokestacks, mountains, bridges, cover ---------- */
export function Volcano({ v }) {
  const shell = useMemo(() => {
    if (!v) return null;
    const geo = new THREE.CylinderGeometry(v.r * 0.17, v.r, v.h, 40, 7, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const n = 1 + Math.sin(a * 7 + y * 0.07) * 0.065 + Math.sin(a * 13 - y * 0.04) * 0.035;
      p.setXYZ(i, x * n, y, z * n);
    }
    geo.computeVertexNormals();
    return geo;
  }, [v]);
  if (!v) return null;
  return (
    <group position={[v.x, 0, v.z]}>
      <mesh geometry={shell} position={[0, v.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#30211e" roughness={0.96} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, v.h - 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[v.r * 0.16, 40]} />
        <meshStandardMaterial color="#ff5a1a" emissive="#ff3a00" emissiveIntensity={2.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, v.h, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[v.r * 0.18, 3.5, 8, 40]} />
        <meshStandardMaterial color="#1d1717" roughness={0.9} flatShading />
      </mesh>
      {[0.3, 2.5, 4.5].map((a) => {
        const flow = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.sin(a) * v.r * 0.16, v.h - 0.5, Math.cos(a) * v.r * 0.16),
          new THREE.Vector3(Math.sin(a) * v.r * 0.31, v.h * 0.66, Math.cos(a) * v.r * 0.31),
          new THREE.Vector3(Math.sin(a + 0.08) * v.r * 0.48, v.h * 0.25, Math.cos(a + 0.08) * v.r * 0.48),
          new THREE.Vector3(Math.sin(a + 0.12) * v.r * 0.62, 0.5, Math.cos(a + 0.12) * v.r * 0.62),
        ]);
        return (
          <mesh key={a}>
            <tubeGeometry args={[flow, 24, 0.9, 5, false]} />
            <meshStandardMaterial color="#fd632b" emissive="#fa390b" emissiveIntensity={1.9} />
          </mesh>
        );
      })}
      <pointLight position={[0, v.h + 10, 0]} color="#ff6a2a" intensity={4000} distance={400} />
    </group>
  );
}
export function Stacks({ stacks = [] }) {
  return stacks.map((s, i) => (
    <group key={i} position={[s.x, 0, s.z]}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.1, 3.5, 1.4, 16]} />
        <meshStandardMaterial color="#383c42" metalness={0.56} roughness={0.57} />
      </mesh>
      <mesh position={[0, s.h / 2, 0]} castShadow>
        <cylinderGeometry args={[1.15, 1.75, s.h, 16]} />
        <meshStandardMaterial color="#57575a" metalness={0.54} roughness={0.67} />
      </mesh>
      {[0.18, 0.55, 0.87].map((fraction) => (
        <mesh key={fraction} position={[0, s.h * fraction, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.52 - fraction * 0.36, 0.12, 6, 16]} />
          <meshStandardMaterial color="#aa6f51" metalness={0.7} roughness={0.46} />
        </mesh>
      ))}
      <mesh position={[2.5, 2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 5, 10]} />
        <meshStandardMaterial color="#616a6b" metalness={0.68} roughness={0.38} />
      </mesh>
      <mesh position={[5, 1.2, 0]} castShadow>
        <sphereGeometry args={[2.2, 16, 12]} />
        <meshStandardMaterial color="#65666a" metalness={0.56} roughness={0.4} />
      </mesh>
      <mesh position={[0, s.h + 0.3, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 0.6, 12]} />
        <meshStandardMaterial color="#ff7a2a" emissive="#ff4a00" emissiveIntensity={2.5} />
      </mesh>
    </group>
  ));
}
export function Mountains({ color, snow, seed = 1 }) {
  const shape = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const rings = [[0, 1], [0.24, 0.83], [0.5, 0.59], [0.74, 0.34], [0.91, 0.15], [1, 0.025]];
    const segments = 12;
    const vertices = [], colors = [], indices = [];
    const rock = new THREE.Color(color);
    const snowColor = new THREE.Color("#e4edf1");
    for (let j = 0; j < rings.length; j++) {
      const [height, radius] = rings[j];
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const variation = 1 + Math.sin(i * 2.3 + j * 1.7) * 0.11 + Math.sin(i * 4.1 - j * 2.2) * 0.07;
        vertices.push(Math.sin(angle) * radius * variation, height, Math.cos(angle) * radius * variation);
        const shade = 0.85 + (Math.sin(i * 1.9 + j * 2.8) + 1) * 0.09;
        const tint = rock.clone().multiplyScalar(shade);
        if (snow && height > 0.76) tint.lerp(snowColor, height > 0.9 ? 0.95 : 0.62);
        colors.push(tint.r, tint.g, tint.b);
      }
    }
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
      const a = j * segments + i, b = j * segments + (i + 1) % segments;
      const c = (j + 1) * segments + i, d = (j + 1) * segments + (i + 1) % segments;
      indices.push(a, b, c, b, d, c);
    }
    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [color, snow]);
  const peaks = useMemo(() => {
    const out = [];
    let x = seed * 9301 + 49297;
    const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2;
      const d = 360 + r() * 90;
      out.push({ x: Math.sin(a) * d, z: Math.cos(a) * d, h: 60 + r() * 90, w: 60 + r() * 60 });
    }
    return out;
  }, [seed]);
  return peaks.map((p, i) => (
    <group key={i} position={[p.x, 0, p.z]}>
      <mesh geometry={shape} scale={[p.w, p.h, p.w]}>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  ));
}
export function Bridges({ bridges = [] }) {
  return bridges.map((b, i) => (
    <group key={i} position={[b.x, 0, b.z]}>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.w, 0.8, 11]} />
        <meshStandardMaterial color="#6b737d" roughness={0.85} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 2.1, s * 5.3]} castShadow>
          <boxGeometry args={[b.w, 1, 0.3]} />
          <meshStandardMaterial color="#9aa2ac" metalness={0.4} />
        </mesh>
      ))}
    </group>
  ));
}
// Low cover inside the arena (sandbags, crates, barriers). Visual only.
const COVER = [
  [-30, 20, 0], [30, 22, 0.4], [-48, -10, 1.2], [48, -14, -0.8], [-26, -55, 0.3], [28, -60, -0.2], [0, 35, 1.57], [-55, 40, 0.7], [55, 42, -0.6],
];
export function Cover({ color }) {
  return COVER.map(([x, z, r], i) => (
    <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
      {i % 3 === 0 ? (
        [-1.6, 0, 1.6].map((o) => (
          <mesh key={o} position={[o, 0.45, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.42, 1.0, 4, 8]} />
            <meshStandardMaterial color="#9c8b62" roughness={1} />
          </mesh>
        ))
      ) : i % 3 === 1 ? (
        <>
          <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 1.8, 1.8]} />
            <meshStandardMaterial color="#6e5a3a" roughness={0.9} />
          </mesh>
          <mesh position={[1.4, 0.7, 0.4]} rotation={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.4, 1.4, 1.4]} />
            <meshStandardMaterial color="#5f4e33" roughness={0.9} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1.1, 0.7]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      )}
    </group>
  ));
}
