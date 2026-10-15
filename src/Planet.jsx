import React, { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky, Stars, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { planetOf, STRIKE_RADIUS } from "../shared/planets.js";
import { layoutFor } from "./world/layout.js";
import { Trees, Bushes, Grass, Rocks, Flowers, Ferns, Reeds } from "./world/Vegetation.jsx";
import {
  Roads,
  Buildings,
  Houses,
  ConstructionSites,
  Temples,
  Huts,
  Colony,
  Volcano,
  Stacks,
  Mountains,
  Bridges,
  Cover,
  ArenaStructures,
} from "./world/Structures.jsx";
import { Ocean, Lake, River, LavaRivers } from "./world/Water.jsx";
import { Weather } from "./world/Weather.jsx";
import { terrainMaps } from "./world/materials.js";
import { terrainHeight } from "../shared/terrain.js";
import { Instanced } from "./world/Instanced.jsx";

const WEATHER = { ember: "ash", cryo: "snow", tempest: "rain", verdant: "drizzle" };


function Lava({ zone }) {
  const mat = useRef();
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 2 + zone.x) * 0.4;
  });
  return (
    <group position={[zone.x, 0.05, zone.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[zone.r, 40]} />
        <meshStandardMaterial ref={mat} color="#ff5a1a" emissive="#ff3a00" emissiveIntensity={1.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[zone.r, zone.r + 0.8, 40]} />
        <meshStandardMaterial color="#1a0d08" roughness={1} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#ff6a2a" intensity={12} distance={zone.r * 3} />
    </group>
  );
}

function StrikeZone({ strike }) {
  const ring = useRef();
  useFrame(({ clock }) => {
    if (ring.current) ring.current.material.opacity = 0.35 + Math.sin(clock.elapsedTime * 18) * 0.25;
  });
  return (
    <group position={[strike.p[0], 0.08, strike.p[2]]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[STRIKE_RADIUS, 36]} />
        <meshBasicMaterial color="#9fc3ff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Sun that follows the camera so nearby shadows stay sharp. */
function Sun({ dir, color, intensity }) {
  const light = useRef();
  const { camera } = useThree();
  const d = useMemo(() => new THREE.Vector3(...dir).normalize(), [dir]);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const fx = Math.round(camera.position.x / 4) * 4,
      fz = Math.round(camera.position.z / 4) * 4;
    l.target.position.set(fx, 0, fz);
    l.position.set(fx + d.x * 120, d.y * 120, fz + d.z * 120);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      color={color}
      intensity={intensity}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
      shadow-camera-near={10}
      shadow-camera-far={320}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    />
  );
}

function Ground({ a, b, planet }) {
  const maps = useMemo(() => terrainMaps(planet), [planet]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(900, 900, 225, 225);
    const ca = new THREE.Color(a),
      cb = new THREE.Color(b),
      c = new THREE.Color();
    const colors = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i);
      const elevation = terrainHeight(planet, x, -y - 10);
      p.setZ(i, elevation);
      const n = (Math.sin(x * 0.045) + Math.cos(y * 0.037) + Math.sin((x + y) * 0.021)) / 3;
      c.copy(ca).lerp(cb, Math.min(0.9, 0.5 + n * 0.3 + elevation * 0.007));
      colors.push(c.r, c.g, c.b);
    }
    p.needsUpdate = true;
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [a, b, planet]);
  useEffect(() => () => {
    geo.dispose();
    Object.values(maps).forEach((texture) => texture.dispose());
  }, [geo, maps]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -10]} receiveShadow>
      <meshStandardMaterial vertexColors map={maps.map} roughnessMap={maps.roughnessMap} normalMap={maps.normalMap} normalScale={[0.35, 0.35]} roughness={1} metalness={0.02} />
    </mesh>
  );
}

function HillScenery({ planet, color }) {
  const features = useMemo(() => {
    const rocks = [], trees = [];
    // Fixed positions keep the expanded map identical for every pilot.
    for (let i = 0; i < 360; i++) {
      const x = Math.sin(i * 127.1 + planet.length) * 378;
      const z = Math.sin(i * 311.7 + 8.1) * 378;
      if ((planet === "proving" && x > 115) || (planet === "verdant" && z > 195)) continue;
      const y = terrainHeight(planet, x, z);
      if (y < 3.5) continue;
      const s = 0.8 + (i % 7) * 0.21;
      if (i % 3 === 0 && ["proving", "cryo", "verdant"].includes(planet)) trees.push({ x, y, z, s });
      else rocks.push({ x, y, z, s });
    }
    return { rocks, trees };
  }, [planet]);
  return <>
    <Instanced items={features.rocks} place={(r) => ({ p: [r.x, r.y + r.s * 0.7, r.z], s: [r.s * 1.7, r.s, r.s * 1.4], r: [0.12, r.x, 0.18] })}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </Instanced>
    <Instanced items={features.trees} place={(t) => ({ p: [t.x, t.y + t.s * 3.2, t.z], s: [t.s * 2, t.s * 4.8, t.s * 2] })}>
      <coneGeometry args={[1, 1, 8]} />
      <meshStandardMaterial color={planet === "cryo" ? "#3c665a" : "#315c37"} roughness={1} />
    </Instanced>
  </>;
}

