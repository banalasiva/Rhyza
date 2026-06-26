// Web-Audio nature cues, ported from the prototype. Pure client-side — no assets.
// All sounds are synthesized, so there's nothing to download.

export type NatureSound = "drop" | "wind" | "bloom" | "chirp";

let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

export function playNatureSound(type: NatureSound) {
  if (muted || typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();

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
      // Bird chirp — frequency sweep.
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.09, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    /* audio not available — silently ignore */
  }
}
