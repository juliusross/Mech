import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "./style.css";
import { Html } from "@react-three/drei";
import { useMultiplayer } from "./multiplayer";
import { RoomPanel } from "./RoomPanel";
import { Mech } from "./Mech.jsx";
import { PlanetScene } from "./Planet.jsx";
import { Effect } from "./Combat.jsx";
import { Enemy, EnemyBolt } from "./Enemies.jsx";
import { ENEMY_TYPES } from "../shared/enemies.js";
import { MainMenu, Hangar, PlanetSelect, Settings, PauseMenu } from "./Menu.jsx";
import { initAudio, setVolume, sfx, near } from "./audio.js";
import { loadSettings, saveSettings } from "./settings.js";
import {
  TARGETS,
  TARGET_HP,
  MAX_AMMO,
  BULLET_SPEED,
  BULLET_LIFE,
  hitsTarget,
  classOf,
  REPAIR_COOLDOWN,
} from "../shared/arena.js";
import { planetOf, FUSE_SCALE } from "../shared/planets.js";
import {
  createWorld,
  createPilot,
  setClass,
  fire,
  repair,
  step,
  view,
  drainEvents,
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
  return (
    <group ref={group} position={initial.current}>
      <Mech paint={pilot.paint} cls={pilot.cls} down={pilot.down} fused={fused} thrust={pilot.position[1] > 0.4} />
      <Html position={[0, 5.9 * scale, 0]} center style={{ pointerEvents: "none" }}>
        <span className="pilot-label">
          {pilot.name}
          {fused ? " ⚡ FUSED" : ""}
        </span>
      </Html>
    </group>
  );
}

