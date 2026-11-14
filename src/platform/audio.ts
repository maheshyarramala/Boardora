export type SoundCue =
  | 'ui-click'
  | 'wood-clack'
  | 'dice-roll'
  | 'capture'
  | 'victory'
  | 'defeat'
  | 'error';

export interface AudioConfiguration {
  soundEnabled: boolean;
  soundVolume: number;
  sfxVolume?: number;
  musicEnabled?: boolean;
  musicVolume?: number;
}

const PARLOR_CHORDS: readonly (readonly number[])[] = [
  [196.0, 246.94, 293.66], // G3 - B3 - D4
  [174.61, 220.0, 261.63], // F3 - A3 - C4
  [164.81, 196.0, 246.94], // E3 - G3 - B3
  [146.83, 196.0, 220.0], // D3 - G3 - A3
];

class TabletopAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private masterVolume = 0.75;
  private sfxVolume = 0.85;
  private musicEnabled = false;
  private musicVolume = 0.35;
  private musicTimerId: number | null = null;
  private chordIndex = 0;

  configure(
    enabledOrConfig: boolean | AudioConfiguration,
    volume?: number
  ) {
    if (typeof enabledOrConfig === 'boolean') {
      this.enabled = enabledOrConfig;
      this.masterVolume = Math.min(1, Math.max(0, volume ?? this.masterVolume));
    } else {
      this.enabled = enabledOrConfig.soundEnabled;
      this.masterVolume = Math.min(1, Math.max(0, enabledOrConfig.soundVolume));
      if (typeof enabledOrConfig.sfxVolume === 'number') {
        this.sfxVolume = Math.min(1, Math.max(0, enabledOrConfig.sfxVolume));
      }
      if (typeof enabledOrConfig.musicEnabled === 'boolean') {
        this.musicEnabled = enabledOrConfig.musicEnabled;
      }
      if (typeof enabledOrConfig.musicVolume === 'number') {
        this.musicVolume = Math.min(1, Math.max(0, enabledOrConfig.musicVolume));
      }
    }

    if (this.musicEnabled && this.masterVolume > 0.01 && this.musicVolume > 0.01) {
      this.startAmbientLoop();
    } else {
      this.stopAmbientLoop();
    }
  }

  private createOrResumeContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private ensureSfxContext(): AudioContext | null {
    const effective = this.masterVolume * this.sfxVolume;
    if (!this.enabled || effective <= 0.005) return null;
    return this.createOrResumeContext();
  }

  play(cue: SoundCue) {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainLevel = this.masterVolume * this.sfxVolume * 0.24;

    switch (cue) {
      case 'ui-click': {
        this.tone(ctx, 540, 380, now, 0.045, 'triangle', gainLevel * 0.6);
        break;
      }
      case 'wood-clack': {
        this.tone(ctx, 290, 140, now, 0.065, 'sine', gainLevel * 1.1);
        this.tone(ctx, 780, 420, now, 0.025, 'triangle', gainLevel * 0.4);
        break;
      }
      case 'dice-roll': {
        this.tone(ctx, 220, 180, now, 0.04, 'square', gainLevel * 0.35);
        this.tone(ctx, 310, 240, now + 0.055, 0.04, 'square', gainLevel * 0.3);
        this.tone(ctx, 260, 190, now + 0.11, 0.05, 'triangle', gainLevel * 0.45);
        break;
      }
      case 'capture': {
        this.tone(ctx, 440, 660, now, 0.09, 'triangle', gainLevel * 0.9);
        this.tone(ctx, 660, 880, now + 0.07, 0.12, 'sine', gainLevel * 0.7);
        break;
      }
      case 'victory': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          this.tone(
            ctx,
            freq,
            freq,
            now + idx * 0.09,
            0.24,
            'triangle',
            gainLevel * 0.85
          );
        });
        break;
      }
      case 'defeat': {
        const notes = [392.0, 349.23, 311.13, 261.63];
        notes.forEach((freq, idx) => {
          this.tone(
            ctx,
            freq,
            freq * 0.98,
            now + idx * 0.12,
            0.28,
            'sine',
            gainLevel * 0.7
          );
        });
        break;
      }
      case 'error': {
        this.tone(ctx, 200, 145, now, 0.11, 'sawtooth', gainLevel * 0.45);
        break;
      }
    }
  }

  private playAmbientChord() {
    if (!this.musicEnabled) return;
    const effective = this.masterVolume * this.musicVolume;
    if (effective <= 0.005) return;
    const ctx = this.createOrResumeContext();
    if (!ctx || ctx.state === 'suspended') return;

    const chord = PARLOR_CHORDS[this.chordIndex % PARLOR_CHORDS.length];
    this.chordIndex = (this.chordIndex + 1) % PARLOR_CHORDS.length;
    const now = ctx.currentTime;
    const padGain = effective * 0.045;

    chord.forEach((freq, idx) => {
      const start = now + idx * 0.18;
      this.padTone(ctx, freq, start, 2.8, padGain);
    });
  }

  private startAmbientLoop() {
    if (typeof window === 'undefined') return;
    if (this.musicTimerId !== null) return;
    this.playAmbientChord();
    this.musicTimerId = window.setInterval(() => {
      this.playAmbientChord();
    }, 3200);
  }

  stopAmbientLoop() {
    if (this.musicTimerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  private padTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(Math.max(0.0008, peakGain), startTime + 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private tone(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    peakGain: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, endFreq),
        startTime + duration
      );
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain), startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}

export const audioEngine = new TabletopAudioEngine();
