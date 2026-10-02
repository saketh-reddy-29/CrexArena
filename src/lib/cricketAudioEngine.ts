/**
 * High-Quality Real-Time Web Audio Synthesizer for 3D Cricket Action Visualizer
 * Fully self-contained — generates realistic cricket acoustic signatures without external sound files.
 */

export type CricketAudioEvent =
  | 'BAT_HIT'
  | 'BAT_SIX'
  | 'BALL_BOUNCE'
  | 'STUMPS_SHATTER'
  | 'APPEAL'
  | 'CROWD_CHEER_FOUR'
  | 'CROWD_CHEER_SIX'
  | 'CROWD_WICKET'
  | 'MILESTONE_APPLAUSE'
  | 'DROPPED_CATCH_GASP'
  | 'VICTORY_ROAR';

let audioCtx: AudioContext | null = null;
let isAudioMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setMuted(muted: boolean) {
  isAudioMuted = muted;
}

export function isMuted(): boolean {
  return isAudioMuted;
}

/**
 * Play a synthesized realistic cricket event sound effect
 */
export function playEventSound(event: CricketAudioEvent, volume: number = 0.5) {
  if (isAudioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.4, now);
    masterGain.connect(ctx.destination);

    switch (event) {
      case 'BAT_HIT':
      case 'BAT_SIX': {
        // High frequency crisp willow wood crack + mid resonance
        const isSix = event === 'BAT_SIX';
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isSix ? 850 : 680, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + (isSix ? 0.09 : 0.06));

        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + (isSix ? 0.12 : 0.08));

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.15);

        // Add crisp snap transient noise
        const bufferSize = ctx.sampleRate * (isSix ? 0.08 : 0.04);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        whiteNoise.connect(noiseGain);
        noiseGain.connect(masterGain);
        whiteNoise.start(now);
        break;
      }

      case 'BALL_BOUNCE': {
        // Subtle turf thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
      }

      case 'STUMPS_SHATTER': {
        // High pitched resonant timber wood clash
        [520, 780, 1140, 1420].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.015);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.18);

          gain.gain.setValueAtTime(0.6 / (idx + 1), now + idx * 0.015);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.015);
          osc.stop(now + 0.25);
        });
        break;
      }

      case 'CROWD_CHEER_FOUR':
      case 'CROWD_CHEER_SIX':
      case 'CROWD_WICKET':
      case 'MILESTONE_APPLAUSE':
      case 'VICTORY_ROAR': {
        // Ambient stadium crowd swell
        const dur = event === 'VICTORY_ROAR' ? 2.5 : event === 'MILESTONE_APPLAUSE' ? 1.8 : event === 'CROWD_CHEER_SIX' ? 1.5 : 1.0;
        const bufferSize = ctx.sampleRate * dur;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }

        const crowdNoise = ctx.createBufferSource();
        crowdNoise.buffer = buffer;

        // Bandpass filter for human cheering spectrum
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(event === 'CROWD_WICKET' ? 580 : 880, now);
        filter.Q.setValueAtTime(1.2, now);

        const crowdGain = ctx.createGain();
        crowdGain.gain.setValueAtTime(0.01, now);
        crowdGain.gain.linearRampToValueAtTime(0.5, now + 0.15);
        crowdGain.gain.exponentialRampToValueAtTime(0.01, now + dur);

        crowdNoise.connect(filter);
        filter.connect(crowdGain);
        crowdGain.connect(masterGain);

        crowdNoise.start(now);
        crowdNoise.stop(now + dur);
        break;
      }

      case 'APPEAL': {
        // Sharp "HOWZAT" vocal pitch sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(620, now + 0.18);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.45);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.48);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }

      case 'DROPPED_CATCH_GASP': {
        // Collective stadium gasp & disappointment sigh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.6);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
    }
  } catch (err) {
    // Non-blocking audio fallback
  }
}
