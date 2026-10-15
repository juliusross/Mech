// Synthesised sound effects (Web Audio). Nothing to download; the context is
// created on the first user gesture because browsers block autoplay.
let ctx = null;
let master = null;
let noise = null;
let volume = 0.7;

export function initAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

function env(gain, t, attack, peak, decay) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone({ type = "sine", from, to, dur, peak = 0.3, delay = 0, level = 1 }) {
  if (!ctx || !level) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  env(gain, t, 0.005, peak * level, dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function burst({ dur, peak = 0.3, filter = "lowpass", from = 3000, to = 200, delay = 0, level = 1 }) {
  if (!ctx || !level) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  const gain = ctx.createGain();
  env(gain, t, 0.004, peak * level, dur);
  src.connect(f).connect(gain).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Volume falloff for a sound at `distance` metres from the listener. */
export const near = (distance) => Math.max(0, 1 - distance / 90);

export const sfx = {
  shot(heavy = false, level = 1) {
    tone({ type: "sawtooth", from: heavy ? 520 : 980, to: heavy ? 70 : 140, dur: heavy ? 0.2 : 0.11, peak: 0.14, level });
    burst({ dur: heavy ? 0.16 : 0.07, peak: heavy ? 0.22 : 0.12, from: 5000, to: 600, level });
  },
  hit(level = 1) {
    burst({ dur: 0.06, peak: 0.18, filter: "highpass", from: 2500, to: 1800, level });
  },
  beam(level = 1) {
    tone({ type: "sawtooth", from: 1550, to: 950, dur: 0.14, peak: 0.09, level });
  },
  slash(level = 1) {
    burst({ dur: 0.18, peak: 0.18, filter: "highpass", from: 1300, to: 4500, level });
  },
  pickup(level = 1) {
    [659, 880, 1175].forEach((f, i) => tone({ type: "triangle", from: f, to: f * 1.15, dur: 0.13, peak: 0.09, delay: i * 0.07, level }));
  },
  hurt() {
    tone({ type: "square", from: 160, to: 60, dur: 0.18, peak: 0.18 });
    burst({ dur: 0.12, peak: 0.2, from: 900, to: 120 });
  },
  boom(level = 1) {
    burst({ dur: 0.75, peak: 0.45, from: 1400, to: 50, level });
    tone({ from: 110, to: 30, dur: 0.6, peak: 0.35, level });
  },
  bolt(level = 1) {
    tone({ type: "triangle", from: 1500, to: 520, dur: 0.16, peak: 0.08, level });
  },
  repair(level = 1) {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ type: "triangle", from: f, to: f, dur: 0.18, peak: 0.12, delay: i * 0.07, level }),
    );
  },
  down(level = 1) {
    tone({ type: "sawtooth", from: 340, to: 45, dur: 0.9, peak: 0.2, level });
    burst({ dur: 0.5, peak: 0.25, from: 1200, to: 80, level });
  },
  fuse(level = 1) {
    [200, 300, 400].forEach((f, i) =>
      tone({ type: "sawtooth", from: f, to: f * 4, dur: 0.8, peak: 0.08, delay: i * 0.04, level }),
    );
    burst({ dur: 0.9, peak: 0.2, filter: "bandpass", from: 400, to: 3000, level });
  },
  unfuse(level = 1) {
    tone({ type: "sawtooth", from: 800, to: 180, dur: 0.6, peak: 0.12, level });
  },
  warn(level = 1) {
    tone({ type: "square", from: 880, to: 880, dur: 0.09, peak: 0.06, level });
    tone({ type: "square", from: 880, to: 880, dur: 0.09, peak: 0.06, delay: 0.18, level });
  },
  strike(level = 1) {
    burst({ dur: 0.08, peak: 0.5, filter: "highpass", from: 6000, to: 3000, level });
    burst({ dur: 1.1, peak: 0.4, from: 800, to: 40, delay: 0.05, level });
  },
  wave() {
    [392, 523, 659].forEach((f, i) =>
      tone({ type: "triangle", from: f, to: f, dur: 0.25, peak: 0.12, delay: i * 0.12 }),
    );
  },
  click() {
    tone({ type: "triangle", from: 1200, to: 900, dur: 0.05, peak: 0.08 });
  },
};

// Infantry: a tiny, quiet scream (no words), kept low in the mix.
let lastScream = 0;
function scream(level) {
  if (!ctx || level <= 0.05) return;
  const now = performance.now();
  if (now - lastScream < 180) return;
  lastScream = now;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const vib = ctx.createOscillator();
  const vibGain = ctx.createGain();
  const gain = ctx.createGain();
  const f = ctx.createBiquadFilter();
  osc.type = "sawtooth";
  const pitch = 900 + Math.random() * 400;
  osc.frequency.setValueAtTime(pitch, t);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.45, t + 0.38);
  vib.frequency.value = 28;
  vibGain.gain.value = 40;
  vib.connect(vibGain).connect(osc.frequency);
  f.type = "bandpass";
  f.frequency.value = 1600;
  f.Q.value = 2;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.045 * level, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  osc.connect(f).connect(gain).connect(master);
  osc.start(t);
  vib.start(t);
  osc.stop(t + 0.45);
  vib.stop(t + 0.45);
}
sfx.splat = (level = 1) => {
  burst({ dur: 0.18, peak: 0.22, from: 900, to: 120, level });
  scream(level);
};
sfx.ouch = (level = 1) => {
  if (Math.random() < 0.6) scream(level * 0.7);
};

