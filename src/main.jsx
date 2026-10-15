import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "./style.css";
import { Html } from "@react-three/drei";
import { useMultiplayer } from "./multiplayer";
import { RoomPanel } from "./RoomPanel";
import { Mech } from "./Mech.jsx";
import { Pilot } from "./Pilot.jsx";
import { RoundedGeometry } from "./RoundedPart.jsx";
import { PlanetScene } from "./Planet.jsx";
import { Effect, BloodSplat } from "./Combat.jsx";
import { DamageSmoke } from "./DamageEffects.jsx";
import { Enemy, EnemyBolt } from "./Enemies.jsx";
import { ENEMY_TYPES } from "../shared/enemies.js";
import { POWERUPS } from "../shared/powerups.js";
import { MainMenu, Hangar, PlanetSelect, Settings, PauseMenu } from "./Menu.jsx";
import { initAudio, setVolume, sfx, near } from "./audio.js";
import { loadSettings, saveSettings } from "./settings.js";
import { useGamepad } from "./gamepad.js";
import {
  TARGETS,
  TARGET_HP,
  MAX_AMMO,
  BULLET_SPEED,
  BULLET_LIFE,
  hitsTarget,
  classOf,
  REPAIR_COOLDOWN,
  weaponOf,
} from "../shared/arena.js";
import { planetOf, FUSE_SCALE } from "../shared/planets.js";
import { terrainHeight, WORLD_EDGE } from "../shared/terrain.js";
import { solidsFor, solidAt, pushOut } from "../shared/obstacles.js";
import {
  createWorld,
  createPilot,
  toggleMech,
  setClass,
  fire,
  repair,
  step,
  view,
  drainEvents,
  setWeapon,
} from "../shared/sim.js";

const INITIAL_TARGETS = TARGETS.map((t) => ({ ...t, hp: TARGET_HP }));
const UP = new THREE.Vector3(0, 1, 0);
const AIM_RATE = 0.0025;

function RemoteMech({ pilot }) {
  const group = useRef();
  const initial = useRef(pilot.position);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.lerp(new THREE.Vector3(...pilot.position), 1 - Math.exp(-14 * dt));
    const diff = Math.atan2(
      Math.sin(pilot.heading - group.current.rotation.y),
      Math.cos(pilot.heading - group.current.rotation.y),
    );
    group.current.rotation.y += diff * (1 - Math.exp(-14 * dt));
  });
  if (pilot.fusion?.role === "gunner") return null;
  const fused = pilot.fusion?.role === "driver";
  const scale = classOf(pilot.cls).scale * (fused ? FUSE_SCALE : 1);
  const damage = 1 - pilot.armor / classOf(pilot.cls).armor;
  return (
    <>
      <group ref={group} position={initial.current}>
        {pilot.onFoot ? (
          <Pilot paint={pilot.paint} />
        ) : (
          <Mech paint={pilot.paint} cls={pilot.cls} down={pilot.down} fused={fused} thrust={pilot.position[1] > 0.4} weapon={pilot.special?.type} loadout={pilot.weapon} />
        )}
        {!pilot.onFoot && damage >= 0.5 && <DamageSmoke severity={damage} position={[0, 3.5 * scale, 0]} />}
        <Html position={[0, pilot.onFoot ? 2.7 : 5.9 * scale, 0]} center style={{ pointerEvents: "none" }}>
          <span className="pilot-label">
            {pilot.name}
            {fused ? " ⚡ FUSED" : ""}
          </span>
        </Html>
      </group>
      {pilot.onFoot && (
        <group position={pilot.mechPosition} rotation={[0, pilot.mechHeading || 0, 0]}>
          <Mech paint={pilot.paint} cls={pilot.cls} />
          {damage >= 0.5 && <DamageSmoke severity={damage} position={[0, 3.5 * scale, 0]} />}
        </group>
      )}
    </>
  );
}

function Target({ t }) {
  return (
    <group position={[t.x, 0, t.z]}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.75, 0.48, 12]} />
        <meshStandardMaterial color="#313b41" metalness={0.65} roughness={0.53} />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow receiveShadow>
        <RoundedGeometry size={[2.25, 3.25, 1.55]} radius={0.38} />
        <meshStandardMaterial
          color={t.hp === 3 ? "#6e3432" : t.hp === 2 ? "#9c5a34" : "#a58a4d"}
          metalness={0.58}
          roughness={0.54}
        />
      </mesh>
      <mesh position={[0, 2.05, 0.85]} castShadow>
        <RoundedGeometry size={[1.18, 1.15, 0.18]} radius={0.14} />
        <meshStandardMaterial color="#212e36" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.05, 0.96]}>
        <circleGeometry args={[0.32, 24]} />
        <meshStandardMaterial color="#ff8a59" emissive="#f04b23" emissiveIntensity={2.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.55, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.6, 10]} />
        <meshStandardMaterial color="#48565e" metalness={0.7} roughness={0.42} />
      </mesh>
      <mesh position={[0, 3.98, 0]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#ff4949" emissive="#b31818" emissiveIntensity={2} />
      </mesh>
      {t.hp === 1 && <DamageSmoke severity={0.65} position={[0, 3.3, 0]} />}
    </group>
  );
}