const World = memo(function World({ planet }) {
  const P = planetOf(planet);
  const L = layoutFor(planet);
  const vegetation = useMemo(() => {
    const raised = (items = []) => items.map((item) => ({ ...item, elevation: terrainHeight(planet, item.x, item.z) }));
    return {
      trees: raised(L.trees),
      bushes: raised(L.bushes),
      grass: raised(L.grass),
      rocks: raised(L.rocks),
      flowers: raised(L.flowers),
      ferns: raised(L.ferns),
      reeds: raised(L.reeds),
    };
  }, [L, planet]);
  const dusk = planet === "ember";
  return (
    <>
      {L.day ? (
        <Sky
          distance={4500}
          sunPosition={L.sun}
          turbidity={L.hazy ? 9 : 3.5}
          rayleigh={L.hazy ? 2.5 : 1.1}
          mieCoefficient={0.006}
          mieDirectionalG={0.85}
        />
      ) : (
        <color attach="background" args={[P.sky]} />
      )}
      <fog attach="fog" args={[P.sky, ...P.fog]} />
      {/* Image-based light from planet-tinted light panels: reflections on
          metal and softer fill, generated locally (no HDR download). */}
      <Environment resolution={128} frames={1} environmentIntensity={L.day ? 0.9 : 0.6}>
        <Lightformer form="rect" intensity={L.day ? 3 : 1.4} color={L.day ? "#ffffff" : P.sun} scale={[60, 20, 1]} position={[0, 30, -40]} />
        <Lightformer form="rect" intensity={1.2} color={P.sky} scale={[80, 10, 1]} position={[0, 8, 50]} rotation={[0, Math.PI, 0]} />
        <Lightformer form="ring" intensity={L.day ? 4 : 1.6} color={P.sun} scale={14} position={[L.sun[0] * 0.3, L.sun[1] * 0.3, L.sun[2] * 0.3]} />
        <Lightformer form="rect" intensity={0.6} color={P.ground} scale={[100, 100, 1]} position={[0, -10, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </Environment>
      <hemisphereLight args={[L.day ? "#dbeeff" : P.sun, P.ground, L.day ? 0.75 : P.ambient * 0.8]} />
      <ambientLight intensity={L.day ? 0.25 : P.ambient * 0.3} />
      <Sun dir={L.sun} color={P.sun} intensity={L.day ? 3.1 : dusk ? 1.6 : 0.9} />
      {planet === "selene" && <Stars radius={260} depth={60} count={3500} factor={6} fade />}
      <Ground a={L.ground} b={L.groundAlt} planet={planet} />
      <HillScenery planet={planet} color={P.rock} />
      <Mountains
        color={planet === "cryo" ? "#c9d9e4" : planet === "verdant" ? "#2f4a33" : planet === "ember" ? "#24140f" : planet === "selene" ? "#46484f" : "#55646d"}
        snow={planet === "cryo" || planet === "proving"}
        seed={planet.length}
      />
      {L.ocean && <Ocean ocean={L.ocean} beach={L.beach} />}
      {L.lake && <Lake lake={L.lake} />}
      {L.river && <River river={L.river} color={planet === "verdant" ? "#2f6f5e" : "#2e5a7a"} />}
      {L.lavaRivers && <LavaRivers rivers={L.lavaRivers} />}
      <Roads roads={L.roads} snowy={planet === "cryo"} streetlights={L.streetlights || planet === "proving"} />
      {L.bridges && <Bridges bridges={L.bridges} />}
      {L.buildings && <Buildings buildings={L.buildings} night={!L.day} />}
      {L.houses && <Houses houses={L.houses} />}
      {L.construction && <ConstructionSites sites={L.construction} />}
      {L.temples && <Temples temples={L.temples} />}
      {L.huts && <Huts huts={L.huts} />}
      {(L.domes || L.modules) && <Colony domes={L.domes} modules={L.modules} pads={L.pads} earth={L.earth} />}
      <Volcano v={L.volcano} />
      {L.stacks && <Stacks stacks={L.stacks} />}
      {L.craters && (
        <>
          {L.craters.map((c, i) => (
            <mesh key={i} position={[c.x, 0.03, c.z]} rotation={[-Math.PI / 2, 0, 0]} scale={c.s}>
              <ringGeometry args={[2.2, 3.2, 28]} />
              <meshStandardMaterial color="#6a6d75" roughness={1} />
            </mesh>
          ))}
        </>
      )}
      <Trees trees={vegetation.trees} snowy={planet === "cryo"} />
      {L.bushes && <Bushes bushes={vegetation.bushes} />}
      {L.grass?.length > 0 && <Grass grass={vegetation.grass} />}
      {L.flowers && <Flowers flowers={vegetation.flowers} />}
      {L.ferns && <Ferns ferns={vegetation.ferns} />}
      {L.reeds && <Reeds reeds={vegetation.reeds} />}
      <Rocks rocks={vegetation.rocks} color={P.rock} />
      {L.cover && <Cover color={P.rock} />}
      <ArenaStructures planet={planet} />
      {(P.lava || []).map((z, i) => (
        <Lava key={i} zone={z} />
      ))}
      <Weather kind={WEATHER[planet]} lightning={planet === "tempest"} />
    </>
  );
});

export function PlanetScene({ planet, strikes = [] }) {
  return (
    <>
      <World planet={planet} />
      {strikes.map((st) => (
        <StrikeZone key={st.id} strike={st} />
      ))}
    </>
  );
}
