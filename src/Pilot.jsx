import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** A human-scale pilot, distinct from the much larger Titan silhouette. */
export function Pilot({ paint, moving = false }) {
  const legs = useRef([]);
  const clock = useRef(0);
  const suit = paint?.secondary || "#36424b";
  const plates = paint?.primary || "#71818b";
  const visor = paint?.visor || "#5de8ff";
  useFrame((_, dt) => {
    clock.current += dt * (moving ? 9 : 2);
    const swing = moving ? Math.sin(clock.current) * 0.45 : 0;
    if (legs.current[0]) legs.current[0].rotation.x = swing;
    if (legs.current[1]) legs.current[1].rotation.x = -swing;
  });
  return (
    <group>
      <mesh position={[0, 1.08, 0]} scale={[0.4, 0.55, 0.29]} castShadow>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={suit} roughness={0.72} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.2, -0.2]} scale={[0.34, 0.35, 0.16]} castShadow>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={plates} roughness={0.42} metalness={0.55} />
      </mesh>
      <mesh position={[0, 1.12, 0.28]} scale={[0.36, 0.38, 0.12]} castShadow>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={plates} roughness={0.42} metalness={0.55} />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow>
        <sphereGeometry args={[0.31, 16, 12]} />
        <meshStandardMaterial color={plates} roughness={0.32} metalness={0.55} />
      </mesh>
      <mesh position={[0, 1.81, -0.18]} scale={[0.28, 0.17, 0.17]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={visor} emissive={visor} emissiveIntensity={0.4} metalness={0.2} roughness={0.08} />
      </mesh>
      {[-1, 1].map((side, i) => (
        <group key={side}>
          <mesh position={[side * 0.48, 1.17, 0]} rotation={[0, 0, side * 0.2]} castShadow>
            <capsuleGeometry args={[0.12, 0.55, 4, 8]} />
            <meshStandardMaterial color={suit} roughness={0.68} />
          </mesh>
          <mesh position={[side * 0.46, 1.38, 0]} scale={[0.22, 0.2, 0.24]} castShadow>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={plates} metalness={0.52} roughness={0.38} />
          </mesh>
          <group ref={(g) => (legs.current[i] = g)} position={[side * 0.2, 0.67, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow>
              <capsuleGeometry args={[0.15, 0.55, 4, 8]} />
              <meshStandardMaterial color={suit} roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.59, -0.09]} scale={[0.18, 0.11, 0.3]} castShadow>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={plates} metalness={0.4} roughness={0.5} />
            </mesh>
          </group>
        </group>
      ))}
      <mesh position={[0, 1.14, 0.46]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color={visor} emissive={visor} emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}