function Pickup({ drop }) {
  const group = useRef();
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y += 0.018;
    group.current.position.y = drop.p[1] + Math.sin(clock.elapsedTime * 3 + drop.id) * 0.2;
  });
  const power = POWERUPS[drop.type];
  return <group ref={group} position={drop.p}>
    <mesh castShadow>
      <dodecahedronGeometry args={[0.65, 1]} />
      <meshStandardMaterial color={power.color} emissive={power.color} emissiveIntensity={1.5} metalness={0.4} roughness={0.3} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.9, 0.06, 8, 32]} />
      <meshBasicMaterial color={power.color} />
    </mesh>
    <Html position={[0, 1.2, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap", color: "white", fontWeight: 700, textShadow: "0 2px 5px black" }}>
      {power.name}
    </Html>
  </group>;
}

function Arena({ controls, aim, mode, onHud, onAmmo, network, settings, soloPlanet, paused }) {
  const { camera } = useThree();
  const { cls, paint } = settings;
  const connected = network.status === "connected";
  const pos = useRef(new THREE.Vector3(...(network.spawn || [0, 0, 8])));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const velY = useRef(0);
  const [visual, setVisual] = useState(() => pos.current.toArray());
  const [angle, setAngle] = useState(0);
  const [aimPitch, setAimPitch] = useState(0);
  const bullets = useRef([]);
  const [bulletVisual, setBulletVisual] = useState([]);
  const cooldown = useRef(0);
  const ammo = useRef(MAX_AMMO);
  const dodge = useRef(0);
  const burst = useRef(0);
  const solo = useRef(null);
  if (!connected && !solo.current) {
    solo.current = createWorld(Math.random, { planet: soloPlanet, scatter: true });
    // Development builds expose the solo world for browser testing.
    if (import.meta.env.DEV) window.__mechverse = { world: solo.current, get me() { return me.current; } };
    // Testing aid: ?testwave=N starts solo play at wave N.
    const testWave = Number(new URLSearchParams(location.search).get("testwave"));
    if (testWave > 1) {
      solo.current.wave = testWave - 1;
      solo.current.waveAt = 1;
    }
  }
  const me = useRef(createPilot(network.spawn || [0, 0, 8], cls));
  if (import.meta.env.DEV && !me.current.testWeaponSeeded) {
    me.current.testWeaponSeeded = true;
    const testWeapon = new URLSearchParams(location.search).get("testweapon");
    if (["shotgun", "laser", "cannon", "sword"].includes(testWeapon))
      me.current.special = { type: testWeapon, ammo: POWERUPS[testWeapon].ammo || 0, until: performance.now() + (POWERUPS[testWeapon].duration || 0) };
  }
  const [soloScene, setSoloScene] = useState(() => solo.current && view(solo.current));
  const planet = connected ? network.planet || "proving" : soloPlanet;
  const P = planetOf(planet);
  const scene = connected
    ? {
        targets: network.targets,
        targetPos: network.targetPos,
        enemies: network.enemies || [],
        bolts: network.bolts || [],
        drops: network.drops || [],
        strikes: network.strikes || [],
        wave: network.wave ?? 1,
        cleared: network.cleared,
        pvp: network.pvp,
      }
    : soloScene;
  // Targets move every wave; positions come from the simulation.
  const shownTargets = INITIAL_TARGETS.map((t, i) => {
    const at = scene.targetPos?.[i];
    return { ...t, x: at ? at[0] : t.x, z: at ? at[1] : t.z, hp: scene.targets[i] ?? 0 };
  });
  const solids = solidsFor(planet);
  const live = useRef(null);
  live.current = { targets: shownTargets, enemies: scene.enemies };
  const wasDown = useRef(false);
  const wasGunner = useRef(false);
  const wasOnFoot = useRef(false);
  const lastHud = useRef("");
  const held = useRef(new Set());
  const repairReady = useRef(0);
  const notice = useRef({ text: "", until: 0 });
  const seenBolts = useRef(new Set());
  const seenStrikes = useRef(new Set());
  const lastWave = useRef(1);
  const [effects, setEffects] = useState([]);
  const addEffects = (list) => {
    for (const e of list) {
      const level = near(pos.current.distanceTo(new THREE.Vector3(...e.p)));
      if (sfx[e.kind]) sfx[e.kind](level);
    }
    setEffects((old) =>
      [...old, ...list.map((e) => (e.kind === "repair" ? { ...e, p: [e.p[0], 0.3, e.p[2]] } : e))].slice(-40),
    );
  };
  const removeEffect = (id) => setEffects((old) => old.filter((e) => e.id !== id));
  const { onShot, onEvents } = network;
  useEffect(() => onEvents(addEffects), [onEvents]);
  useEffect(
    () =>
      onShot((shot) => {
        if (shot.weapon === "sword" || shot.weapon === "laser") return;
        bullets.current.push({
          id: Math.random(),
          pos: new THREE.Vector3(...shot.origin),
          dir: new THREE.Vector3(...shot.dir),
          life: BULLET_LIFE,
          kind: shot.weapon,
        });
        sfx.shot(false, near(pos.current.distanceTo(new THREE.Vector3(...shot.origin))) * 0.6);
      }),
    [onShot],
  );
  useEffect(() => {
    const reload = () => {
      ammo.current = MAX_AMMO;
      onAmmo(MAX_AMMO);
    };
    window.addEventListener("mechverse-reload", reload);
    return () => window.removeEventListener("mechverse-reload", reload);
  }, []);
  const pressed = (k, key) => {
    const now = k.has(key) && !held.current.has(key);
    if (k.has(key)) held.current.add(key);
    else held.current.delete(key);
    return now;
  };

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const now = performance.now();
    const pilot = connected ? network.players.find((p) => p.id === network.id) : me.current;
    const down = connected ? Boolean(pilot?.down) : me.current.downUntil > 0;
    const fusion = connected ? pilot?.fusion : null;
    const onFoot = connected ? Boolean(pilot?.onFoot) : me.current.onFoot;
    const gunner = fusion?.role === "gunner";
    const driver = fusion?.role === "driver";
    const spec = classOf(cls);
    const sc = spec.scale * (driver ? FUSE_SCALE : 1);
    if (wasDown.current && !down) {
      pos.current.set(...(connected ? network.spawn : me.current.spawn));
      vel.current.set(0, 0, 0);
      velY.current = 0;
      bullets.current = [];
    }
    if (wasGunner.current && !gunner && pilot) pos.current.set(...pilot.position);
    if (connected && wasOnFoot.current !== onFoot && pilot) {
      pos.current.set(...pilot.position);
      vel.current.set(0, 0, 0);
      velY.current = 0;
    }
    wasDown.current = down;
    wasGunner.current = gunner;
    wasOnFoot.current = onFoot;

    // Aim: mouse or touch deltas accumulated by App.
    const a = aim.current;
    yaw.current -= a.dx * AIM_RATE * settings.sensitivity;
    pitch.current = THREE.MathUtils.clamp(
      pitch.current - a.dy * AIM_RATE * settings.sensitivity * (settings.invertY ? -1 : 1),
      -0.55,
      0.85,
    );
    a.dx = a.dy = 0;
    const k = down || paused ? new Set() : controls.current;
    if (k.has("q")) yaw.current += 1.8 * dt;
    if (k.has("e")) yaw.current -= 1.8 * dt;
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const aimDir = forward.clone().multiplyScalar(Math.cos(pitch.current)).setY(Math.sin(pitch.current));

    if (!connected && me.current.cls !== cls) setClass(me.current, cls);
    if (!connected) setWeapon(me.current, settings.weapon);
    if (pressed(k, "x")) {
      if (down || fusion) notice.current = { text: "Cannot leave the Titan right now", until: now + 2500 };
      else if (!onFoot && pos.current.y > terrainHeight(planet, pos.current.x, pos.current.z) + 0.2) notice.current = { text: "Land before exiting your Titan", until: now + 2500 };
      else if (onFoot && pos.current.distanceTo(new THREE.Vector3(...(connected ? pilot?.mechPosition || pos.current.toArray() : me.current.mechPosition))) > 4.5)
        notice.current = { text: "Move closer to your Titan to enter", until: now + 2500 };
      else if (connected) network.sendInteract();
      else if (toggleMech(me.current, yaw.current, planet)) {
        pos.current.set(...me.current.position);
        vel.current.set(0, 0, 0);
        velY.current = 0;
      }
    }
    if (!onFoot && pressed(k, "g") && spec.repair && now >= repairReady.current) {
      if (connected) network.sendRepair();
      else repair(solo.current, me.current, [me.current], now);
      repairReady.current = now + REPAIR_COOLDOWN * 1000;
    }
    if (!onFoot && pressed(k, "v")) {
      if (connected) {
        network.sendFuse();
        notice.current = { text: "Fusion requested · a squadmate within 8 m must press V too", until: now + 3000 };
      } else notice.current = { text: "Fusion needs a squadmate · play with friends", until: now + 3000 };
    }

    // Movement (a gunner rides inside the driver's Titan).
    const flying = k.has("f");
    if (gunner && pilot) {
      pos.current.lerp(new THREE.Vector3(...pilot.position), 1 - Math.exp(-14 * dt));
    } else {
      const move = new THREE.Vector3();
      if (k.has("w") || k.has("arrowup")) move.add(forward);
      if (k.has("s") || k.has("arrowdown")) move.sub(forward);
      if (k.has("d") || k.has("arrowright")) move.add(right);
      if (k.has("a") || k.has("arrowleft")) move.sub(right);
      if (move.lengthSq()) move.normalize();
      if (!onFoot && k.has("shift") && dodge.current <= 0) {
        dodge.current = spec.dodgeCooldown;
        burst.current = 0.22;
      }
      const boost = connected ? (pilot?.speedUntil > 0) : (pilot?.speedUntil > now);
      const speed = onFoot ? (k.has("shift") ? 8 : 5) : (burst.current > 0 ? spec.speed * 2.8 : spec.speed) * (driver ? 0.85 : 1) * (boost ? 1.35 : 1);
      burst.current -= dt;
      dodge.current -= dt;
      // Grip below 1 (ice) makes the Titan slide toward its intended velocity.
      vel.current.lerp(move.multiplyScalar(speed), Math.min(1, dt * (onFoot ? 16 : 12) * P.grip));
      pos.current.addScaledVector(vel.current, dt);
      if (!onFoot && flying) velY.current = 7;
      else if (!onFoot && k.has("control")) velY.current = -7;
      else velY.current -= P.gravity * dt;
      pos.current.x = THREE.MathUtils.clamp(pos.current.x, -WORLD_EDGE, WORLD_EDGE);
      pos.current.z = THREE.MathUtils.clamp(pos.current.z, -WORLD_EDGE, WORLD_EDGE);
      // Buildings and cover are solid unless you fly over them.
      const bodyRadius = onFoot ? 0.5 : 1.6 * spec.scale * (driver ? FUSE_SCALE : 1);
      const [sx, sz] = pushOut(solids, pos.current.x, pos.current.z, bodyRadius, pos.current.y);
      if (sx !== pos.current.x || sz !== pos.current.z) {
        pos.current.x = sx;
        pos.current.z = sz;
        vel.current.multiplyScalar(0.6);
      }
      const ground = terrainHeight(planet, pos.current.x, pos.current.z);
      if (k.has(" ") && pos.current.y <= ground + 0.05) velY.current = onFoot ? 5.5 : 9;
      pos.current.y = Math.max(ground, Math.min(ground + (onFoot ? 3.5 : 45), pos.current.y + velY.current * dt));
      if (pos.current.y === ground) velY.current = Math.max(0, velY.current);
    }

    // Firing toward the point under the crosshair.
    cooldown.current -= dt;
    if (connected && !k.has("mouse") && cooldown.current < -0.4 && pilot && pilot.ammo !== ammo.current) {
      ammo.current = pilot.ammo;
      onAmmo(pilot.ammo);
    }
    const specialType = pilot?.special?.type;
    if (!onFoot && k.has("mouse") && cooldown.current <= 0 && (specialType || ammo.current > 0)) {
      if (!specialType) { ammo.current--; onAmmo(ammo.current); }
      cooldown.current = POWERUPS[specialType]?.interval || spec.fireInterval * weaponOf(settings.weapon).rate;
      const muzzle = pos.current
        .clone()
        .add(new THREE.Vector3(1.4 * sc, 3.25 * sc, -2.2 * sc).applyAxisAngle(UP, yaw.current));
      const target = pos.current.clone().add(new THREE.Vector3(0, 3 * sc, 0)).addScaledVector(aimDir, 40);
      const dir = target.sub(muzzle).normalize();
      sfx.shot(cls === "heavy");
      if (connected) {
        if (specialType !== "laser" && specialType !== "sword")
          bullets.current.push({ id: Math.random(), pos: muzzle, dir, life: BULLET_LIFE, kind: specialType });
        network.sendFire(muzzle.toArray(), dir.toArray());
      } else fire(solo.current, me.current, muzzle.toArray(), dir.toArray());
    }

    if (connected) {
      bullets.current = bullets.current.filter((b) => {
        b.pos.addScaledVector(b.dir, (b.kind === "cannon" ? 34 : BULLET_SPEED) * dt);
        b.life -= dt;
        const p = b.pos.toArray();
        if (
          solidAt(solids, p[0], p[1], p[2]) ||
          live.current.targets.some((t) => t.hp > 0 && hitsTarget(p, t)) ||
          live.current.enemies.some((e) => {
            const T = ENEMY_TYPES[e.t];
            return Math.hypot(p[0] - e.p[0], p[1] - e.p[1] - T.center, p[2] - e.p[2]) < T.radius;
          })
        )
          b.life = 0;
        return b.life > 0;
      });
      setBulletVisual(bullets.current.map((b) => ({ id: b.id, pos: b.pos.toArray(), kind: b.kind })));
      network.sendMovement(pos.current.toArray(), yaw.current);
    } else if (!paused) {
      me.current.position = pos.current.toArray();
      if (!me.current.onFoot) {
        me.current.mechPosition = [...me.current.position];
        me.current.mechHeading = yaw.current;
      }
      step(solo.current, [me.current], dt, now);
      const events = drainEvents(solo.current);
      if (events.length) addEffects(events);
      setSoloScene(view(solo.current));
      setBulletVisual(solo.current.shots.map((s) => ({ id: s.id, pos: [...s.pos], kind: s.kind })));
    }

    // Sound cues for things that appear in the scene.
    for (const b of scene.bolts)
      if (!seenBolts.current.has(b.id)) {
        seenBolts.current.add(b.id);
        sfx.bolt(near(pos.current.distanceTo(new THREE.Vector3(...b.p))));
      }
    if (seenBolts.current.size > 400) seenBolts.current = new Set(scene.bolts.map((b) => b.id));
    for (const st of scene.strikes || [])
      if (!seenStrikes.current.has(st.id)) {
        seenStrikes.current.add(st.id);
        sfx.warn(near(pos.current.distanceTo(new THREE.Vector3(...st.p))));
      }
    if (scene.wave !== lastWave.current) {
      lastWave.current = scene.wave;
      sfx.wave();
    }

    const hud = {
      armor: fusion ? fusion.armor : (pilot?.armor ?? spec.armor),
      shield: pilot?.shield || 0,
      special: pilot?.special ? { ...pilot.special, until: connected ? pilot.special.until : Math.max(0, pilot.special.until - now) } : null,
      speed: connected ? (pilot?.speedUntil || 0) : Math.max(0, (pilot?.speedUntil || 0) - now),
      maxArmor: fusion ? fusion.max : classOf(pilot?.cls ?? cls).armor,
      down,
      score: pilot?.score ?? 0,
      wave: scene.wave,
      cleared: scene.cleared,
      targetsDown: scene.targets.filter((hp) => hp === 0).length,
      enemies: scene.enemies.length,
      repairIn: spec.repair ? Math.max(0, Math.ceil((repairReady.current - now) / 1000)) : null,
      pvp: Boolean(scene.pvp),
      planet,
      fusion: fusion ? { role: fusion.role, left: Math.ceil(fusion.left / 1000) } : null,
      onFoot,
      nearMech: onFoot && pos.current.distanceTo(new THREE.Vector3(...(pilot?.mechPosition || me.current.mechPosition))) <= 4.5,
      fuseIn: connected && pilot ? Math.ceil((pilot.fuseReady || 0) / 1000) : null,
      notice: notice.current.until > now ? notice.current.text : "",
    };
    const key = JSON.stringify(hud);
    if (key !== lastHud.current) {
      lastHud.current = key;
      onHud(hud);
    }
    setVisual(pos.current.toArray());
    setAngle(yaw.current);
    setAimPitch(pitch.current);

    // Camera: orbit behind the Titan, looking where the crosshair aims.
    const chest = pos.current.clone().add(new THREE.Vector3(0, onFoot ? 1.55 : 3 * sc, 0));
    let desired, look;
    if (mode === 2) {
      desired = pos.current.clone().add(new THREE.Vector3(0, onFoot ? 1.8 : 4.6 * sc, onFoot ? -0.2 : -0.6 * sc).applyAxisAngle(UP, yaw.current));
      look = desired.clone().addScaledVector(aimDir, 30);
    } else {
      const base = onFoot ? (mode === 0 ? new THREE.Vector3(0, 3, 5.8) : new THREE.Vector3(1.2, 2.5, 3.4)) : mode === 0 ? new THREE.Vector3(0, 6, 14) : new THREE.Vector3(3.2, 4.6, 8.5);
      base.y -= pitch.current * 6;
      base.z -= Math.max(0, pitch.current) * 3;
      desired = pos.current.clone().add(base.multiplyScalar(onFoot ? 1 : Math.max(1, sc)).applyAxisAngle(UP, yaw.current));
      desired.y = Math.max(0.8, desired.y);
      look = chest.clone().addScaledVector(aimDir, 30);
    }
    camera.position.lerp(desired, Math.min(1, dt * 10));
    camera.lookAt(look);
  });

  const meDown = wasDown.current;
  const meFusion = connected ? network.players.find((p) => p.id === network.id)?.fusion : null;
  const mePilot = connected ? network.players.find((p) => p.id === network.id) : me.current;
  const meOnFoot = Boolean(mePilot?.onFoot);
  const myDamage = mePilot ? 1 - mePilot.armor / classOf(mePilot.cls || cls).armor : 0;
  return (
    <>
      <PlanetScene planet={planet} strikes={scene.strikes || []} />
      {meOnFoot && (
        <group position={mePilot.mechPosition} rotation={[0, mePilot.mechHeading || 0, 0]}>
          <Mech paint={paint} cls={cls} />
          {myDamage >= 0.5 && <DamageSmoke severity={myDamage} position={[0, 3.5 * classOf(cls).scale, 0]} />}
        </group>
      )}
      {mode !== 2 && meFusion?.role !== "gunner" && (
        <group position={visual} rotation={[0, angle, 0]}>
          {meOnFoot ? <Pilot paint={paint} moving={vel.current.lengthSq() > 0.4} /> : <Mech
            paint={paint}
            cls={cls}
            down={meDown}
            fused={meFusion?.role === "driver"}
            pitch={aimPitch}
            thrust={controls.current.has("f") && !meDown}
            weapon={mePilot?.special?.type}
            loadout={settings.weapon}
          />}
          {!meOnFoot && myDamage >= 0.5 && <DamageSmoke severity={myDamage} position={[0, 3.5 * classOf(cls).scale, 0]} />}
        </group>
      )}
      {network.players
        .filter((p) => p.id !== network.id)
        .map((p) => (
          <RemoteMech key={p.id} pilot={p} />
        ))}
      {shownTargets
        .filter((t) => t.hp > 0)
        .map((t) => (
          <Target key={t.id} t={t} />
        ))}
      {scene.enemies.map((e) => (
        <Enemy key={e.id} e={e} />
      ))}
      {(scene.drops || []).map((drop) => <Pickup key={drop.id} drop={drop} />)}
      {scene.bolts.map((b) => (
        <EnemyBolt key={b.id} bolt={b} />
      ))}
      {effects.map((e) =>
        e.kind === "splat" || e.kind === "ouch" ? (
          <BloodSplat key={e.id} effect={e} onDone={removeEffect} />
        ) : (
          <Effect key={e.id} effect={e} onDone={removeEffect} />
        ),
      )}
      {bulletVisual.map((b) => (
        <mesh key={b.id} position={b.pos}>
          <sphereGeometry args={[b.kind === "cannon" ? 0.52 : b.kind === "shotgun" ? 0.15 : 0.22, 8, 8]} />
          <meshBasicMaterial color={b.kind === "cannon" ? "#ff8051" : paint.visor} />
        </mesh>
      ))}
    </>
  );
}

