// Web Audio API Synthesizer for AAA Cricket Sound Effects (Zero External Asset Dependencies)
class CricketSoundFX {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Sharp English Willow bat contact sound ("CRACK!")
  public playBatCrack(power = 1.0) {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // Noise impact burst
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.015));
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.setValueAtTime(2.5, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7 * Math.min(1.5, power), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      // Resonant wood tone
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + 0.07);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.4 * power, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      whiteNoise.start(t);
      osc.start(t);
      osc.stop(t + 0.08);
    } catch {
      // Audio auto-play or context muted safe fallback
    }
  }

  // Turf pitch bounce thud
  public playPitchBounce() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.09);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.1);
    } catch {
      // Fallback
    }
  }

  // Wooden Stumps clatter & bails flying
  public playStumpsClatter() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      [280, 420, 680, 850].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'triangle';
        const startT = t + idx * 0.03;
        osc.frequency.setValueAtTime(freq, startT);
        osc.frequency.exponentialRampToValueAtTime(110, startT + 0.15);

        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0.35, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startT);
        osc.stop(startT + 0.16);
      });
    } catch {
      // Fallback
    }
  }

  // Stadium Crowd roar on boundary / six / wicket
  public playCrowdCheer(isHuge = false) {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const dur = isHuge ? 2.5 : 1.6;

      const bufferSize = this.ctx.sampleRate * dur;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.linearRampToValueAtTime(1200, t + 0.6);
      filter.frequency.exponentialRampToValueAtTime(400, t + dur);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.linearRampToValueAtTime(isHuge ? 0.35 : 0.22, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(t);
    } catch {
      // Fallback
    }
  }
}

export const soundFX = new CricketSoundFX();
export default soundFX;
