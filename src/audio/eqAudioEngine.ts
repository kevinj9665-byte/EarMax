import { TuningSettings } from '../types/earshot';

/**
 * Live Web Audio API audition engine for Earshot's Pro EQ.
 * Plays either a built-in warm harmonic synth reference track or a user-loaded audio track
 * through a live BiquadFilterNode chain + Preamp + Limiter + Boost so every EQ band change is audible.
 */
class EqAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private preampNode: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private limiterNode: DynamicsCompressorNode | null = null;
  private boostNode: GainNode | null = null;
  private synthTimer: number | null = null;
  private customBuffer: AudioBuffer | null = null;
  private customSource: AudioBufferSourceNode | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  async loadCustomAudio(file: File): Promise<string> {
    const ctx = this.ensureContext();
    const buf = await file.arrayBuffer();
    this.customBuffer = await ctx.decodeAudioData(buf);
    return file.name;
  }

  clearCustomAudio() {
    this.customBuffer = null;
  }

  hasCustomAudio(): boolean {
    return this.customBuffer !== null;
  }

  start(tuning: TuningSettings) {
    this.stop();
    const ctx = this.ensureContext();
    this.isPlaying = true;
    this.rebuildChain(tuning);

    if (this.customBuffer && this.preampNode) {
      const src = ctx.createBufferSource();
      src.buffer = this.customBuffer;
      src.loop = true;
      src.connect(this.preampNode);
      src.start();
      this.customSource = src;
      return;
    }

    // Warm full-spectrum reference chord & bass pulse so bass, mid, and treble EQ edits are clearly heard
    const chords = [
      [110, 220, 329.63, 440, 659.25],
      [98, 196, 293.66, 392, 587.33],
      [87.31, 174.61, 261.63, 349.23, 523.25],
      [82.41, 164.81, 246.94, 329.63, 493.88],
    ];
    let step = 0;

    const triggerBar = () => {
      if (!this.isPlaying || !this.ctx || !this.preampNode) return;
      const t = this.ctx.currentTime;
      const notes = chords[step % chords.length];
      step++;

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.preampNode) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : idx % 2 === 0 ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = idx === 0 ? 450 : 6500;

        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(idx === 0 ? 0.16 : 0.055, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.002, t + 1.55);

        osc.connect(lp);
        lp.connect(g);
        g.connect(this.preampNode);
        osc.start(t);
        osc.stop(t + 1.6);
      });

      // Crisp hi-hat tick every half-beat so high-shelf / 8-16 kHz adjustments stand out
      [0, 0.4, 0.8, 1.2].forEach((offset) => {
        if (!this.ctx || !this.preampNode) return;
        const len = Math.floor(this.ctx.sampleRate * 0.045);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 5500;
        const ng = this.ctx.createGain();
        ng.gain.value = 0.07;
        noise.connect(hp);
        hp.connect(ng);
        ng.connect(this.preampNode);
        noise.start(t + offset);
      });
    };

    triggerBar();
    this.synthTimer = window.setInterval(triggerBar, 1600);
  }

  rebuildChain(tuning: TuningSettings) {
    if (!this.ctx || !this.isPlaying) return;
    const ctx = this.ctx;

    try {
      this.preampNode?.disconnect();
      this.filterNodes.forEach((f) => f.disconnect());
      this.limiterNode?.disconnect();
      this.boostNode?.disconnect();
    } catch {
      // ignore
    }

    const preamp = ctx.createGain();
    preamp.gain.value = tuning.enabled ? Math.pow(10, tuning.preampDb / 20) : 1;

    const filters: BiquadFilterNode[] = [];
    if (tuning.enabled) {
      for (const band of tuning.bands) {
        if (!band.enabled) continue;
        const node = ctx.createBiquadFilter();
        node.type =
          band.type === 'LOW_SHELF' ? 'lowshelf' : band.type === 'HIGH_SHELF' ? 'highshelf' : 'peaking';
        node.frequency.value = Math.max(20, Math.min(20000, band.frequencyHz));
        node.Q.value = band.q;
        node.gain.value = band.gainDb;
        filters.push(node);
      }
    }

    const limiter = ctx.createDynamicsCompressor();
    if (tuning.limiterEnabled) {
      limiter.threshold.value = -1.5;
      limiter.knee.value = 2;
      limiter.ratio.value = 18;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.08;
    } else {
      limiter.threshold.value = 0;
      limiter.ratio.value = 1;
    }

    const boost = ctx.createGain();
    boost.gain.value = tuning.enabled ? Math.pow(10, tuning.boostDb / 20) : 1;

    let cursor: AudioNode = preamp;
    for (const f of filters) {
      cursor.connect(f);
      cursor = f;
    }
    cursor.connect(limiter);
    limiter.connect(boost);
    boost.connect(ctx.destination);

    if (this.customSource) {
      try {
        this.customSource.disconnect();
        this.customSource.connect(preamp);
      } catch {
        // ignore
      }
    }

    this.preampNode = preamp;
    this.filterNodes = filters;
    this.limiterNode = limiter;
    this.boostNode = boost;
  }

  stop() {
    this.isPlaying = false;
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.customSource) {
      try {
        this.customSource.stop();
        this.customSource.disconnect();
      } catch {
        // ignore
      }
      this.customSource = null;
    }
    try {
      this.preampNode?.disconnect();
      this.filterNodes.forEach((f) => f.disconnect());
      this.limiterNode?.disconnect();
      this.boostNode?.disconnect();
    } catch {
      // ignore
    }
    this.preampNode = null;
    this.filterNodes = [];
    this.limiterNode = null;
    this.boostNode = null;
  }
}

export const eqAudioEngine = new EqAudioEngine();
