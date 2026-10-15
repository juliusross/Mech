import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { CLASSES, WEAPONS, WEAPON_IDS } from "../shared/arena.js";
import { PLANETS, PLANET_IDS, planetOf } from "../shared/planets.js";
import { PAINT_PRESETS } from "./settings.js";
import { Mech } from "./Mech.jsx";
import { HangarBay } from "./HangarBay.jsx";
import { sfx } from "./audio.js";
import { GAMEPAD_HELP, currentPad } from "./gamepad.js";

const CLASS_IDS = Object.keys(CLASSES);
const maxOf = (k) => Math.max(...CLASS_IDS.map((id) => CLASSES[id][k]));
const STATS = [
  ["Armor", (c) => c.armor / maxOf("armor")],
  ["Speed", (c) => c.speed / maxOf("speed")],
  ["Firepower", (c) => c.damage / maxOf("damage")],
  ["Fire rate", (c) => Math.min(...CLASS_IDS.map((id) => CLASSES[id].fireInterval)) / c.fireInterval],
];

function Turntable({ children }) {
  const g = useRef();
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.45;
  });
  return <group ref={g}>{children}</group>;
}

function LookAt({ y }) {
  useFrame(({ camera }) => camera.lookAt(0, y, 0));
  return null;
}

export function MechPreview({ cls, paint, loadout, className = "preview", far = false }) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        shadows
        camera={far ? { position: [0, 3.6, 17], fov: 34 } : { position: [0, 3.4, 11], fov: 40 }}
      >
        <LookAt y={2.7} />
        <hemisphereLight args={["#cfe8ff", "#1a2533", 0.9]} />
        <directionalLight position={[6, 10, 6]} intensity={2.6} castShadow />
        <directionalLight position={[-6, 4, -6]} intensity={1.2} color="#6fb8ff" />
        <Turntable>
          {/* Normalise class size so every Titan fits the preview. */}
          <group position={[0, -0.2, 0]} scale={1 / CLASSES[cls].scale}>
            <Mech cls={cls} paint={paint} loadout={loadout} idle />
          </group>
        </Turntable>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.21, 0]} receiveShadow>
          <circleGeometry args={[3.4, 48]} />
          <meshStandardMaterial color="#14283b" metalness={0.4} roughness={0.5} />
        </mesh>
      </Canvas>
    </div>
  );
}

const go = (fn) => () => {
  sfx.click();
  fn();
};

export function MainMenu({ settings, onSolo, onFriends, onHangar, onSettings, inviteRoom }) {
  return (
    <div className="menu main-menu">
      <MechPreview cls={settings.cls} paint={settings.paint} loadout={settings.weapon} className="preview backdrop" far />
      <div className="menu-panel title-panel">
        <h1>
          MECH<span>VERSE</span>
        </h1>
        <p className="tagline">Pilot a Titan. Defend six worlds. Fuse with your squad.</p>
        {inviteRoom && (
          <p className="invite-note">
            You were invited to room <strong>{inviteRoom}</strong>.
          </p>
        )}
        <nav className="menu-buttons">
          {inviteRoom ? (
            <button className="primary" onClick={go(onFriends)}>
              Join your friend
            </button>
          ) : (
            <button className="primary" onClick={go(onSolo)}>
              Solo mission
            </button>
          )}
          <button onClick={go(onFriends)}>{inviteRoom ? "Other room options" : "Play with friends"}</button>
          {inviteRoom && <button onClick={go(onSolo)}>Solo mission</button>}
          <button onClick={go(onHangar)}>Hangar · mech &amp; paint</button>
          <button onClick={go(onSettings)}>Settings</button>
        </nav>
        <p className="pilot-line">
          Pilot <strong>{settings.name || "unnamed"}</strong> · {CLASSES[settings.cls].name} ·{" "}
          {planetOf(settings.planet).name}
        </p>
      </div>
    </div>
  );
}

