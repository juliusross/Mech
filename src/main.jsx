import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "./style.css";
import { Html } from "@react-three/drei";
import { useMultiplayer } from "./multiplayer";
import { RoomPanel } from "./RoomPanel";
import {
  TARGETS,
  TARGET_HP,
  MAX_AMMO,
  FIRE_INTERVAL,
  BULLET_SPEED,
  BULLET_LIFE,
  hitsTarget,
} from "../shared/arena.js";
import {
  createWorld,
  createPilot,
  fire,
  step,
  view,
  MAX_ARMOR,
} from "../shared/sim.js";
const INITIAL_TARGETS = TARGETS.map((t) => ({ ...t, hp: TARGET_HP }));
function Titan({ position, heading, color = "#e17b35", down = false }) {
  if (down) color = "#3a3f47";
  return (
    <group position={position} rotation={[down ? -0.45 : 0, heading, 0]}>
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
      <Titan position={[0, 0, 0]} heading={0} color={pilot.color} down={pilot.down} />
      <Html position={[0, 5.3, 0]} center style={{ pointerEvents: "none" }}>
        <span className="pilot-label">{pilot.name}</span>
      </Html>
    </group>
  );
}
// Snapshot positions arrive 20 times a second; ease toward them every frame.
function Follow({ p, rate = 18, children }) {
  const group = useRef();
  const first = useRef(p);
  useFrame((_, dt) => {
    group.current?.position.lerp(
      new THREE.Vector3(...p),
      1 - Math.exp(-rate * dt),
    );
  });
  return (
    <group ref={group} position={first.current}>
      {children}
    </group>
  );
}
function Drone({ drone }) {
  const body = useRef();
  useFrame((state) => {
    if (body.current) body.current.rotation.y = state.clock.elapsedTime * 2;
  });
  return (
    <Follow p={drone.p} rate={12}>
      <group ref={body}>
        <mesh>
          <octahedronGeometry args={[1.35, 0]} />
          <meshStandardMaterial
            color={drone.hp > 2 ? "#c24a63" : "#e38a3c"}
            emissive={drone.hp > 2 ? "#4a0b1a" : "#5a2a08"}
            emissiveIntensity={1.4}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.8, 0.14, 6, 24]} />
          <meshStandardMaterial
            color="#ffc2cc"
            emissive="#ff5a78"
            emissiveIntensity={1.2}
          />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[0.38, 10, 10]} />
        <meshStandardMaterial
          color="#ff3355"
          emissive="#ff1e46"
          emissiveIntensity={3}
        />
      </mesh>
    </Follow>
  );
}
function Bolt({ bolt }) {
  return (
    <Follow p={bolt.p} rate={30}>
      <mesh>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshBasicMaterial color="#ff4a6a" />
      </mesh>
    </Follow>
  );
}
function Arena({ controls, mode, onHud, onAmmo, network }) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(...(network.spawn || [0, 0, 8])));
  const yaw = useRef(0);
  const velY = useRef(0);
  const [visual, setVisual] = useState([0, 0, 8]);
  const [angle, setAngle] = useState(0);
  const bullets = useRef([]);
  const [bulletVisual, setBulletVisual] = useState([]);
  const cooldown = useRef(0);
  const ammo = useRef(60);
  const dodge = useRef(0);
  const burst = useRef(0);
  const connected = network.status === "connected";
  // Solo runs the shared simulation here; in a room the server runs it and
  // local bullets are tracers only.
  const solo = useRef(null);
  if (!connected && !solo.current) solo.current = createWorld();
  const me = useRef(createPilot(network.spawn || [0, 0, 8]));
  const [soloScene, setSoloScene] = useState(() => solo.current && view(solo.current));
  const scene = connected
    ? {
        targets: network.targets,
        drones: network.drones || [],
        bolts: network.bolts || [],
        wave: network.wave ?? 1,
        cleared: network.cleared,
      }
    : soloScene;
  const shownTargets = INITIAL_TARGETS.map((t, i) => ({
    ...t,
    hp: scene.targets[i] ?? 0,
  }));
  const live = useRef({ targets: shownTargets, drones: scene.drones });
  live.current = { targets: shownTargets, drones: scene.drones };
  const wasDown = useRef(false);
  const lastHud = useRef("");
  const { onShot } = network;
  useEffect(
    () =>
      onShot((shot) =>
        bullets.current.push({
          id: Math.random(),
          pos: new THREE.Vector3(...shot.origin),
          dir: new THREE.Vector3(...shot.dir),
          life: BULLET_LIFE,
        }),
      ),
    [onShot],
  );
  useEffect(() => {
    const handler = (e) => {
      if (
        !(
          e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,select")
        ) &&
        (e.key === "r" || e.key === "R")
      ) {
        ammo.current = MAX_AMMO;
        onAmmo(MAX_AMMO);
        network.sendReload();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const pilot = connected
      ? network.players.find((p) => p.id === network.id)
      : me.current;
    const down = connected ? Boolean(pilot?.down) : me.current.downUntil > 0;
    if (wasDown.current && !down) {
      // Rebooted: return to this pilot's spawn point.
      pos.current.set(...(connected ? network.spawn : me.current.spawn));
      velY.current = 0;
      bullets.current = [];
    }
    wasDown.current = down;
    const k = down ? new Set() : controls.current;
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
      connected &&
      !k.has("mouse") &&
      cooldown.current < -0.4
    ) {
      // Settle any prediction drift once the trigger is released.
      const mine = network.players.find((p) => p.id === network.id);
      if (mine && mine.ammo !== ammo.current) {
        ammo.current = mine.ammo;
        onAmmo(mine.ammo);
      }
    }
    if (
      k.has("mouse") &&
      cooldown.current <= 0 &&
      ammo.current > 0
    ) {
      ammo.current--;
      onAmmo(ammo.current);
      cooldown.current = FIRE_INTERVAL;
      const origin = pos.current
        .clone()
        .add(
          new THREE.Vector3(1.55, 2.5, -2.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw.current,
          ),
        );
      if (connected) {
        bullets.current.push({
          id: Math.random(),
          pos: origin,
          dir: forward.clone(),
          life: BULLET_LIFE,
        });
        network.sendFire(origin.toArray(), forward.toArray());
      } else fire(solo.current, me.current, origin.toArray(), forward.toArray());
    }
    if (connected) {
      bullets.current = bullets.current.filter((b) => {
        b.pos.addScaledVector(b.dir, BULLET_SPEED * dt);
        b.life -= dt;
        const p = b.pos.toArray();
        if (
          live.current.targets.some((t) => t.hp > 0 && hitsTarget(p, t)) ||
          live.current.drones.some(
            (d) => Math.hypot(p[0] - d.p[0], p[1] - d.p[1], p[2] - d.p[2]) < 1.8,
          )
        )
          b.life = 0;
        return b.life > 0;
      });
      setBulletVisual(
        bullets.current.map((b) => ({ id: b.id, pos: b.pos.toArray() })),
      );
      network.sendMovement(pos.current.toArray(), yaw.current);
    } else {
      me.current.position = pos.current.toArray();
      step(solo.current, [me.current], dt, performance.now());
      setSoloScene(view(solo.current));
      setBulletVisual(
        solo.current.shots.map((s) => ({ id: s.id, pos: [...s.pos] })),
      );
    }
    const hud = {
      armor: pilot?.armor ?? MAX_ARMOR,
      down,
      score: pilot?.score ?? 0,
      wave: scene.wave,
      cleared: scene.cleared,
      targetsDown: scene.targets.filter((hp) => hp === 0).length,
      drones: scene.drones.length,
    };
    const key = JSON.stringify(hud);
    if (key !== lastHud.current) {
      lastHud.current = key;
      onHud(hud);
    }
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
        <Titan
          position={visual}
          heading={angle}
          color={network.color}
          down={wasDown.current}
        />
      )}
      {network.players
        .filter((p) => p.id !== network.id)
        .map((p) => (
          <RemoteTitan key={p.id} pilot={p} />
        ))}
      {shownTargets
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
      {scene.drones.map((d) => (
        <Drone key={d.id} drone={d} />
      ))}
      {scene.bolts.map((b) => (
        <Bolt key={b.id} bolt={b} />
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
  const [ammo, setAmmo] = useState(MAX_AMMO);
  const connected = network.status === "connected";
  const [hud, setHud] = useState(null);
  const [hit, setHit] = useState(0);
  const lastArmor = useRef(MAX_ARMOR);
  const onHud = (next) => {
    if (next.armor < lastArmor.current) setHit((n) => n + 1);
    lastArmor.current = next.armor;
    setHud(next);
  };
  const [help, setHelp] = useState(true);
  useEffect(() => {
    controls.current.clear();
    setAmmo(MAX_AMMO);
    lastArmor.current = MAX_ARMOR;
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
          onHud={onHud}
          onAmmo={setAmmo}
        />
      </Canvas>
      <div className="hud">
        <strong>
          MECHVERSE <span>0.1</span>
        </strong>
        <small>TITAN 01 · TEST ARENA</small>
        <p>
          {!hud
            ? "Wave 1"
            : hud.cleared
              ? `Wave ${hud.wave} cleared · next wave incoming`
              : `Wave ${hud.wave} · Targets ${hud.targetsDown}/12 · Drones left ${hud.drones}`}
        </p>
        <p>
          Score: {hud?.score ?? 0} · Ammo: {ammo}/{MAX_AMMO} · R reload
        </p>
        <p className={(hud?.armor ?? MAX_ARMOR) <= 30 ? "armor low" : "armor"}>
          Armor: {hud?.armor ?? MAX_ARMOR}% · Flight: Unlimited
        </p>
        <button onClick={() => setCamera((v) => (v + 1) % 3)}>
          Camera: {["Third-person", "Shoulder", "First-person"][camera]}
        </button>
        <button onClick={() => setHelp((v) => !v)}>
          {help ? "Hide" : "Show"} controls
        </button>
        {help && (
          <div className="help">
            WASD move · Q/E rotate · Space jump · Hold F ascend · Ctrl descend ·
            Shift dodge · Hold mouse button fire · R reload · Drones fire red
            bolts: dodge them
          </div>
        )}
      </div>
      <RoomPanel network={network} />
      <div className="crosshair">+</div>
      {hit > 0 && <div key={hit} className="hit-flash" aria-hidden="true" />}
      {hud?.down && (
        <div className="downed" role="status">
          <strong>TITAN DOWN</strong>
          <span>Rebooting at your spawn point…</span>
        </div>
      )}
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
          ? "PRIVATE ROOM · SQUAD DEFENSE · NO SAVED PROGRESS"
          : "SOLO PRACTICE · NO SAVED PROGRESS"}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