const fine = () => matchMedia("(pointer: fine)").matches;

function App() {
  const network = useMultiplayer();
  const connected = network.status === "connected";
  const [settings, setSettings] = useState(loadSettings);
  const update = (patch) =>
    setSettings((old) => {
      const next = { ...old, ...patch };
      saveSettings(next);
      if ("volume" in patch) setVolume(next.volume);
      return next;
    });
  // Keep the server's copy of class and paint in step with the hangar.
  useEffect(() => {
    if (connected) network.sendClass(settings.cls);
  }, [settings.cls, connected]);
  useEffect(() => {
    if (connected) network.sendPaint(settings.paint);
  }, [settings.paint, connected]);
  useEffect(() => {
    if (connected) network.sendWeapon(settings.weapon);
  }, [settings.weapon, connected]);
  useEffect(() => setVolume(settings.volume), []);

  const inviteRoom = new URLSearchParams(location.search).get("room");
  const [screen, setScreen] = useState("menu");
  const [back, setBack] = useState("menu");
  const [inGame, setInGame] = useState(false);
  const [paused, setPaused] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [soloPlanet, setSoloPlanet] = useState(settings.planet);
  const controls = useRef(new Set());
  const aim = useRef({ dx: 0, dy: 0 });
  const canvasWrap = useRef(null);
  const touchAim = useRef(null);
  const [locked, setLocked] = useState(false);
  const [camera, setCamera] = useState(0);
  const [ammo, setAmmo] = useState(MAX_AMMO);
  const [hud, setHud] = useState(null);
  const [hit, setHit] = useState(0);
  const lastArmor = useRef(Infinity);
  const onFootState = useRef(false);
  const onHud = (next) => {
    onFootState.current = next.onFoot;
    if (next.armor < lastArmor.current && lastArmor.current !== Infinity) {
      setHit((n) => n + 1);
      sfx.hurt();
    }
    lastArmor.current = next.armor;
    setHud(next);
  };
  const playing = inGame && screen === "play" && !paused;
  const reload = () => {
    if (!playing || onFootState.current) return;
    setAmmo(MAX_AMMO);
    network.sendReload();
    window.dispatchEvent(new CustomEvent("mechverse-reload"));
  };
  const pad = useGamepad({
    controls,
    aim,
    playing: playing && !friendsOpen,
    sensitivity: settings.sensitivity,
    onReload: reload,
    onCamera: () => setCamera((v) => (v + 1) % 3),
    onPause: () => {
      if (!inGame) return;
      if (friendsOpen) setFriendsOpen(false);
      else setPaused((p) => !p);
    },
    onBack: () => {
      if (friendsOpen) setFriendsOpen(false);
      else if (screen === "play" && paused) setPaused(false);
      else if (screen === "hangar" || screen === "settings") setScreen(back === "play" ? "play" : "menu");
      else if (screen === "planets") setScreen("menu");
    },
  });

  useEffect(() => {
    controls.current.clear();
    setAmmo(MAX_AMMO);
    lastArmor.current = Infinity;
  }, [network.id]);
  // Entering a room from the lobby drops you into the arena.
  useEffect(() => {
    if (connected) {
      setInGame(true);
      setScreen("play");
      setPaused(false);
    }
  }, [connected]);

  useEffect(() => {
    const down = (e) => {
      if (e.target instanceof HTMLElement && (e.target.closest("input,textarea,select,button") || e.target.isContentEditable))
        return;
      if (e.key === "Escape" && inGame) {
        setPaused((p) => !p);
        return;
      }
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key === "r" || e.key === "R") reload();
      controls.current.add(e.key.toLowerCase());
    };
    const up = (e) => controls.current.delete(e.key.toLowerCase());
    const blur = () => controls.current.clear();
    const pointerUp = () => controls.current.delete("mouse");
    const mouseMove = (e) => {
      if (document.pointerLockElement) {
        aim.current.dx += e.movementX;
        aim.current.dy += e.movementY;
      }
    };
    const lockChange = () => {
      const isLocked = Boolean(document.pointerLockElement);
      setLocked(isLocked);
      if (!isLocked) {
        controls.current.delete("mouse");
        // Releasing the mouse (Esc) pauses the game.
        setPaused((p) => (inGame && screen === "play" ? true : p));
      }
    };
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", blur);
    document.addEventListener("visibilitychange", blur);
    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("pointerlockchange", lockChange);
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
      document.removeEventListener("mousemove", mouseMove);
      document.removeEventListener("pointerlockchange", lockChange);
    };
  }, [inGame, screen, playing]);

  useEffect(() => {
    if (!playing) controls.current.clear();
    if (!playing && document.pointerLockElement) document.exitPointerLock?.();
  }, [playing]);

  const lockMouse = () => {
    const c = canvasWrap.current?.querySelector("canvas");
    try {
      const r = c?.requestPointerLock?.();
      r?.catch?.(() => {});
    } catch {}
  };
  const startSolo = (planet = settings.planet) => {
    initAudio();
    network.leave();
    setSoloPlanet(planet);
    setInGame(true);
    setScreen("play");
    setPaused(false);
    setFriendsOpen(false);
  };
  const openFriends = () => {
    initAudio();
    setSoloPlanet(settings.planet);
    setInGame(true);
    setScreen("play");
    setPaused(false);
    setFriendsOpen(true);
  };
  const quit = () => {
    network.leave();
    setInGame(false);
    setPaused(false);
    setScreen("menu");
  };
  const open = (name, from) => {
    initAudio();
    setBack(from);
    setScreen(name);
  };

  const button = (key, label) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        initAudio();
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

  const P = planetOf(hud?.planet ?? soloPlanet);
  const spec = classOf(settings.cls);
  const maxArmor = hud?.maxArmor ?? spec.armor;
  const pct = Math.round(((hud?.armor ?? maxArmor) / maxArmor) * 100);
  const backFromHangar = back === "play" ? () => setScreen("play") : () => setScreen("menu");

  return (
    <main>
      {inGame && (
        <div className="stage" ref={canvasWrap}>
          <Canvas
            shadows
            onPointerDown={(e) => {
              initAudio();
              if (!playing) return;
              if (e.pointerType === "mouse") {
                if (e.button !== 0) return;
                if (!document.pointerLockElement && fine()) {
                  lockMouse();
                  return;
                }
                controls.current.add("mouse");
              } else {
                touchAim.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
              }
            }}
            onPointerMove={(e) => {
              const t = touchAim.current;
              if (t && t.id === e.pointerId) {
                aim.current.dx += (e.clientX - t.x) * 1.6;
                aim.current.dy += (e.clientY - t.y) * 1.6;
                t.x = e.clientX;
                t.y = e.clientY;
              }
            }}
            onPointerUp={(e) => {
              controls.current.delete("mouse");
              if (touchAim.current?.id === e.pointerId) touchAim.current = null;
            }}
            onPointerCancel={() => {
              controls.current.clear();
              touchAim.current = null;
            }}
            camera={{ position: [0, 7, 22], fov: 65 }}
          >
            <Arena
              key={`${network.id || "solo"}-${connected ? "room" : soloPlanet}`}
              network={network}
              controls={controls}
              aim={aim}
              mode={camera}
              onHud={onHud}
              onAmmo={setAmmo}
              settings={settings}
              soloPlanet={soloPlanet}
              paused={paused && !connected}
            />
          </Canvas>
          <div className="hud">
            <strong>
              MECH<span>VERSE</span>
            </strong>
            <small>
              {P.name.toUpperCase()} · {spec.name.toUpperCase()}
              {hud?.onFoot ? " · ON FOOT" : ""}
              {hud?.pvp ? " · VERSUS" : ""}
            </small>
            <p>
              {!hud
                ? "Wave 1"
                : hud.cleared
                  ? `Wave ${hud.wave} cleared · next wave incoming`
                  : `Wave ${hud.wave} · Targets ${hud.targetsDown}/12 · Enemies ${hud.enemies}`}
            </p>
            <p>
              Score {hud?.score ?? 0} · Ammo {ammo}/{MAX_AMMO}
            </p>
            {hud?.special && <p style={{ color: POWERUPS[hud.special.type]?.color }}>
              {POWERUPS[hud.special.type]?.name} · {hud.special.type === "sword" ? `${Math.ceil(hud.special.until / 1000)}s` : `${hud.special.ammo} charge`}
            </p>}
            {Boolean(hud?.shield || hud?.speed) && <p>
              {hud.shield ? `Shield ${hud.shield}` : ""}{hud.shield && hud.speed ? " · " : ""}{hud.speed ? `Overdrive ${Math.ceil(hud.speed / 1000)}s` : ""}
            </p>}
            <div className={`armor-bar${pct <= 30 ? " low" : ""}${hud?.fusion ? " fused" : ""}`}>
              <span style={{ width: `${pct}%` }} />
              <em>
                {hud?.fusion ? "Fused armor" : "Armor"} {hud?.armor ?? maxArmor}/{maxArmor}
              </em>
            </div>
            {hud?.fusion && (
              <p className="fusion-line">
                ⚡ Fused · you are the {hud.fusion.role} · {hud.fusion.left}s
              </p>
            )}
            {!hud?.fusion && hud?.fuseIn != null && (
              <p>{hud.fuseIn ? `Fusion recharging · ${hud.fuseIn}s` : "Fusion ready · V near a squadmate"}</p>
            )}
            {hud?.repairIn != null && (
              <p>{hud.repairIn ? `Repair recharging · ${hud.repairIn}s` : "Repair ready · G"}</p>
            )}
            {hud?.notice && <p className="notice">{hud.notice}</p>}
            <p className="pilot-prompt">
              {hud?.onFoot
                ? hud.nearMech ? "X · Enter your Titan" : "X · Enter when close to your Titan"
                : "X · Exit your Titan when landed"}
            </p>
            <div className="hud-buttons">
              <button onClick={() => setCamera((v) => (v + 1) % 3)}>
                {["Third-person", "Shoulder", "First-person"][camera]}
              </button>
              <button onClick={() => setPaused(true)}>Menu</button>
            </div>
          </div>
          {friendsOpen && (
            <RoomPanel network={network} settings={settings} onClose={() => setFriendsOpen(false)} />
          )}
          <div className="crosshair" aria-hidden="true">
            <span />
          </div>
          {pad && <div className="pad-badge" aria-live="polite">🎮 Controller connected</div>}
          {playing && fine() && !locked && !pad && (
            <div className="aim-hint">Click the arena to aim with your mouse</div>
          )}
          {hit > 0 && <div key={hit} className="hit-flash" aria-hidden="true" />}
          {hud?.down && (
            <div className="downed" role="status">
              <strong>TITAN DOWN</strong>
              <span>Rebooting at your spawn point…</span>
            </div>
          )}
          <div className="mobile">
            <div className="pad">
              <div>
                {button("q", "↺")}
                {button("w", "▲")}
                {button("e", "↻")}
              </div>
              <div>
                {button("a", "◀")}
                {button("s", "▼")}
                {button("d", "▶")}
              </div>
            </div>
            <div className="actions">
              {!hud?.onFoot && button("mouse", "FIRE")}
              {!hud?.onFoot && button("f", "UP")}
              {!hud?.onFoot && button("control", "DOWN")}
              {button("shift", hud?.onFoot ? "RUN" : "DODGE")}
              {button(" ", "JUMP")}
              {button("x", hud?.onFoot ? "ENTER" : "EXIT")}
              {connected && button("v", "FUSE")}
              {spec.repair && button("g", "REPAIR")}
            </div>
          </div>
          <div className="footer">
            {connected
              ? `PRIVATE ROOM · ${network.pvp ? "VERSUS" : "SQUAD DEFENSE"} · ${P.name.toUpperCase()}`
              : `SOLO MISSION · ${P.name.toUpperCase()}`}
          </div>
          {paused && screen === "play" && !friendsOpen && (
            <PauseMenu
              onFriends={() => setFriendsOpen(true)}
              connected={connected}
              onResume={() => {
                setPaused(false);
                if (fine()) lockMouse();
              }}
              onHangar={() => open("hangar", "play")}
              onSettings={() => open("settings", "play")}
              onQuit={quit}
            />
          )}
        </div>
      )}
      {screen === "menu" && (
        <MainMenu
          settings={settings}
          inviteRoom={inviteRoom}
          onSolo={() => open("planets", "menu")}
          onFriends={openFriends}
          onHangar={() => open("hangar", "menu")}
          onSettings={() => open("settings", "menu")}
        />
      )}
      {screen === "hangar" && (
        <Hangar
          settings={settings}
          update={update}
          onBack={backFromHangar}
          onDeploy={back === "play" ? () => setScreen("play") : () => setScreen("planets")}
          deployLabel={back === "play" ? "Back to battle" : "Choose planet"}
          locked={hud?.fusion ? "Mech class is locked while fused." : ""}
        />
      )}
      {screen === "planets" && (
        <PlanetSelect settings={settings} update={update} onBack={() => setScreen("menu")} onLaunch={startSolo} />
      )}
      {screen === "settings" && (
        <Settings
          settings={settings}
          update={update}
          onBack={back === "play" ? () => setScreen("play") : () => setScreen("menu")}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
