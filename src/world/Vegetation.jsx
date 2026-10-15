import React, { useMemo } from "react";
import { Instanced } from "./Instanced.jsx";

// Placement functions live at module scope so instance matrices are only
// rebuilt when the item lists change.
const trunk = (h, r = 0.35) => (t) => ({ p: [t.x, (h * t.s) / 2, t.z], s: [t.s, t.s, t.s], r: [0, t.r, 0] });
const P = {
  oakTrunk: trunk(5),
  oakCrown: (t) => ({ p: [t.x, 6.2 * t.s, t.z], s: [2.6 * t.s, 2.2 * t.s, 2.6 * t.s], r: [0, t.r, 0], c: t.r > 3 ? "#4e7d34" : "#5b8c3a" }),
  oakCrown2: (t) => ({ p: [t.x + 1.1 * t.s, 5.2 * t.s, t.z - 0.6 * t.s], s: [1.8 * t.s, 1.6 * t.s, 1.8 * t.s], r: [0, t.r, 0], c: "#466f2f" }),
  pineTrunk: trunk(3),
  pine1: (t) => ({ p: [t.x, 4 * t.s, t.z], s: [2.6 * t.s, 4 * t.s, 2.6 * t.s], r: [0, t.r, 0] }),
  pine2: (t) => ({ p: [t.x, 6.6 * t.s, t.z], s: [2 * t.s, 3.4 * t.s, 2 * t.s], r: [0, t.r, 0] }),
  pine3: (t) => ({ p: [t.x, 8.8 * t.s, t.z], s: [1.3 * t.s, 2.6 * t.s, 1.3 * t.s], r: [0, t.r, 0] }),
  snowCap: (t) => ({ p: [t.x, 9.9 * t.s, t.z], s: [0.7 * t.s, 0.8 * t.s, 0.7 * t.s], r: [0, t.r, 0] }),
  palmTrunk: (t) => ({ p: [t.x + 0.4 * t.s, 4 * t.s, t.z], s: [t.s, t.s, t.s], r: [0, t.r, 0.12] }),
  deadTrunk: trunk(6),
  deadBranch: (t) => ({ p: [t.x + 0.8 * t.s, 4.5 * t.s, t.z], s: [t.s, t.s, t.s], r: [0, t.r, -0.9] }),
  deadBranch2: (t) => ({ p: [t.x - 0.6 * t.s, 3.4 * t.s, t.z], s: [t.s * 0.8, t.s * 0.8, t.s * 0.8], r: [0, t.r, 0.8] }),
  jungleTrunk: trunk(11),
  jungleCanopy: (t) => ({ p: [t.x, 11.5 * t.s, t.z], s: [5 * t.s, 2 * t.s, 5 * t.s], r: [0, t.r, 0], c: t.r > 3 ? "#2d6a35" : "#3a7a3c" }),
  jungleLower: (t) => ({ p: [t.x - 1.2 * t.s, 6.5 * t.s, t.z + 0.8 * t.s], s: [2.6 * t.s, 1.4 * t.s, 2.6 * t.s], r: [0, t.r, 0], c: "#2a5a2e" }),
  bush: (b) => ({ p: [b.x, 0.6 * b.s, b.z], s: [1.6 * b.s, 1.1 * b.s, 1.6 * b.s], r: [0, b.r, 0], c: b.r > 3 ? "#2f6b33" : "#3c7a39" }),
  grass: (g) => ({ p: [g.x, 0.22 * g.s, g.z], s: [0.14 * g.s, 0.45 * g.s, 0.14 * g.s], r: [0.15, g.r, 0], c: g.c }),
  rock: (r) => ({ p: [r.x, 0.8 * r.s, r.z], s: [1.8 * r.s, 1.3 * r.s, 1.5 * r.s], r: [r.r * 0.3, r.r, 0] }),
};
// Palm fronds: six leaves per palm, fanned around the crown.
const FRONDS = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2);

