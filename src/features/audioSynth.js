/**
 * Zero-dependency Web Audio API procedural focus soundscape synthesizer.
 * Presets: 'off' | 'drone' | 'rain' | 'theta'
 */

let audioCtx = null;
let masterGain = null;
let activeNodes = [];
let currentPreset = 'off';
let currentVolume = 0.22;
const listeners = new Set();

function emit() {
  const snapshot = getAudioState();
  listeners.forEach((fn) => fn(snapshot));
}

export function getAudioState() {
  return {
    preset: currentPreset,
    volume: currentVolume,
    active: currentPreset !== 'off'
  };
}

export function subscribeAudio(fn) {
  listeners.add(fn);
  fn(getAudioState());
  return () => listeners.delete(fn);
}

function stopActiveNodes() {
  activeNodes.forEach((node) => {
    try {
      if (typeof node.stop === 'function') node.stop();
    } catch {
      // ignore already stopped
    }
    try {
      node.disconnect();
    } catch {
      // ignore
    }
  });
  activeNodes = [];
}

function ensureAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = currentVolume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function startSpaceDrone(ctx) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 240;
  filter.Q.value = 1.4;
  filter.connect(masterGain);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 110;

  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 110.6;

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 55;

  const g1 = ctx.createGain();
  g1.gain.value = 0.22;
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  const gSub = ctx.createGain();
  gSub.gain.value = 0.45;

  osc1.connect(g1).connect(filter);
  osc2.connect(g2).connect(filter);
  sub.connect(gSub).connect(filter);

  osc1.start();
  osc2.start();
  sub.start();

  activeNodes.push(osc1, osc2, sub, g1, g2, gSub, filter);
}

function startCrispRain(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1100;
  bandpass.Q.value = 0.7;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.14;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 240;
  lfo.connect(lfoGain).connect(bandpass.frequency);

  const rainGain = ctx.createGain();
  rainGain.gain.value = 0.42;

  noise.connect(bandpass).connect(rainGain).connect(masterGain);
  noise.start();
  lfo.start();

  activeNodes.push(noise, bandpass, lfo, lfoGain, rainGain);
}

function startBinauralTheta(ctx) {
  const leftOsc = ctx.createOscillator();
  leftOsc.type = 'sine';
  leftOsc.frequency.value = 200;

  const rightOsc = ctx.createOscillator();
  rightOsc.type = 'sine';
  rightOsc.frequency.value = 206;

  const oscGain = ctx.createGain();
  oscGain.gain.value = 0.32;

  if (typeof ctx.createStereoPanner === 'function') {
    const panLeft = ctx.createStereoPanner();
    panLeft.pan.value = -1;
    const panRight = ctx.createStereoPanner();
    panRight.pan.value = 1;

    leftOsc.connect(panLeft).connect(oscGain);
    rightOsc.connect(panRight).connect(oscGain);
    activeNodes.push(panLeft, panRight);
  } else {
    leftOsc.connect(oscGain);
    rightOsc.connect(oscGain);
  }

  oscGain.connect(masterGain);
  leftOsc.start();
  rightOsc.start();
  activeNodes.push(leftOsc, rightOsc, oscGain);
}

export function setAudioPreset(preset) {
  const next = ['off', 'drone', 'rain', 'theta'].includes(preset) ? preset : 'off';
  stopActiveNodes();
  currentPreset = next;

  if (next !== 'off') {
    const ctx = ensureAudioContext();
    if (ctx) {
      if (next === 'drone') startSpaceDrone(ctx);
      else if (next === 'rain') startCrispRain(ctx);
      else if (next === 'theta') startBinauralTheta(ctx);
    }
  }
  emit();
}

export function setAudioVolume(vol) {
  currentVolume = Math.max(0, Math.min(1, Number(vol) || 0.22));
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.05);
  }
  emit();
}

/**
 * Play a crisp 16ms procedural mechanical watch-bezel click when scrubbing notches.
 * @param {number} [minutes=25]
 */
export function playDialTickSound(minutes = 25) {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 + (Number(minutes) || 25) * 3.5, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.016);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  } catch {
    // ignore if browser blocks autoplay before user gesture
  }
}
