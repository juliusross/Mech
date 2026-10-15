import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** A flat ribbon following a polyline (rivers, lava flows, river banks). */
function ribbon(points, width, y) {
  const pos = [],
    idx = [];
  const pts = [];
  // Densify with Catmull-Rom so the river curves smoothly.
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, y, z)));
  const n = points.length * 12;
  for (let i = 0; i <= n; i++) pts.push(curve.getPoint(i / n));
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l,
      nz = dx / l;
    const wob = width * (1 + Math.sin(i * 0.7) * 0.12);
    pos.push(p.x + (nx * wob) / 2, y, p.z + (nz * wob) / 2, p.x - (nx * wob) / 2, y, p.z - (nz * wob) / 2);
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function useWaves(geo, amp, speed) {
  const base = useMemo(() => geo.attributes.position.array.slice(), [geo]);
  useFrame(({ clock }) => {
    const p = geo.attributes.position;
    const t = clock.elapsedTime * speed;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3],
        y = base[i * 3 + 1];
      p.array[i * 3 + 2] = base[i * 3 + 2] + Math.sin(x * 0.08 + t) * amp + Math.cos(y * 0.11 + t * 1.3) * amp * 0.6;
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  });
}

export function Ocean({ ocean, beach }) {
  const w = ocean.x1 - ocean.x0,
    d = ocean.z1 - ocean.z0;
  const geo = useMemo(() => new THREE.PlaneGeometry(w, d, 60, 60), [w, d]);
  useWaves(geo, 0.12, 1.2);
  return (
    <>
      {beach && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(beach.x0 + beach.x1) / 2, 0.04, (beach.z0 + beach.z1) / 2]} receiveShadow>
          <planeGeometry args={[beach.x1 - beach.x0, beach.z1 - beach.z0]} />
          <meshStandardMaterial color={beach.color} roughness={1} />
        </mesh>
      )}
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[(ocean.x0 + ocean.x1) / 2, 0.22, (ocean.z0 + ocean.z1) / 2]} receiveShadow>
        <meshStandardMaterial color={ocean.color} metalness={0.25} roughness={0.12} transparent opacity={0.92} />
      </mesh>
    </>
  );
}

export function Lake({ lake }) {
  return (
    <group position={[lake.x, 0.05, lake.z]} scale={[lake.rx, 1, lake.rz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color={lake.color} metalness={lake.ice ? 0.4 : 0.2} roughness={lake.ice ? 0.05 : 0.15} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[1, 1.06, 48]} />
        <meshStandardMaterial color="#f4f8fb" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function River({ river, color = "#2e6f8e" }) {
  const water = useMemo(() => ribbon(river.points, river.w, 0.06), [river]);
  const bank = useMemo(() => ribbon(river.points, river.w + 8, 0.035), [river]);
  const mat = useRef();
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime * 1.5) * 0.04;
  });
  return (
    <>
      <mesh geometry={bank} receiveShadow>
        <meshStandardMaterial color="#6b5d45" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={water} receiveShadow>
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.12} metalness={0.3} roughness={0.08} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

export function LavaRivers({ rivers = [] }) {
  const geos = useMemo(() => rivers.map((pts) => ribbon(pts, 9, 0.07)), [rivers]);
  const crust = useMemo(() => rivers.map((pts) => ribbon(pts, 15, 0.04)), [rivers]);
  const mat = useRef();
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 1.6 + Math.sin(clock.elapsedTime * 2.2) * 0.5;
  });
  return (
    <>
      {crust.map((g, i) => (
        <mesh key={`c${i}`} geometry={g}>
          <meshStandardMaterial color="#120806" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial ref={i === 0 ? mat : undefined} color="#ff5a1a" emissive="#ff3a00" emissiveIntensity={1.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}
