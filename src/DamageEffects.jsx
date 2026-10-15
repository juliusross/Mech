import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

let softDisc;
function discTexture() {
  if (softDisc) return softDisc;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,.75)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  softDisc = new THREE.CanvasTexture(canvas);
  softDisc.colorSpace = THREE.SRGBColorSpace;
  return softDisc;
}

function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function seedFor(value) {
  const key = String(value);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return hash >>> 0;
}

// One instanced draw call for the flying metal sparks; soft sprites give smoke
// and flame feathered edges without requiring downloaded texture assets.
export function ImpactParticles({ effect, age }) {
  const burst = effect.kind !== "hit";
  const count = burst ? 24 : 14;
  const randomData = useMemo(() => {
    const rand = random(seedFor(effect.id));
    return Array.from({ length: count }, () => {
      const angle = rand() * Math.PI * 2;
      const speed = (burst ? 4.5 : 2.7) + rand() * (burst ? 7 : 5);
      return {
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 1.8 + rand() * 7, Math.sin(angle) * speed),
        length: 0.16 + rand() * 0.36,
        delay: rand() * 0.16,
        color: new THREE.Color().setHSL(0.04 + rand() * 0.09, 1, 0.55 + rand() * 0.3),
      };
    });
  }, [effect.id, count, burst]);
  const sparks = useRef();
  const smoke = useRef([]);
  const flame = useRef([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const texture = useMemo(discTexture, []);
  useFrame(() => {
    const t = age.current;
    if (sparks.current) {
      randomData.forEach((p, i) => {
        const a = Math.max(0, t - p.delay);
        const fade = Math.max(0, 1 - a / (burst ? 0.95 : 0.5));
        dummy.position.copy(p.velocity).multiplyScalar(a);
        dummy.position.y -= 9 * a * a;
        dummy.rotation.set(0, Math.atan2(p.velocity.x, p.velocity.z), Math.PI / 4);
        dummy.scale.set(0.045 * fade, p.length * fade, 0.045 * fade);
        dummy.updateMatrix();
        sparks.current.setMatrixAt(i, dummy.matrix);
      });
      sparks.current.instanceMatrix.needsUpdate = true;
    }
    smoke.current.forEach((sprite, i) => {
      if (!sprite) return;
      const a = Math.max(0, t - i * 0.075);
      const fade = Math.max(0, 1 - a / (burst ? 1.7 : 0.55));
      const s = (burst ? 0.55 : 0.26) + a * (burst ? 1.7 : 0.8);
      sprite.position.set(Math.sin(i * 12.7) * a * 0.9, a * (burst ? 3.2 : 1.3), Math.cos(i * 8.1) * a * 0.8);
      sprite.scale.setScalar(s * fade);
      sprite.material.opacity = fade * (burst ? 0.33 : 0.17);
    });
    flame.current.forEach((sprite, i) => {
      if (!sprite) return;
      const fade = Math.max(0, 1 - t / (burst ? 0.8 : 0.25));
      sprite.position.set(Math.sin(i * 4.4) * 0.35, 0.4 + t * 2 + i * 0.18, Math.cos(i * 3.1) * 0.35);
      sprite.scale.set(0.8 * fade, (1.3 + i * 0.25) * fade, 1);
      sprite.material.opacity = fade * 0.7;
    });
  });
  return (
    <group position={effect.p}>
      <instancedMesh ref={sparks} args={[null, null, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffb45c" toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: burst ? 8 : 2 }, (_, i) => (
        <sprite key={`smoke-${i}`} ref={(node) => { smoke.current[i] = node; }}>
          <spriteMaterial map={texture} color={i % 3 ? "#353a3b" : "#545457"} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
      {Array.from({ length: burst ? 4 : 1 }, (_, i) => (
        <sprite key={`flame-${i}`} ref={(node) => { flame.current[i] = node; }}>
          <spriteMaterial map={texture} color={i % 2 ? "#ff6b2c" : "#ffd17b"} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  );
}

export function DamageSmoke({ severity = 0.5, position = [0, 2, 0] }) {
  const sprites = useRef([]);
  const flame = useRef();
  const texture = useMemo(discTexture, []);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const phase = (time * (0.45 + severity * 0.25) + i / 4) % 1;
      sprite.position.set(Math.sin(time * 0.9 + i * 2.3) * phase * 0.35, phase * (1.4 + severity), Math.cos(time * 0.6 + i) * phase * 0.3);
      sprite.scale.setScalar((0.4 + phase * 1.4) * (0.6 + severity));
      sprite.material.opacity = Math.sin(Math.PI * phase) * (0.18 + severity * 0.34);
    });
    if (flame.current) {
      const flicker = 0.8 + Math.sin(time * 13) * 0.16;
      flame.current.scale.set(0.35 * flicker, 0.8 * flicker, 1);
      flame.current.material.opacity = Math.max(0, severity - 0.6) * 1.5;
    }
  });
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => (
        <sprite key={i} ref={(node) => { sprites.current[i] = node; }}>
          <spriteMaterial map={texture} color="#343637" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
      {severity > 0.6 && <sprite ref={flame}>
        <spriteMaterial map={texture} color="#ff792b" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>}
    </group>
  );
}
