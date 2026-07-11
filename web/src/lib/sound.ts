// Web-Audio nature cues, ported from the prototype. Pure client-side — no assets.
// All sounds are synthesized, so there's nothing to download.

export type NatureSound = "drop" | "wind" | "bloom" | "chirp" | "chime";

let muted = false;

// A single shared AudioContext, created lazily on first use and reused for every
// sound. Creating one per click is expensive (and browsers cap the count), which
// was the source of the click-to-reaction lag.
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
  }
  // Browsers start the context suspended until a user gesture; resume on use.
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

export function playNatureSound(type: NatureSound) {
  if (muted) return;
  try {
    const ctx = getCtx();
    if (!ctx) return;

    if (type === "drop") {
      // Rain droplet — brief filtered noise click.
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 3200;
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start();
    } else if (type === "wind") {
      // Wind chime — two gentle sine waves.
      [523, 659].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
        g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.1 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 1.2);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 1.2);
      });
    } else if (type === "bloom") {
      // Bloom — bright pentatonic cascade + warm harmonics + shimmer.
      [784, 988, 1175, 1568, 1976, 2349, 3136].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        const t = ctx.currentTime + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.02, t + 0.3);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.1 - i * 0.01, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.8 - i * 0.1);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1.8);
      });
      [392, 494, 587, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.15 + 0.05;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 2.2);
      });
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const shimmer = ctx.createBufferSource();
      shimmer.buffer = buf;
      const sf = ctx.createBiquadFilter();
      sf.type = "highpass";
      sf.frequency.value = 6000;
      const sg = ctx.createGain();
      sg.gain.value = 0.08;
      shimmer.connect(sf);
      sf.connect(sg);
      sg.connect(ctx.destination);
      shimmer.start(ctx.currentTime + 0.6);
    } else if (type === "chirp") {
      // Reaction — a soft, warm bell (marimba-like): a gentle root + major third,
      // smooth decay. Pleasant, not the old harsh sweep.
      const t0 = ctx.currentTime;
      [880, 1108.73].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        const t = t0 + i * 0.035;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0006, t + 0.42);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.46);
      });
      // a quiet octave-below triangle for warmth
      const warm = ctx.createOscillator();
      const wg = ctx.createGain();
      warm.type = "triangle";
      warm.frequency.value = 440;
      wg.gain.setValueAtTime(0, t0);
      wg.gain.linearRampToValueAtTime(0.025, t0 + 0.015);
      wg.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.35);
      warm.connect(wg);
      wg.connect(ctx.destination);
      warm.start(t0);
      warm.stop(t0 + 0.4);
    } else if (type === "chime") {
      // "Someone (or an AI) just replied" — a soft, pretty three-note bell that
      // rings up (C6–E6–G6, a major chord) with a warm low octave underneath.
      // Gentle attack, long shimmering tail: a chime, never a jarring alert.
      const t0 = ctx.currentTime;
      [1046.5, 1318.5, 1568.0].forEach((freq, i) => {
        const t = t0 + i * 0.09;
        // Bell tone: a sine fundamental plus a quiet higher partial for sparkle.
        [
          { f: freq, gain: 0.09, type: "sine" as OscillatorType, tail: 1.1 },
          { f: freq * 2.01, gain: 0.02, type: "sine" as OscillatorType, tail: 0.7 },
        ].forEach(({ f, gain, type: ot, tail }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = ot;
          osc.frequency.value = f;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(gain, t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0005, t + tail);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + tail + 0.05);
        });
      });
      // Warm low octave (C5) for body, so it feels rounded, not tinny.
      const warm = ctx.createOscillator();
      const wg = ctx.createGain();
      warm.type = "triangle";
      warm.frequency.value = 523.25;
      wg.gain.setValueAtTime(0, t0);
      wg.gain.linearRampToValueAtTime(0.03, t0 + 0.02);
      wg.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.9);
      warm.connect(wg);
      wg.connect(ctx.destination);
      warm.start(t0);
      warm.stop(t0 + 1.0);
    }
  } catch {
    /* audio not available — silently ignore */
  }
}
