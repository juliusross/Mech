import React, { memo, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
import * as THREE from "three";
import { planetOf, STRIKE_RADIUS } from "../shared/planets.js";
import { layoutFor } from "./world/layout.js";
import { Trees, Bushes, Grass, Rocks } from "./world/Vegetation.jsx";
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
} from "./world/Structures.jsx";
import { Ocean, Lake, River, LavaRivers } from "./world/Water.jsx";
import { Weather } from "./world/Weather.jsx";

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

function Ground({ a, b }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(900, 900, 90, 90);
    const ca = new THREE.Color(a),
      cb = new THREE.Color(b),
      c = new THREE.Color();
    const colors = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i);
      const n = (Math.sin(x * 0.045) + Math.cos(y * 0.037) + Math.sin((x + y) * 0.021)) / 3;
      c.copy(ca).lerp(cb, 0.5 + n * 0.5);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [a, b]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -10]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
    </mesh>
  );
}

const World = memo(function World({ planet }) {
  const P = planetOf(planet);
  const L = layoutFor(planet);
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
      <hemisphereLight args={[L.day ? "#dbeeff" : P.sun, P.ground, L.day ? 0.75 : P.ambient * 0.8]} />
      <ambientLight intensity={L.day ? 0.25 : P.ambient * 0.3} />
      <Sun dir={L.sun} color={P.sun} intensity={L.day ? 3.1 : dusk ? 1.6 : 0.9} />
      {planet === "selene" && <Stars radius={260} depth={60} count={3500} factor={6} fade />}
      <Ground a={L.ground} b={L.groundAlt} />
      <gridHelper args={[136, 34, P.grid[0], P.grid[1]]} position={[0, 0.02, -10]} />
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
      <Trees trees={L.trees || []} snowy={planet === "cryo"} />
      {L.bushes && <Bushes bushes={L.bushes} />}
      {L.grass?.length > 0 && <Grass grass={L.grass} />}
      <Rocks rocks={L.rocks || []} color={P.rock} />
      {L.cover && <Cover color={P.rock} />}
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