function Target({ t }) {
  return (
    <group position={[t.x, 0, t.z]}>
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 3.6, 2.5]} />
        <meshStandardMaterial
          color={t.hp === 3 ? "#c4564c" : t.hp === 2 ? "#df9c4d" : "#f6d46e"}
          metalness={0.5}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, 3.9, 0]}>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshStandardMaterial color="#ff4949" emissive="#b31818" emissiveIntensity={2} />
      </mesh>
    </group>
  );
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
    solo.current = createWorld(Math.random, { planet: soloPlanet });
    // Testing aid: ?testwave=N starts solo play at wave N.
    const testWave = Number(new URLSearchParams(location.search).get("testwave"));
    if (testWave > 1) {
      solo.current.wave = testWave - 1;
      solo.current.waveAt = 1;
    }
  }
  const me = useRef(createPilot(network.spawn || [0, 0, 8], cls));
  const [soloScene, setSoloScene] = useState(() => solo.current && view(solo.current));
  const planet = connected ? network.planet || "proving" : soloPlanet;
  const P = planetOf(planet);
  const scene = connected
    ? {
        targets: network.targets,
        enemies: network.enemies || [],
        bolts: network.bolts || [],
        strikes: network.strikes || [],
        wave: network.wave ?? 1,
        cleared: network.cleared,
        pvp: network.pvp,
      }
    : soloScene;
  const shownTargets = INITIAL_TARGETS.map((t, i) => ({ ...t, hp: scene.targets[i] ?? 0 }));
  const live = useRef(null);
  live.current = { targets: shownTargets, enemies: scene.enemies };
  const wasDown = useRef(false);
  const wasGunner = useRef(false);
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
        bullets.current.push({
          id: Math.random(),
          pos: new THREE.Vector3(...shot.origin),
          dir: new THREE.Vector3(...shot.dir),
          life: BULLET_LIFE,
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
    wasDown.current = down;
    wasGunner.current = gunner;

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
    if (pressed(k, "g") && spec.repair && now >= repairReady.current) {
      if (connected) network.sendRepair();
      else repair(solo.current, me.current, [me.current], now);
      repairReady.current = now + REPAIR_COOLDOWN * 1000;
    }
    if (pressed(k, "v")) {
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
      if (k.has("shift") && dodge.current <= 0) {
        dodge.current = spec.dodgeCooldown;
        burst.current = 0.22;
      }
      const speed = (burst.current > 0 ? spec.speed * 2.8 : spec.speed) * (driver ? 0.85 : 1);
      burst.current -= dt;
      dodge.current -= dt;
      // Grip below 1 (ice) makes the Titan slide toward its intended velocity.
      vel.current.lerp(move.multiplyScalar(speed), Math.min(1, dt * 12 * P.grip));
      pos.current.addScaledVector(vel.current, dt);
      if (flying) velY.current = 7;
      else if (k.has("control")) velY.current = -7;
      else velY.current -= P.gravity * dt;
      if (k.has(" ") && pos.current.y < 0.02) velY.current = 9;
      pos.current.y = Math.max(0, Math.min(45, pos.current.y + velY.current * dt));
      if (pos.current.y === 0) velY.current = Math.max(0, velY.current);
      pos.current.x = THREE.MathUtils.clamp(pos.current.x, -65, 65);
      pos.current.z = THREE.MathUtils.clamp(pos.current.z, -85, 65);
    }

    // Firing toward the point under the crosshair.
    cooldown.current -= dt;
    if (connected && !k.has("mouse") && cooldown.current < -0.4 && pilot && pilot.ammo !== ammo.current) {
      ammo.current = pilot.ammo;
      onAmmo(pilot.ammo);
    }
    if (k.has("mouse") && cooldown.current <= 0 && ammo.current > 0) {
      ammo.current--;
      onAmmo(ammo.current);
      cooldown.current = spec.fireInterval;
      const muzzle = pos.current
        .clone()
        .add(new THREE.Vector3(1.4 * sc, 3.25 * sc, -2.2 * sc).applyAxisAngle(UP, yaw.current));
      const target = pos.current.clone().add(new THREE.Vector3(0, 3 * sc, 0)).addScaledVector(aimDir, 40);
      const dir = target.sub(muzzle).normalize();
      sfx.shot(cls === "heavy");
      if (connected) {
        bullets.current.push({ id: Math.random(), pos: muzzle, dir, life: BULLET_LIFE });
        network.sendFire(muzzle.toArray(), dir.toArray());
      } else fire(solo.current, me.current, muzzle.toArray(), dir.toArray());
    }

    if (connected) {
      bullets.current = bullets.current.filter((b) => {
        b.pos.addScaledVector(b.dir, BULLET_SPEED * dt);
        b.life -= dt;
        const p = b.pos.toArray();
        if (
          live.current.targets.some((t) => t.hp > 0 && hitsTarget(p, t)) ||
          live.current.enemies.some((e) => {
            const T = ENEMY_TYPES[e.t];
            return Math.hypot(p[0] - e.p[0], p[1] - e.p[1] - T.center, p[2] - e.p[2]) < T.radius;
          })
        )
          b.life = 0;
        return b.life > 0;
      });
      setBulletVisual(bullets.current.map((b) => ({ id: b.id, pos: b.pos.toArray() })));
      network.sendMovement(pos.current.toArray(), yaw.current);
    } else if (!paused) {
      me.current.position = pos.current.toArray();
      step(solo.current, [me.current], dt, now);
      const events = drainEvents(solo.current);
      if (events.length) addEffects(events);
      setSoloScene(view(solo.current));
      setBulletVisual(solo.current.shots.map((s) => ({ id: s.id, pos: [...s.pos] })));
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
    const chest = pos.current.clone().add(new THREE.Vector3(0, 3 * sc, 0));
    let desired, look;
    if (mode === 2) {
      desired = pos.current.clone().add(new THREE.Vector3(0, 4.6 * sc, -0.6 * sc).applyAxisAngle(UP, yaw.current));
      look = desired.clone().addScaledVector(aimDir, 30);
    } else {
      const base = mode === 0 ? new THREE.Vector3(0, 6, 14) : new THREE.Vector3(3.2, 4.6, 8.5);
      base.y -= pitch.current * 6;
      base.z -= Math.max(0, pitch.current) * 3;
      desired = pos.current.clone().add(base.multiplyScalar(Math.max(1, sc)).applyAxisAngle(UP, yaw.current));
      desired.y = Math.max(0.8, desired.y);
      look = chest.clone().addScaledVector(aimDir, 30);
    }
    camera.position.lerp(desired, Math.min(1, dt * 10));
    camera.lookAt(look);
  });

  const meDown = wasDown.current;
  const meFusion = connected ? network.players.find((p) => p.id === network.id)?.fusion : null;
  return (
    <>
      <PlanetScene planet={planet} strikes={scene.strikes || []} />
      {mode !== 2 && meFusion?.role !== "gunner" && (
        <group position={visual} rotation={[0, angle, 0]}>
          <Mech
            paint={paint}
            cls={cls}
            down={meDown}
            fused={meFusion?.role === "driver"}
            pitch={aimPitch}
            thrust={controls.current.has("f") && !meDown}
          />
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
      {scene.bolts.map((b) => (
        <EnemyBolt key={b.id} bolt={b} />
      ))}
      {effects.map((e) => (
        <Effect key={e.id} effect={e} onDone={removeEffect} />
      ))}
      {bulletVisual.map((b) => (
        <mesh key={b.id} position={b.pos}>
          <sphereGeometry args={[0.22, 8, 8]} />
          <meshBasicMaterial color={paint.visor} />
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
  const onHud = (next) => {
    if (next.armor < lastArmor.current && lastArmor.current !== Infinity) {
      setHit((n) => n + 1);
      sfx.hurt();
    }
    lastArmor.current = next.armor;
    setHud(next);
  };
  const playing = inGame && screen === "play" && !paused;

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
      if ((e.key === "r" || e.key === "R") && playing) {
        setAmmo(MAX_AMMO);
        network.sendReload();
        window.dispatchEvent(new CustomEvent("mechverse-reload"));
      }
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
            <div className="hud-buttons">
              <button onClick={() => setCamera((v) => (v + 1) % 3)}>
                {["Third-person", "Shoulder", "First-person"][camera]}
              </button>
              <button onClick={() => setPaused(true)}>Menu</button>
            </div>
          </div>
          <RoomPanel network={network} settings={settings} startOpen={friendsOpen} />
          <div className="crosshair" aria-hidden="true">
            <span />
          </div>
          {playing && fine() && !locked && (
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
              {button("mouse", "FIRE")}
              {button("f", "UP")}
              {button("control", "DOWN")}
              {button("shift", "DODGE")}
              {button(" ", "JUMP")}
              {connected && button("v", "FUSE")}
              {spec.repair && button("g", "REPAIR")}
            </div>
          </div>
          <div className="footer">
            {connected
              ? `PRIVATE ROOM · ${network.pvp ? "VERSUS" : "SQUAD DEFENSE"} · ${P.name.toUpperCase()}`
              : `SOLO MISSION · ${P.name.toUpperCase()}`}
          </div>
          {paused && screen === "play" && (
            <PauseMenu
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