sfx.eject = (level = 1) => {
  burst({ dur: 0.35, peak: 0.35, filter: "highpass", from: 3000, to: 900, level });
  tone({ type: "square", from: 600, to: 1200, dur: 0.25, peak: 0.08, level });
};
sfx.mechdrop = (level = 1) => {
  tone({ type: "sawtooth", from: 90, to: 40, dur: 1.4, peak: 0.25, level });
  burst({ dur: 1.2, peak: 0.4, from: 2000, to: 60, delay: 0.25, level });
  [523, 784, 1046].forEach((f, i) => tone({ type: "triangle", from: f, to: f, dur: 0.2, peak: 0.1, delay: 0.5 + i * 0.1, level }));
};

/* ---------- looping sounds: rocket booster and planet ambience ---------- */
function noiseLoop() {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  return src;
}

let booster = null;
/** Rocket booster roar while the Titan is thrusting upward. */
sfx.booster = (on) => {
  if (!ctx) return;
  if (on && !booster) {
    const src = noiseLoop();
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700;
    f.Q.value = 0.8;
    const rumble = ctx.createOscillator();
    rumble.type = "sawtooth";
    rumble.frequency.value = 55;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.05;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.15);
    src.connect(f).connect(gain);
    rumble.connect(rumbleGain).connect(gain);
    gain.connect(master);
    src.start();
    rumble.start();
    booster = { src, rumble, gain };
  } else if (!on && booster) {
    const b = booster;
    booster = null;
    b.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    setTimeout(() => {
      b.src.stop();
      b.rumble.stop();
    }, 400);
  }
};

// Ambience recipes: a filtered noise bed plus occasional one-shot details.
const AMBIENCE = {
  nature: { bed: ["lowpass", 500, 0.045], swell: 0.25, birds: 1 },
  jungle: { bed: ["bandpass", 4200, 0.02], bed2: ["lowpass", 400, 0.03], swell: 0.35, birds: 1.6, insects: true },
  wind: { bed: ["bandpass", 450, 0.09], swell: 0.7, gusts: true },
  storm: { bed: ["highpass", 2500, 0.06], bed2: ["lowpass", 160, 0.05], swell: 0.2, thunder: true },
  volcanic: { bed: ["lowpass", 120, 0.1], swell: 0.3, crackle: true },
  moon: { hum: 48, bed: ["lowpass", 200, 0.012], swell: 0.1 },
  bay: { hum: 60, bed: ["bandpass", 900, 0.02], bed2: ["lowpass", 140, 0.04], swell: 0.15, clanks: true },
};
let ambience = null;
function stopAmbience() {
  if (!ambience) return;
  const a = ambience;
  ambience = null;
  clearInterval(a.timer);
  a.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
  setTimeout(() => a.nodes.forEach((n) => n.stop?.()), 2500);
}
function bed(type, freq, level, out, nodes) {
  const src = noiseLoop();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(f).connect(g).connect(out);
  src.start();
  nodes.push(src);
  return g;
}
function chirp(out) {
  const t = ctx.currentTime;
  const base = 2200 + Math.random() * 2400;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    const s0 = t + i * (0.09 + Math.random() * 0.05);
    o.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), s0);
    o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.6), s0 + 0.07);
    g.gain.setValueAtTime(0.0001, s0);
    g.gain.exponentialRampToValueAtTime(0.03, s0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.08);
    o.connect(g).connect(out);
    o.start(s0);
    o.stop(s0 + 0.1);
  }
}
/** Starts the looping background soundscape for a planet (or "bay"); null stops it. */
export function setAmbience(kind) {
  if (!ctx) return;
  if (ambience?.kind === kind) return;
  stopAmbience();
  const A = AMBIENCE[kind];
  if (!A) return;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
  out.connect(master);
  const nodes = [];
  const g1 = bed(...A.bed, out, nodes);
  if (A.bed2) bed(...A.bed2, out, nodes);
  if (A.hum) {
    const o = ctx.createOscillator();
    o.frequency.value = A.hum;
    const g = ctx.createGain();
    g.gain.value = 0.025;
    o.connect(g).connect(out);
    o.start();
    nodes.push(o);
  }
  const level = A.bed[2];
  const timer = setInterval(() => {
    const t = ctx.currentTime;
    // Slow swells (wind gusts, breeze) on the main bed.
    g1.gain.setTargetAtTime(level * (1 - A.swell / 2 + Math.random() * A.swell), t, A.gusts ? 0.6 : 1.5);
    if (A.birds && Math.random() < 0.35 * A.birds) chirp(out);
    if (A.insects && Math.random() < 0.3) tone({ type: "square", from: 5200, to: 5000, dur: 0.6, peak: 0.004 });
    if (A.thunder && Math.random() < 0.06) burst({ dur: 2.2, peak: 0.25, from: 300, to: 40, delay: Math.random() });
    if (A.crackle && Math.random() < 0.5) burst({ dur: 0.04, peak: 0.05, filter: "highpass", from: 3000, to: 2500 });
    if (A.clanks && Math.random() < 0.18) {
      tone({ type: "triangle", from: 300 + Math.random() * 400, to: 200, dur: 0.25, peak: 0.03 });
      burst({ dur: 0.08, peak: 0.04, filter: "bandpass", from: 1800, to: 1200 });
    }
  }, 700);
  ambience = { kind, out, nodes, timer };
}
