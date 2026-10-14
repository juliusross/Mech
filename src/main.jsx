import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "./style.css";
import { Html } from "@react-three/drei";
import { useMultiplayer } from "./multiplayer";
import { RoomPanel } from "./RoomPanel";
const INITIAL_TARGETS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: ((i % 4) - 1.5) * 9,
  z: -15 - Math.floor(i / 4) * 12,
  hp: 3,
}));
function Titan({ position, heading, color = "#e17b35" }) {
  return (
    <group position={position} rotation={[0, heading, 0]}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[2.2, 2.2, 1.35]} />
        <meshStandardMaterial color="#405775" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[1.2, 1, 0.95]} />
        <meshStandardMaterial color="#9da9b6" metalness={0.7} />
      </mesh>
      <mesh position={[0, 4.15, -0.51]}>
        <boxGeometry args={[0.85, 0.2, 0.08]} />
        <meshStandardMaterial
          color="#00d9ff"
          emissive="#008cbb"
          emissiveIntensity={2}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.55, 2.5, 0]}>
            <boxGeometry args={[0.9, 2.1, 1]} />
            <meshStandardMaterial color={color} metalness={0.65} />
          </mesh>
          <mesh position={[s * 0.65, 0.85, 0]}>
            <boxGeometry args={[0.85, 1.7, 1]} />
            <meshStandardMaterial color="#64758a" metalness={0.6} />
          </mesh>
          <mesh position={[s * 0.65, 0.18, -0.3]}>
            <boxGeometry args={[1.1, 0.4, 1.6]} />
            <meshStandardMaterial color="#27394b" />
          </mesh>
        </group>
      ))}
      <mesh position={[1.55, 2.4, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.35, 2.3, 12]} />
        <meshStandardMaterial color="#1c2734" metalness={0.8} />
      </mesh>
      <pointLight
        position={[0, 2, -0.8]}
        intensity={3}
        color="#18a8ff"
        distance={5}
      />
    </group>
  );
}
function RemoteTitan({ pilot }) {
  const group = useRef();
  const initialPosition = useRef(pilot.position);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.lerp(
      new THREE.Vector3(...pilot.position),
      1 - Math.exp(-14 * dt),
    );
    const difference = Math.atan2(
      Math.sin(pilot.heading - group.current.rotation.y),
      Math.cos(pilot.heading - group.current.rotation.y),
    );
    group.current.rotation.y += difference * (1 - Math.exp(-14 * dt));
  });
  return (
    <group ref={group} position={initialPosition.current}>
      <Titan position={[0, 0, 0]} heading={0} color={pilot.color} />
      <Html position={[0, 5.3, 0]} center style={{ pointerEvents: "none" }}>
        <span className="pilot-label">{pilot.name}</span>
      </Html>
    </group>
  );
}
function Arena({ controls, mode, onStats, onAmmo, network }) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(...(network.spawn || [0, 0, 8])));
  const yaw = useRef(0);
  const velY = useRef(0);
  const [visual, setVisual] = useState([0, 0, 8]);
  const [angle, setAngle] = useState(0);
  const targets = useRef(INITIAL_TARGETS.map((t) => ({ ...t })));
  const [targetVisual, setTargetVisual] = useState(INITIAL_TARGETS);
  const bullets = useRef([]);
  const [bulletVisual, setBulletVisual] = useState([]);
  const cooldown = useRef(0);
  const ammo = useRef(60);
  const destroyed = useRef(0);
  const dodge = useRef(0);
  const burst = useRef(0);
  useEffect(() => {
    const handler = (e) => {
      if (
        !(
          e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,select")
        ) &&
        (e.key === "r" || e.key === "R")
      ) {
        ammo.current = 60;
        onAmmo(60);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const k = controls.current;
    if (k.has("q")) yaw.current += 1.8 * dt;
    if (k.has("e")) yaw.current -= 1.8 * dt;
    const forward = new THREE.Vector3(
      -Math.sin(yaw.current),
      0,
      -Math.cos(yaw.current),
    );
    const right = new THREE.Vector3(
      Math.cos(yaw.current),
      0,
      -Math.sin(yaw.current),
    );
    const move = new THREE.Vector3();
    if (k.has("w") || k.has("arrowup")) move.add(forward);
    if (k.has("s") || k.has("arrowdown")) move.sub(forward);
    if (k.has("d") || k.has("arrowright")) move.add(right);
    if (k.has("a") || k.has("arrowleft")) move.sub(right);
    if (move.lengthSq()) move.normalize();
    const flying = k.has("f");
    if (k.has("shift") && dodge.current <= 0) {
      dodge.current = 1.5;
      burst.current = 0.22;
    }
    const speed = burst.current > 0 ? 25 : 9;
    burst.current -= dt;
    dodge.current -= dt;
    pos.current.addScaledVector(move, speed * dt);
    if (flying) velY.current = 7;
    else if (k.has("control")) velY.current = -7;
    else velY.current -= 17 * dt;
    if (k.has(" ") && pos.current.y < 0.02) velY.current = 9;
    pos.current.y = Math.max(
      0,
      Math.min(45, pos.current.y + velY.current * dt),
    );
    if (pos.current.y === 0) velY.current = 0;
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -65, 65);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -85, 65);
    cooldown.current -= dt;
    if (
      network.status !== "connected" &&
      k.has("mouse") &&
      cooldown.current <= 0 &&
      ammo.current > 0
    ) {
      ammo.current--;
      onAmmo(ammo.current);
      cooldown.current = 0.16;
      const origin = pos.current
        .clone()
        .add(
          new THREE.Vector3(1.55, 2.5, -2.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw.current,
          ),
        );
      bullets.current.push({
        id: Math.random(),
        pos: origin,
        dir: forward.clone(),
        life: 2,
      });
    }
    bullets.current = bullets.current.filter((b) => {
      b.pos.addScaledVector(b.dir, 60 * dt);
      b.life -= dt;
      for (const t of targets.current) {
        if (
          t.hp > 0 &&
          Math.abs(b.pos.x - t.x) < 2 &&
          Math.abs(b.pos.z - t.z) < 1.8 &&
          b.pos.y < 6
        ) {
          t.hp--;
          b.life = 0;
          if (t.hp === 0) destroyed.current++;
          setTargetVisual(targets.current.map((x) => ({ ...x })));
          onStats(destroyed.current);
          break;
        }
      }
      return b.life > 0;
    });
    setBulletVisual(
      bullets.current.map((b) => ({ id: b.id, pos: b.pos.toArray() })),
    );
    network.sendMovement(pos.current.toArray(), yaw.current);
    setVisual(pos.current.toArray());
    setAngle(yaw.current);
    const target = pos.current.clone().add(new THREE.Vector3(0, 3, 0));
    const offset =
      mode === 0
        ? new THREE.Vector3(0, 7, 15)
        : mode === 1
          ? new THREE.Vector3(3, 5, 9)
          : new THREE.Vector3(0, 4, -0.1);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current);
    const desired = pos.current.clone().add(offset);
    camera.position.lerp(desired, Math.min(1, dt * 8));
    camera.lookAt(target.clone().addScaledVector(forward, mode === 2 ? 20 : 0));
  });
  return (
    <>
      <color attach="background" args={["#0a1526"]} />
      <fog attach="fog" args={["#0a1526", 45, 140]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[12, 24, 10]} intensity={2.2} />
      <gridHelper args={[150, 50, "#346381", "#243c50"]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#15283b" />
      </mesh>
      {mode !== 2 && (
        <Titan position={visual} heading={angle} color={network.color} />
      )}
      {network.players
        .filter((p) => p.id !== network.id)
        .map((p) => (
          <RemoteTitan key={p.id} pilot={p} />
        ))}
      {targetVisual
        .filter((t) => t.hp > 0)
        .map((t) => (
          <group key={t.id} position={[t.x, 0, t.z]}>
            <mesh position={[0, 1.8, 0]}>
              <boxGeometry args={[2.5, 3.6, 2.5]} />
              <meshStandardMaterial
                color={
                  t.hp === 3 ? "#c4564c" : t.hp === 2 ? "#df9c4d" : "#f6d46e"
                }
                metalness={0.4}
              />
            </mesh>
            <mesh position={[0, 3.9, 0]}>
              <sphereGeometry args={[0.45, 12, 12]} />
              <meshStandardMaterial
                color="#ff4949"
                emissive="#b31818"
                emissiveIntensity={2}
              />
            </mesh>
          </group>
        ))}
      {bulletVisual.map((b) => (
        <mesh key={b.id} position={b.pos}>
          <sphereGeometry args={[0.25, 8, 8]} />
          <meshBasicMaterial color="#00e5ff" />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[(i % 2 ? 1 : -1) * 28, 3, -i * 12]}>
          <boxGeometry args={[4, 6, 4]} />
          <meshStandardMaterial color="#263b50" />
        </mesh>
      ))}
    </>
  );
}
function App() {
  const network = useMultiplayer();
  const controls = useRef(new Set());
  const [camera, setCamera] = useState(0);
  const [kills, setKills] = useState(0);
  const [ammo, setAmmo] = useState(60);
  const [help, setHelp] = useState(true);
  useEffect(() => {
    controls.current.clear();
    setKills(0);
    setAmmo(60);
  }, [network.id]);
  useEffect(() => {
    const down = (e) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest("input,textarea,select,button") ||
          e.target.isContentEditable)
      )
        return;
      if (
        [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      )
        e.preventDefault();
      controls.current.add(e.key.toLowerCase());
    };
    const up = (e) => controls.current.delete(e.key.toLowerCase());
    const blur = () => controls.current.clear();
    const pointerUp = () => controls.current.delete("mouse");
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", blur);
    document.addEventListener("visibilitychange", blur);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", blur);
      document.removeEventListener("visibilitychange", blur);
    };
  }, []);
  const button = (key, label) => (
    <button
      disabled={key === "mouse" && network.status === "connected"}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        controls.current.add(key);
      }}
      onPointerUp={() => controls.current.delete(key)}
      onPointerCancel={() => controls.current.delete(key)}
      onLostPointerCapture={() => controls.current.delete(key)}
    >
      {label}
    </button>
  );
  return (
    <main>
      <Canvas
        onPointerDown={(e) => {
          if (e.button === 0) {
            e.currentTarget.setPointerCapture(e.pointerId);
            controls.current.add("mouse");
          }
        }}
        onPointerUp={() => controls.current.delete("mouse")}
        onPointerCancel={() => controls.current.clear()}
        camera={{ position: [0, 7, 22], fov: 65 }}
      >
        <Arena
          key={network.id || "solo"}
          network={network}
          controls={controls}
          mode={camera}
          onStats={setKills}
          onAmmo={setAmmo}
        />
      </Canvas>
      <div className="hud">
        <strong>
          MECHVERSE <span>0.1</span>
        </strong>
        <small>TITAN 01 · TEST ARENA</small>
        <p>
          {network.status === "connected"
            ? "Squad movement test · Weapons offline"
            : `Targets destroyed: ${kills}/12`}
        </p>
        {network.status !== "connected" && <p>Ammo: {ammo}/60 · R reload</p>}
        <p>Armor: 100% · Flight: Unlimited</p>
        <button onClick={() => setCamera((v) => (v + 1) % 3)}>
          Camera: {["Third-person", "Shoulder", "First-person"][camera]}
        </button>
        <button onClick={() => setHelp((v) => !v)}>
          {help ? "Hide" : "Show"} controls
        </button>
        {help && (
          <div className="help">
            WASD move · Q/E rotate · Space jump · Hold F ascend · Ctrl descend ·
            Shift dodge
            {network.status !== "connected" &&
              " · Hold mouse button fire · R reload"}
          </div>
        )}
      </div>
      <RoomPanel network={network} />
      <div className="crosshair">+</div>
      <div className="mobile">
        <div className="pad">
          {button("w", "▲")}
          <div>
            {button("a", "◀")}
            {button("s", "▼")}
            {button("d", "▶")}
          </div>
        </div>
        <div className="actions">
          {button("mouse", "FIRE")}
          {button("f", "UP")}
          {button("control", "DOWN")}
          {button("shift", "DODGE")}
        </div>
      </div>
      <div className="footer">
        {network.status === "connected"
          ? "PRIVATE ROOM · MOVEMENT TEST · NO SAVED PROGRESS"
          : "SOLO PRACTICE · NO SAVED PROGRESS"}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
