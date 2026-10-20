import { ctx as game } from './context';
import { prefs, saveSettings } from './settings';

// All sounds are synthesised, no audio files.
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private lastPlay = new Map<string, number>();
  volume = prefs.volume;

  constructor() {
    // M mutes everywhere (game and menus), except while typing text
    // M alone toggles mute; an M inside a typed word (secret codes like GNOMERAIN) does not:
    // a letter within 0.4 s before or after the M cancels it
    let lastLetter = -1e9;
    let pending: number | undefined;
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(t.type));
      if (e.repeat || typing || !e.code.startsWith('Key')) return;
      const now = performance.now();
      const recent = now - lastLetter < 400;
      lastLetter = now;
      if (pending !== undefined) {
        clearTimeout(pending);
        pending = undefined;
      }
      if (e.code !== 'KeyM' || recent) return;
      pending = window.setTimeout(() => {
        pending = undefined;
        this.setMuted(!prefs.muted);
        game.hud.toast(prefs.muted ? 'Sound off' : 'Sound on', 'info');
      }, 400);
    });
  }

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.applyGain();
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ambience();
  }

  setVolume(v: number): void {
    this.volume = prefs.volume = v;
    saveSettings();
    this.applyGain();
  }

  setMuted(m: boolean): void {
    prefs.muted = m;
    saveSettings();
    this.applyGain();
  }

  private applyGain(): void {
    if (this.ctx) this.master.gain.value = prefs.muted ? 0 : this.volume;
  }

  // Limits how often one sound can start, so 50 coins do not make 50 voices.
  private gate(name: string, minGap: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlay.get(name) ?? -1) < minGap) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  coin(pitch = 1): void {
    if (!this.gate('coin', 0.035)) return;
    this.tone('square', 1300 * pitch, 1300 * pitch, 0.06, 0.05);
    this.tone('square', 1750 * pitch, 1750 * pitch, 0.12, 0.05, 0.05);
  }

  slurp(): void {
    if (!this.gate('slurp', 0.05)) return;
    this.noise(0.35, 0.25, 1800, 120, 'lowpass');
    this.tone('sine', 300, 60, 0.3, 0.12);
  }

  boing(): void {
    if (!this.gate('boing', 0.06)) return;
    this.tone('sine', 180, 520, 0.25, 0.2);
  }

  kick(): void {
    if (!this.gate('kick', 0.05)) return;
    this.tone('sine', 160, 40, 0.15, 0.4);
    this.noise(0.08, 0.2, 3000, 300);
  }

  whoosh(): void {
    if (!this.gate('whoosh', 0.05)) return;
    this.noise(0.22, 0.12, 600, 3000, 'bandpass');
  }

  thud(): void {
    if (!this.gate('thud', 0.08)) return;
    this.tone('sine', 90, 50, 0.12, 0.15);
  }

  // A body hitting the ground: louder with strength (0..1), lower for heavier masses.
  impact(strength: number, mass = 1): void {
    if (!this.gate('impact', 0.06)) return;
    const s = Math.min(1, strength);
    const f = 110 / Math.sqrt(Math.max(0.3, mass));
    this.tone('sine', f, f * 0.45, 0.14 + s * 0.08, 0.1 + s * 0.2);
    this.noise(0.06 + s * 0.04, 0.06 + s * 0.12, 900, 150);
  }

  voice(kind: 'hey' | 'curse' | 'scream' | 'laugh', pitch = 1): void {
    if (!this.gate('voice', 0.25)) return;
    const p = pitch * (0.9 + Math.random() * 0.3);
    if (kind === 'hey') {
      this.tone('sawtooth', 500 * p, 800 * p, 0.12, 0.06);
      this.tone('sawtooth', 800 * p, 450 * p, 0.15, 0.06, 0.12);
    } else if (kind === 'curse') {
      for (let i = 0; i < 4; i++) this.tone('sawtooth', (420 + Math.random() * 300) * p, (300 + Math.random() * 300) * p, 0.07, 0.05, i * 0.07);
    } else if (kind === 'scream') {
      this.tone('sawtooth', 900 * p, 300 * p, 0.6, 0.06);
    } else {
      for (let i = 0; i < 5; i++) this.tone('square', 700 * p, 500 * p, 0.06, 0.04, i * 0.09);
    }
  }

  combo(n: number): void {
    const f = 400 * Math.pow(2, Math.min(n, 60) / 24);
    this.tone('triangle', f, f * 1.02, 0.12, 0.08);
  }

  tier(): void {
    [0, 4, 7, 12].forEach((s, i) => this.tone('square', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.15, 0.06, i * 0.07));
  }

  // Trick shot payoff: a rising major arpeggio ending on a held high note, more notes for bigger multipliers.
  fanfare(notes: number): void {
    const steps = [0, 4, 7, 12].slice(4 - notes);
    steps.forEach((s, i) => {
      const f = 523 * Math.pow(2, s / 12);
      const last = i === steps.length - 1;
      this.tone('square', f, f, last ? 0.45 : 0.12, 0.07, i * 0.09);
      this.tone('triangle', f * 2, f * 2, last ? 0.45 : 0.12, 0.04, i * 0.09);
    });
  }

  levelUp(): void {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('triangle', 262 * Math.pow(2, s / 12), 262 * Math.pow(2, s / 12), 0.35, 0.1, i * 0.09));
    this.noise(1.2, 0.15, 200, 60, 'lowpass', 0.1);
  }

  buy(): void {
    this.tone('square', 880, 880, 0.06, 0.06);
    this.tone('square', 1320, 1320, 0.1, 0.06, 0.06);
  }

  deny(): void {
    this.tone('square', 200, 150, 0.18, 0.08);
  }

  spit(): void {
    this.noise(0.25, 0.3, 4000, 500, 'bandpass');
  }

  magic(): void {
    if (!this.gate('magic', 0.2)) return;
    for (let i = 0; i < 6; i++) this.tone('sine', 1200 + i * 200, 1600 + i * 300, 0.2, 0.04, i * 0.04);
  }

  rumble(dur = 2): void {
    this.noise(dur, 0.35, 140, 40, 'lowpass');
  }

  ufo(): void {
    if (!this.gate('ufo', 0.9)) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const g = c.createGain();
    o.frequency.value = 600;
    lfo.frequency.value = 6;
    lg.gain.value = 200;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1);
    lfo.stop(t + 1);
  }

  whisper(): void {
    this.noise(2.5, 0.12, 2500, 900, 'bandpass');
    this.tone('sine', 55, 50, 2.5, 0.2);
  }

  toast(): void {
    this.tone('sine', 988, 988, 0.1, 0.07);
    this.tone('sine', 1319, 1319, 0.25, 0.07, 0.1);
  }

  step(): void {
    if (!this.gate('step', 0.28)) return;
    this.noise(0.05, 0.05, 900, 300);
  }

  private ambience(): void {
    const chirp = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'running') {
        const base = 2500 + Math.random() * 1500;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.tone('sine', base, base * 1.3, 0.07, 0.015, i * 0.11);
      }
      setTimeout(chirp, 2500 + Math.random() * 6000);
    };
    setTimeout(chirp, 2000);
  }
}