export function Trees({ trees, snowy }) {
  const by = useMemo(() => {
    const g = { oak: [], pine: [], palm: [], dead: [], jungle: [] };
    for (const t of trees) g[t.kind]?.push(t);
    return g;
  }, [trees]);
  const fronds = useMemo(() => by.palm.flatMap((t) => FRONDS.map((a) => ({ ...t, a }))), [by]);
  const frondPlace = useMemo(
    () => (f) => ({
      p: [f.x + 0.8 * f.s + Math.sin(f.a + f.r) * 1.6 * f.s, 7.9 * f.s, f.z + Math.cos(f.a + f.r) * 1.6 * f.s],
      s: [0.8 * f.s, 0.12 * f.s, 3.4 * f.s],
      r: [0.35, f.a + f.r, 0],
    }),
    [],
  );
  return (
    <>
      <Instanced items={by.oak} place={P.oakTrunk}>
        <cylinderGeometry args={[0.28, 0.42, 5, 7]} />
        <meshStandardMaterial color="#5a4330" roughness={0.95} />
      </Instanced>
      <Instanced items={by.oak} place={P.oakCrown}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
      </Instanced>
      <Instanced items={by.oak} place={P.oakCrown2}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
      </Instanced>

      <Instanced items={by.pine} place={P.pineTrunk}>
        <cylinderGeometry args={[0.25, 0.38, 3, 6]} />
        <meshStandardMaterial color="#4a3526" roughness={0.95} />
      </Instanced>
      {[P.pine1, P.pine2, P.pine3].map((place, i) => (
        <Instanced key={i} items={by.pine} place={place}>
          <coneGeometry args={[1, 1, 8]} />
          <meshStandardMaterial color={snowy ? "#2f5a45" : "#2e5b3a"} roughness={0.9} flatShading />
        </Instanced>
      ))}
      {snowy && (
        <Instanced items={by.pine} place={P.snowCap}>
          <coneGeometry args={[1, 1, 8]} />
          <meshStandardMaterial color="#f4f8fb" roughness={0.6} />
        </Instanced>
      )}

      <Instanced items={by.palm} place={P.palmTrunk}>
        <cylinderGeometry args={[0.22, 0.34, 8, 7]} />
        <meshStandardMaterial color="#8a6a45" roughness={0.9} />
      </Instanced>
      <Instanced items={fronds} place={frondPlace}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3f8a3a" roughness={0.8} />
      </Instanced>

      <Instanced items={by.dead} place={P.deadTrunk}>
        <cylinderGeometry args={[0.15, 0.35, 6, 6]} />
        <meshStandardMaterial color="#2a201b" roughness={1} />
      </Instanced>
      <Instanced items={by.dead} place={P.deadBranch}>
        <cylinderGeometry args={[0.06, 0.14, 2.4, 5]} />
        <meshStandardMaterial color="#2a201b" roughness={1} />
      </Instanced>
      <Instanced items={by.dead} place={P.deadBranch2}>
        <cylinderGeometry args={[0.06, 0.12, 2, 5]} />
        <meshStandardMaterial color="#2a201b" roughness={1} />
      </Instanced>

      <Instanced items={by.jungle} place={P.jungleTrunk}>
        <cylinderGeometry args={[0.3, 0.6, 11, 7]} />
        <meshStandardMaterial color="#4b3a2a" roughness={0.95} />
      </Instanced>
      <Instanced items={by.jungle} place={P.jungleCanopy}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} flatShading />
      </Instanced>
      <Instanced items={by.jungle} place={P.jungleLower}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} flatShading />
      </Instanced>
    </>
  );
}

export function Bushes({ bushes }) {
  return (
    <Instanced items={bushes} place={P.bush}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
    </Instanced>
  );
}

export function Grass({ grass }) {
  return (
    <Instanced items={grass} place={P.grass} castShadow={false}>
      <coneGeometry args={[1, 1, 3]} />
      <meshStandardMaterial color="#ffffff" roughness={1} />
    </Instanced>
  );
}

export function Rocks({ rocks, color }) {
  return (
    <Instanced items={rocks} place={P.rock}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </Instanced>
  );
}
