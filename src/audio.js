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