export function Hangar({ settings, update, onBack, onDeploy, deployLabel = "Choose planet", locked }) {
  const spec = CLASSES[settings.cls];
  const setPaint = (key, value) => update({ paint: { ...settings.paint, [key]: value } });
  return (
    <div className="menu hangar bay-layout">
      {/* Cinematic bay: the Titan stands on the left, choices on the right. */}
      <div className="bay-stage" aria-label={`${spec.name} in the hangar bay`}>
        <HangarBay cls={settings.cls} paint={settings.paint} loadout={settings.weapon} />
        <div className="bay-caption">
          <small>MECH BAY 07 · READY</small>
          <strong>{spec.name}</strong>
          <span>
            {spec.armor} armor · {WEAPONS[settings.weapon]?.name}
            {spec.repair ? " · G repair" : ""}
          </span>
        </div>
      </div>
      <aside className="bay-panel">
      <header className="menu-header">
        <button onClick={go(onBack)}>← Back</button>
        <h2>Hangar</h2>
        <button className="primary" onClick={go(onDeploy)}>
          {deployLabel} →
        </button>
      </header>
      <div className="bay-sections">
        <section aria-labelledby="mech-select">
          <h3 id="mech-select">Mech selection</h3>
          {locked && <p className="note">{locked}</p>}
          <div className="class-cards">
            {CLASS_IDS.map((id) => {
              const c = CLASSES[id];
              return (
                <button
                  key={id}
                  className="class-card"
                  aria-pressed={settings.cls === id}
                  disabled={Boolean(locked)}
                  onClick={go(() => update({ cls: id }))}
                >
                  <strong>{c.name}</strong>
                  <span>{c.blurb}</span>
                  {STATS.map(([label, f]) => (
                    <span key={label} className="stat">
                      <em>{label}</em>
                      <i style={{ width: `${Math.round(f(c) * 100)}%` }} />
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        </section>
        <section aria-labelledby="paint">
          <h3 id="weapons">Weapon loadout</h3>
          <div className="weapon-cards" role="group" aria-labelledby="weapons">
            {WEAPON_IDS.map((id) => {
              const w = WEAPONS[id];
              const bars = [
                ["Damage", w.damage / 3],
                ["Fire rate", 0.4 / w.rate],
                ["Velocity", w.speed / 2.4],
              ];
              return (
                <button
                  key={id}
                  className="class-card weapon-card"
                  aria-pressed={settings.weapon === id}
                  onClick={go(() => update({ weapon: id }))}
                >
                  <strong>{w.name}</strong>
                  <span>{w.blurb}</span>
                  {bars.map(([label, f]) => (
                    <span key={label} className="stat">
                      <em>{label}</em>
                      <i style={{ width: `${Math.round(Math.min(1, f) * 100)}%` }} />
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
          <h3 id="paint">Customize paint</h3>
          <div className="swatches">
            {PAINT_PRESETS.map((p) => (
              <button
                key={p.name}
                className="swatch"
                title={p.name}
                aria-label={`${p.name} paint`}
                aria-pressed={
                  p.primary === settings.paint.primary &&
                  p.secondary === settings.paint.secondary &&
                  p.visor === settings.paint.visor
                }
                onClick={go(() => update({ paint: { primary: p.primary, secondary: p.secondary, visor: p.visor } }))}
              >
                <span style={{ background: p.primary }} />
                <span style={{ background: p.secondary }} />
                <span style={{ background: p.visor }} />
                <small>{p.name}</small>
              </button>
            ))}
          </div>
          {[
            ["primary", "Armor plates"],
            ["secondary", "Frame"],
            ["visor", "Visor & glow"],
          ].map(([key, label]) => (
            <label key={key} className="color-row">
              <input type="color" value={settings.paint[key]} onChange={(e) => setPaint(key, e.target.value)} />
              {label}
              <code>{settings.paint[key]}</code>
            </label>
          ))}
        </section>
      </div>
      </aside>
    </div>
  );
}

export function PlanetSelect({ settings, update, onBack, onLaunch, launchLabel = "Launch" }) {
  return (
    <div className="menu planets">
      <header className="menu-header">
        <button onClick={go(onBack)}>← Back</button>
        <h2>Choose a planet</h2>
        <button className="primary" onClick={go(() => onLaunch(settings.planet))}>
          {launchLabel} →
        </button>
      </header>
      <div className="planet-grid">
        {PLANET_IDS.map((id) => {
          const P = PLANETS[id];
          return (
            <button
              key={id}
              className="planet-card"
              aria-pressed={settings.planet === id}
              onClick={go(() => update({ planet: id }))}
              onDoubleClick={() => {
                update({ planet: id });
                onLaunch(id);
              }}
            >
              <span
                className="planet-art"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${P.sun} 0, ${P.ground} 38%, ${P.sky} 72%)`,
                }}
              />
              <strong>
                {P.name}
                {settings.cleared?.includes(id) ? " ✓" : ""}
              </strong>
              <span>{P.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Live view of what the browser reports for the controller, for troubleshooting. */
function ControllerTest() {
  const [state, setState] = React.useState(null);
  React.useEffect(() => {
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const all = [...(navigator.getGamepads?.() || [])].filter(Boolean);
      const pad = currentPad();
      setState(
        pad
          ? {
              count: all.length,
              id: pad.id,
              mapping: pad.mapping || "non-standard",
              buttons: pad.buttons.map((b, i) => (b.pressed || b.value > 0.5 ? i : null)).filter((i) => i !== null),
              axes: pad.axes.slice(0, 4).map((a) => a.toFixed(2)),
            }
          : null,
      );
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pad-test" aria-live="polite">
      <h3>Controller</h3>
      {state ? (
        <>
          <p>
            Using: <strong>{state.id}</strong>
            {state.count > 1 ? ` (${state.count} devices found; press a button on your controller to select it)` : ""}
          </p>
          <p>
            Layout: {state.mapping} · Buttons held: {state.buttons.length ? state.buttons.join(", ") : "none"} · Sticks: {state.axes.join(" / ")}
          </p>
        </>
      ) : (
        <p>No controller detected. Connect it, then press any button (browsers hide controllers until a button is pressed).</p>
      )}
    </div>
  );
}

export function Settings({ settings, update, onBack }) {
  return (
    <div className="menu settings">
      <header className="menu-header">
        <button onClick={go(onBack)}>← Back</button>
        <h2>Settings</h2>
        <span />
      </header>
      <div className="menu-panel form">
        <label>
          Pilot name
          <input
            maxLength={20}
            value={settings.name}
            autoComplete="nickname"
            placeholder="Your callsign"
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          Sound volume <output>{Math.round(settings.volume * 100)}%</output>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </label>
        <label>
          Mouse sensitivity <output>{settings.sensitivity.toFixed(1)}×</output>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={settings.sensitivity}
            onChange={(e) => update({ sensitivity: Number(e.target.value) })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.invertY}
            onChange={(e) => update({ invertY: e.target.checked })}
          />
          Invert vertical aim
        </label>
        <ControllerTest />
        <h3>Controls</h3>
        <dl className="controls-list">
          <dt>Click arena</dt>
          <dd>Lock the mouse for aiming (Esc releases it and pauses)</dd>
          <dt>Mouse</dt>
          <dd>Aim · hold left button to fire</dd>
          <dt>WASD</dt>
          <dd>Move · Q/E also turn</dd>
          <dt>Space / F / Ctrl</dt>
          <dd>Jump / thrust up / descend</dd>
          <dt>Shift</dt>
          <dd>Dodge in a Titan · sprint on foot</dd>
          <dt>X</dt>
          <dd>Exit a landed Titan · enter your Titan when nearby</dd>
          <dt>R · G · V</dt>
          <dd>Reload · Repair (Support) · Fuse with a nearby squadmate</dd>
          {GAMEPAD_HELP.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>🎮 {k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
          <dt>Touch</dt>
          <dd>Drag the arena to aim; use the on-screen buttons</dd>
        </dl>
      </div>
    </div>
  );
}

export function PauseMenu({ onResume, onFriends, onHangar, onSettings, onQuit, connected }) {
  return (
    <div className="menu pause" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="menu-panel">
        <h2>Paused</h2>
        {connected && <p className="note">Your squad keeps playing while you are paused.</p>}
        <nav className="menu-buttons">
          <button className="primary" onClick={go(onResume)}>
            Resume
          </button>
          <button onClick={go(onFriends)}>{connected ? "Squad & invite link" : "Play with friends"}</button>
          <button onClick={go(onHangar)}>Hangar · mech &amp; paint</button>
          <button onClick={go(onSettings)}>Settings</button>
          <button onClick={go(onQuit)}>{connected ? "Leave room" : "Main menu"}</button>
        </nav>
      </div>
    </div>
  );
}
