import { SleepLayer, SoundSide } from '../types/earshot';

/**
 * Web Audio procedural soundscape, alarm tone, and Find My Headphones beacon synthesizer.
 * Mirrors Earshot's dsp/sleep synthesis architecture cleanly in Web Audio API.
 */
class SleepAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private activeNodes: AudioNode[] = [];
  private timers: number[] = [];
  private customBuffers = new Map<string, AudioBuffer>();
  private alarmTimer: number | null = null;
  private findTimer: number | null = null;
  private findNodes: AudioNode[] = [];

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

  async decodeCustomSound(id: string, arrayBuffer: ArrayBuffer): Promise<number> {
    const ctx = this.ensureContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    this.customBuffers.set(id, decoded);
    return Math.max(1, Math.round(decoded.duration));
  }

  private createNoiseBuffer(ctx: AudioContext, color: 'white' | 'pink' | 'brown', seconds = 4): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      if (color === 'white') {
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.45;
        }
      } else if (color === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
          b6 = white * 0.115926;
        }
      } else {
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 2.2;
        }
      }
    }
    return buf;
  }

  startSoundscape(layers: SleepLayer[], volume: number, side: SoundSide) {
    this.stopSoundscape();
    if (layers.length === 0) return;

    const ctx = this.ensureContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.65), ctx.currentTime + 0.6);

    const panner = ctx.createStereoPanner();
    panner.pan.value = side === 'LEFT_ONLY' ? -1 : side === 'RIGHT_ONLY' ? 1 : 0;

    if (side === 'MONO') {
      master.channelCount = 1;
      master.channelCountMode = 'explicit';
    }

    master.connect(panner);
    panner.connect(ctx.destination);
    this.masterGain = master;
    this.panner = panner;

    layers.forEach((layer) => {
      const layerGain = ctx.createGain();
      layerGain.gain.value = Math.max(0.02, Math.min(1, layer.gain));
      layerGain.connect(master);
      this.activeNodes.push(layerGain);

      const customBuf = this.customBuffers.get(layer.soundId);
      if (customBuf) {
        const src = ctx.createBufferSource();
        src.buffer = customBuf;
        src.loop = true;
        src.connect(layerGain);
        src.start();
        this.activeNodes.push(src);
        return;
      }

      if (layer.soundId === 'rain' || layer.soundId === 'heavy_rain') {
        const src = ctx.createBufferSource();
        src.buffer = this.createNoiseBuffer(ctx, 'pink', 5);
        src.loop = true;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = layer.soundId === 'heavy_rain' ? 2400 : 3800;

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = layer.soundId === 'heavy_rain' ? 140 : 280;

        src.connect(hp);
        hp.connect(lp);
        lp.connect(layerGain);
        src.start();
        this.activeNodes.push(src, hp, lp);
      } else if (layer.soundId === 'ocean') {
        const src = ctx.createBufferSource();
        src.buffer = this.createNoiseBuffer(ctx, 'brown', 6);
        src.loop = true;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 650;

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.11; // ~9s ocean wave swell
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 420;
        lfo.connect(lfoGain);
        lfoGain.connect(lp.frequency);

        const ampMod = ctx.createGain();
        ampMod.gain.value = 0.65;
        const ampLfo = ctx.createGain();
        ampLfo.gain.value = 0.35;
        lfo.connect(ampLfo);
        ampLfo.connect(ampMod.gain);

        src.connect(lp);
        lp.connect(ampMod);
        ampMod.connect(layerGain);
        src.start();
        lfo.start();
        this.activeNodes.push(src, lp, lfo, lfoGain, ampMod, ampLfo);
      } else if (layer.soundId === 'fire') {
        const src = ctx.createBufferSource();
        src.buffer = this.createNoiseBuffer(ctx, 'brown', 5);
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        src.connect(lp);
        lp.connect(layerGain);
        src.start();
        this.activeNodes.push(src, lp);

        // Occasional crackle pops
        const crackleTimer = window.setInterval(() => {
          if (!this.ctx || !this.masterGain) return;
          if (Math.random() > 0.45) return;
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1400 + Math.random() * 2400, t);
          osc.frequency.exponentialRampToValueAtTime(300, t + 0.025);
          g.gain.setValueAtTime(0.08 * layer.gain, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
          osc.connect(g);
          g.connect(layerGain);
          osc.start(t);
          osc.stop(t + 0.035);
        }, 180);
        this.timers.push(crackleTimer);
      } else if (layer.soundId === 'stream') {
        const src = ctx.createBufferSource();
        src.buffer = this.createNoiseBuffer(ctx, 'pink', 5);
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1100;
        bp.Q.value = 1.4;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.35;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 260;
        lfo.connect(lfoGain);
        lfoGain.connect(bp.frequency);
        src.connect(bp);
        bp.connect(layerGain);
        src.start();
        lfo.start();
        this.activeNodes.push(src, bp, lfo, lfoGain);
      } else if (layer.soundId === 'wind') {
        const src = ctx.createBufferSource();
        src.buffer = this.createNoiseBuffer(ctx, 'pink', 6);
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 480;
        bp.Q.value = 2.2;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 210;
        lfo.connect(lfoGain);
        lfoGain.connect(bp.frequency);
        src.connect(bp);
        bp.connect(layerGain);
        src.start();
        lfo.start();
        this.activeNodes.push(src, bp, lfo, lfoGain);
      } else if (layer.soundId === 'fan') {
        const src = ctx.createBufferSource();
        src.buffer = this.createNoiseBuffer(ctx, 'brown', 4);
        src.loop = true;
        const hum = ctx.createOscillator();
        hum.type = 'sine';
        hum.frequency.value = 96;
        const humGain = ctx.createGain();
        humGain.gain.value = 0.06;
        hum.connect(humGain);
        humGain.connect(layerGain);
        src.connect(layerGain);
        src.start();
        hum.start();
        this.activeNodes.push(src, hum, humGain);
      } else {
        const color = layer.soundId === 'white_noise' ? 'white' : layer.soundId === 'pink_noise' ? 'pink' : 'brown';
        const src = ctx.createBufferSource();
        src.buffer = this.createNoiseBuffer(ctx, color, 4);
        src.loop = true;
        src.connect(layerGain);
        src.start();
        this.activeNodes.push(src);
      }
    });
  }

  updateSoundscapeVolume(volume: number, side: SoundSide) {
    if (!this.ctx || !this.masterGain || !this.panner) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0.005, volume * 0.65), this.ctx.currentTime, 0.08);
    this.panner.pan.setTargetAtTime(side === 'LEFT_ONLY' ? -1 : side === 'RIGHT_ONLY' ? 1 : 0, this.ctx.currentTime, 0.08);
  }

  stopSoundscape() {
    this.timers.forEach((id) => window.clearInterval(id));
    this.timers = [];
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioBufferSourceNode).stop === 'function') {
          (node as AudioBufferSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore already stopped
      }
    });
    this.activeNodes = [];
    try {
      this.masterGain?.disconnect();
      this.panner?.disconnect();
    } catch {
      // ignore
    }
    this.masterGain = null;
    this.panner = null;
  }

  startAlarmTone(toneId: string) {
    this.stopAlarmTone();
    const ctx = this.ensureContext();
    const playPulse = () => {
      const t = ctx.currentTime;
      if (toneId === 'classic') {
        [0, 0.16, 0.32].forEach((offset) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 880;
          g.gain.setValueAtTime(0.001, t + offset);
          g.gain.linearRampToValueAtTime(0.22, t + offset + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.12);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t + offset);
          osc.stop(t + offset + 0.14);
        });
      } else if (toneId === 'birds') {
        [0, 0.25, 0.55].forEach((offset, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          const base = 1800 + idx * 320;
          osc.frequency.setValueAtTime(base, t + offset);
          osc.frequency.exponentialRampToValueAtTime(base * 1.45, t + offset + 0.08);
          osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + offset + 0.16);
          g.gain.setValueAtTime(0.001, t + offset);
          g.gain.linearRampToValueAtTime(0.14, t + offset + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.18);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t + offset);
          osc.stop(t + offset + 0.2);
        });
      } else {
        // Warm harmonic chime (default)
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          g.gain.setValueAtTime(0.001, t + i * 0.14);
          g.gain.linearRampToValueAtTime(0.16, t + i * 0.14 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.9);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t + i * 0.14);
          osc.stop(t + i * 0.14 + 0.95);
        });
      }
    };

    playPulse();
    this.alarmTimer = window.setInterval(playPulse, 1800);
  }

  stopAlarmTone() {
    if (this.alarmTimer !== null) {
      window.clearInterval(this.alarmTimer);
      this.alarmTimer = null;
    }
  }

  startFindBeacon(channel: 'BOTH' | 'LEFT' | 'RIGHT', volume: number) {
    this.stopFindBeacon();
    const ctx = this.ensureContext();
    const pan = ctx.createStereoPanner();
    pan.pan.value = channel === 'LEFT' ? -1 : channel === 'RIGHT' ? 1 : 0;
    const master = ctx.createGain();
    master.gain.value = Math.max(0.02, Math.min(1, volume)) * 0.4;
    master.connect(pan);
    pan.connect(ctx.destination);
    this.findNodes.push(master, pan);

    const chirp = () => {
      const t = ctx.currentTime;
      [0, 0.22].forEach((offset) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2200, t + offset);
        osc.frequency.exponentialRampToValueAtTime(3400, t + offset + 0.14);
        g.gain.setValueAtTime(0.001, t + offset);
        g.gain.linearRampToValueAtTime(0.7, t + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.17);
        osc.connect(g);
        g.connect(master);
        osc.start(t + offset);
        osc.stop(t + offset + 0.19);
      });
    };

    chirp();
    this.findTimer = window.setInterval(chirp, 900);
  }

  stopFindBeacon() {
    if (this.findTimer !== null) {
      window.clearInterval(this.findTimer);
      this.findTimer = null;
    }
    this.findNodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    });
    this.findNodes = [];
  }
}

export const sleepAudioEngine = new SleepAudioEngine();
