import { useEffect, useRef, useState } from "react";

// Standard-mapping gamepad (Xbox / PlayStation / Switch Pro layout).
//   Left stick move · Right stick aim · RT fire · LT repair · A jump · B dodge
//   X reload · Y fuse · RB thrust up · LB descend · D-pad down exit/enter Titan
//   View/Select camera · Start/Menu pause. In menus: D-pad/stick to move, A to
//   select, B to go back.
const DEAD = 0.22;
const BUTTON_KEYS = { 0: " ", 1: "shift", 3: "v", 4: "control", 5: "f", 6: "g", 7: "mouse", 13: "x" };
const AIM_SPEED = 900; // aim units per second at full stick

export const GAMEPAD_HELP = [
  ["Left stick", "Move"],
  ["Right stick", "Aim"],
  ["RT / R2", "Fire"],
  ["LT / L2", "Repair (Support)"],
  ["A / ✕", "Jump"],
  ["B / ◯", "Dodge"],
  ["X / ▢", "Reload"],
  ["Y / △", "Fuse"],
  ["RB / LB", "Thrust up / descend"],
  ["D-pad ↓", "Exit or enter Titan"],
  ["View", "Camera"],
  ["Start", "Pause menu"],
];

const pressedOf = (b) => (typeof b === "object" ? b.pressed || b.value > 0.5 : b > 0.5);
const active = (pad) => pad.buttons.some(pressedOf) || pad.axes.some((a) => Math.abs(a) > 0.5);

// Some systems list extra "gamepads" (headsets, keyboards, stale Bluetooth
// pairings) ahead of the real controller. Follow whichever pad was last used.
let activeIndex = null;
export function currentPad() {
  const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
  if (!pads.length) return null;
  const touched = pads.find(active);
  if (touched) activeIndex = touched.index;
  return pads.find((p) => p.index === activeIndex) || pads.find((p) => p.mapping === "standard") || pads[0];
}

function focusables() {
  const root = document.querySelector(".room-panel") || document.querySelector(".menu.pause") || document.querySelector(".menu");
  if (!root) return [];
  return [...root.querySelectorAll("button:not([disabled]), input, select")].filter((el) => el.offsetParent !== null);
}
function moveFocus(dir) {
  const items = focusables();
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  const next = items[(i + dir + items.length) % items.length] || items[0];
  next.focus();
  next.scrollIntoView?.({ block: "nearest" });
}

/**
 * Polls the first connected gamepad every frame and feeds the same controls
 * set and aim accumulator the keyboard and mouse use.
 */
export function useGamepad({ controls, aim, playing, sensitivity, invertY, onReload, onPause, onCamera, onBack }) {
  const [connected, setConnected] = useState(null);
  const held = useRef(new Set());
  const prev = useRef([]);
  const nav = useRef(0);
  const live = useRef({});
  live.current = { playing, sensitivity, invertY, onReload, onPause, onCamera, onBack };

  useEffect(() => {
    const on = (e) => {
      activeIndex = e.gamepad.index;
      setConnected(e.gamepad.id);
    };
    const off = () => setConnected(null);
    window.addEventListener("gamepadconnected", on);
    window.addEventListener("gamepaddisconnected", off);
    let raf,
      last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pad = currentPad();
      if (!pad) {
        // Release anything the pad was holding when it disconnects.
        for (const k of held.current) controls.current.delete(k);
        held.current.clear();
        return;
      }
      const L = live.current;
      const down = pad.buttons.map(pressedOf);
      const edge = (i) => down[i] && !prev.current[i];
      const want = new Set();
      if (L.playing) {
        const [lx, ly, rx, ry] = pad.axes;
        if (ly < -DEAD) want.add("w");
        if (ly > DEAD) want.add("s");
        if (lx < -DEAD) want.add("a");
        if (lx > DEAD) want.add("d");
        for (const [i, key] of Object.entries(BUTTON_KEYS)) if (down[i]) want.add(key);
        const curve = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * ((Math.abs(v) - DEAD) / (1 - DEAD)) ** 1.6);
        aim.current.dx += curve(rx) * AIM_SPEED * dt * L.sensitivity;
        aim.current.dy += curve(ry) * AIM_SPEED * 0.7 * dt * L.sensitivity;
        if (edge(2)) L.onReload?.();
        if (edge(8)) L.onCamera?.();
        if (edge(9)) L.onPause?.();
      } else {
        // Menu navigation.
        const y = pad.axes[1] || 0;
        const dir = down[12] || y < -0.6 ? -1 : down[13] || y > 0.6 ? 1 : 0;
        if (dir && now >= nav.current) {
          moveFocus(dir);
          nav.current = now + (nav.current && prev.current.navDir === dir ? 140 : 320);
        }
        if (!dir) nav.current = 0;
        prev.current.navDir = dir;
        if (edge(0)) {
          const el = document.activeElement;
          if (el && focusables().includes(el)) el.click();
          else moveFocus(1);
        }
        if (edge(1)) L.onBack?.();
        if (edge(9)) L.onPause?.();
      }
      // Sync pad-held keys into the shared controls set.
      for (const k of held.current) if (!want.has(k)) controls.current.delete(k);
      for (const k of want) controls.current.add(k);
      held.current = want;
      prev.current = Object.assign(down, { navDir: prev.current.navDir });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("gamepadconnected", on);
      window.removeEventListener("gamepaddisconnected", off);
    };
  }, []);
  return connected;
}
