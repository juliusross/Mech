import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { classOf } from "../shared/arena.js";
import { DEFAULT_PAINT } from "../shared/planets.js";

// Procedural Titan: articulated legs with a walk cycle, layered armour plates,
// shoulder pauldrons, an arm cannon and back thrusters. Walk speed is read from
// how far the mech actually moved, so remote pilots animate too.
const tmp = new THREE.Vector3();

function Part({ size, position, rotation, color, metal = 0.65, rough = 0.42, emissive, glow = 0 }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={metal}
        roughness={rough}
        emissive={emissive || "#000000"}
        emissiveIntensity={glow}
      />
    </mesh>
  );
}

function Leg({ side, paint, legRef, shinRef, dark }) {
  return (
    <group ref={legRef} position={[side * 0.62, 0, 0]}>
      {/* hip joint */}
      <mesh castShadow>
        <sphereGeometry args={[0.36, 14, 10]} />
        <meshStandardMaterial color={dark} metalness={0.8} roughness={0.35} />
      </mesh>
      <Part size={[0.58, 1.15, 0.7]} position={[0, -0.62, 0]} color={paint.secondary} />
      <Part size={[0.62, 0.7, 0.18]} position={[0, -0.55, -0.4]} color={paint.primary} />
      <group ref={shinRef} position={[0, -1.22, 0]}>
        {/* knee */}
        <mesh castShadow>
          <sphereGeometry args={[0.3, 12, 10]} />
          <meshStandardMaterial color={dark} metalness={0.8} roughness={0.35} />
        </mesh>
        <Part size={[0.5, 1.15, 0.62]} position={[0, -0.6, 0.04]} color={paint.secondary} />
        <Part
          size={[0.56, 0.95, 0.16]}
          position={[0, -0.5, -0.36]}
          rotation={[0.08, 0, 0]}
          color={paint.primary}
        />
        {/* piston */}
        <mesh position={[0, -0.55, 0.38]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.9, 8]} />
          <meshStandardMaterial color="#c9d2da" metalness={0.95} roughness={0.2} />
        </mesh>
        {/* foot */}
        <Part size={[0.78, 0.26, 1.3]} position={[0, -1.22, -0.18]} color={dark} />
        <Part size={[0.66, 0.16, 0.42]} position={[0, -1.12, -0.78]} rotation={[-0.35, 0, 0]} color={paint.secondary} />
      </group>
    </group>
  );
}

export function Mech({
  paint = DEFAULT_PAINT,
  cls,
  down = false,
  fused = false,
  pitch = 0,
  thrust = false,
  idle = false,
}) {
  const spec = classOf(cls);
  const root = useRef();
  const body = useRef();
  const torso = useRef();
  const legL = useRef();
  const legR = useRef();
  const shinL = useRef();
  const shinR = useRef();
  const flame = useRef();
  const phase = useRef(0);
  const stride = useRef(0);
  const last = useRef(null);
  const colors = useMemo(() => {
    const base = down ? { primary: "#3a3f47", secondary: "#2b3038", visor: "#40464f" } : paint;
    return { ...base, dark: down ? "#22262c" : "#1d2733" };
  }, [paint, down]);

  useFrame((_, dt) => {
    if (!root.current) return;
    root.current.getWorldPosition(tmp);
    let speed = 0;
    if (last.current && dt > 0) {
      const dx = tmp.x - last.current.x,
        dz = tmp.z - last.current.z;
      speed = Math.hypot(dx, dz) / dt;
    }
    last.current = tmp.clone();
    const airborne = tmp.y > 0.15;
    const target = down || airborne || idle ? 0 : Math.min(1, speed / 8);
    stride.current += (target - stride.current) * Math.min(1, dt * 8);
    phase.current += dt * (4 + speed * 0.55);
    const a = stride.current;
    const sw = Math.sin(phase.current);
    if (legL.current) legL.current.rotation.x = sw * 0.55 * a + (airborne ? -0.25 : 0);
    if (legR.current) legR.current.rotation.x = -sw * 0.55 * a + (airborne ? 0.2 : 0);
    if (shinL.current) shinL.current.rotation.x = Math.max(0, -sw) * 0.8 * a + (airborne ? 0.5 : 0);
    if (shinR.current) shinR.current.rotation.x = Math.max(0, sw) * 0.8 * a + (airborne ? 0.4 : 0);
    if (body.current) {
      body.current.position.y = 2.55 + Math.abs(sw) * 0.09 * a + (idle ? Math.sin(phase.current * 0.4) * 0.03 : 0);
      body.current.rotation.z = sw * 0.03 * a;
    }
    if (torso.current) {
      torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, pitch * 0.6, Math.min(1, dt * 10));
      torso.current.rotation.y = -sw * 0.06 * a;
    }
    if (flame.current) {
      const s = thrust ? 1 + Math.random() * 0.35 : 0.001;
      flame.current.scale.set(1, s, 1);
    }
  });

  const scale = spec.scale * (fused ? 1.8 : 1);
  const heavy = cls === "heavy";
  return (
    <group ref={root} scale={scale} rotation={[down ? -0.5 : 0, 0, 0]}>
      <group ref={body} position={[0, 2.55, 0]}>
        {/* pelvis */}
        <Part size={[1.45, 0.5, 0.9]} position={[0, 0, 0]} color={colors.dark} />
        <Part size={[0.9, 0.42, 0.2]} position={[0, -0.05, -0.5]} color={colors.primary} />
        <Leg side={-1} paint={colors} legRef={legL} shinRef={shinL} dark={colors.dark} />
        <Leg side={1} paint={colors} legRef={legR} shinRef={shinR} dark={colors.dark} />
        <group ref={torso} position={[0, 0.35, 0]}>
          {/* chest core and plates */}
          <Part size={[1.9, 1.35, 1.25]} position={[0, 0.85, 0]} color={colors.secondary} />
          <Part size={[0.95, 1.1, 0.25]} position={[-0.47, 0.95, -0.66]} rotation={[0.12, 0.25, 0]} color={colors.primary} />
          <Part size={[0.95, 1.1, 0.25]} position={[0.47, 0.95, -0.66]} rotation={[0.12, -0.25, 0]} color={colors.primary} />
          <Part size={[1.5, 0.28, 0.9]} position={[0, 0.2, -0.05]} color={colors.dark} />
          {/* cockpit glow */}
          <Part size={[0.7, 0.16, 0.1]} position={[0, 1.18, -0.86]} color={colors.visor} emissive={colors.visor} glow={down ? 0 : 1.8} />
          {/* head */}
          <Part size={[0.42, 0.3, 0.42]} position={[0, 1.65, 0.05]} color={colors.dark} />
          <Part size={[0.85, 0.55, 0.8]} position={[0, 1.95, -0.05]} color={colors.secondary} />
          <Part size={[0.9, 0.18, 0.12]} position={[0, 1.98, -0.48]} color={colors.visor} emissive={colors.visor} glow={down ? 0 : 2.2} />
          <mesh position={[0.3, 2.45, 0.15]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.7, 6]} />
            <meshStandardMaterial color="#9aa5b1" metalness={0.9} />
          </mesh>
          {/* pauldrons */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 1.32, 1.3, 0]}>
              <Part size={[0.95, 0.55, 1.15]} rotation={[0, 0, s * -0.22]} color={colors.primary} />
              <Part size={[0.55, 1.0, 0.6]} position={[s * 0.05, -0.75, 0]} color={colors.secondary} />
            </group>
          ))}
          {/* left forearm shield */}
          <Part size={[0.25, 1.3, 1.05]} position={[-1.55, 0.25, -0.15]} color={colors.primary} />
          {/* right arm cannon */}
          <group position={[1.4, 0.35, -0.25]}>
            <Part size={[0.6, 0.6, 1.0]} color={colors.dark} />
            <mesh position={[0, 0, -1.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={heavy ? [0.34, 0.42, 1.8, 14] : [0.2, 0.26, 1.6, 14]} />
              <meshStandardMaterial color="#1a222c" metalness={0.9} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0, -1.9]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[heavy ? 0.36 : 0.22, 0.05, 6, 18]} />
              <meshStandardMaterial color={colors.visor} emissive={colors.visor} emissiveIntensity={down ? 0 : 1.5} />
            </mesh>
          </group>
          {/* backpack and thrusters */}
          <Part size={[1.3, 1.1, 0.55]} position={[0, 0.95, 0.85]} color={colors.dark} />
          {[-0.38, 0.38].map((x) => (
            <group key={x} position={[x, 0.45, 1.05]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.2, 0.26, 0.5, 12]} />
                <meshStandardMaterial color="#2c3642" metalness={0.85} roughness={0.3} />
              </mesh>
            </group>
          ))}
          <group ref={flame} position={[0, 0.15, 1.05]}>
            {[-0.38, 0.38].map((x) => (
              <mesh key={x} position={[x, -0.45, 0]}>
                <coneGeometry args={[0.2, 0.9, 10]} />
                <meshBasicMaterial color="#7fd8ff" transparent opacity={0.75} />
              </mesh>
            ))}
          </group>
          {cls === "support" && (
            <Part size={[0.6, 0.6, 0.1]} position={[0, 1.0, 1.15]} color="#5dff9a" emissive="#1fbf5a" glow={1.4} />
          )}
        </group>
      </group>
    </group>
  );
}
