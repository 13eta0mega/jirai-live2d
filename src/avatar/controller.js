import { EXPRESSION_PARAMS, FALLBACK_PRESETS, PART_FILES, SOURCE_FILES, VISEMES } from "./data.js";
import { analyseSpectrum, clamp01, createLipSyncState, smoothLipSync } from "./lipsync.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;
const radians = (degrees) => (degrees * Math.PI) / 180;
const now = () => performance.now();

const SOURCE_DIMENSIONS = {
  stand: [259, 270], jump: [300, 273], peace: [259, 270],
  uruuru: [270, 246], gorogoro: [270, 246], haku: [250, 246],
};

const FACE_LAYOUTS = {
  stand: { leftEye: [-40, -32, 28, 21], rightEye: [15, -32, 28, 21], mouth: [-18, -19, 34, 27] },
  peace: { leftEye: [-40, -32, 28, 21], rightEye: [18, -32, 28, 21], mouth: [-20, -20, 33, 31] },
  jump: { leftEye: [-43, -29, 31, 25], rightEye: [14, -29, 31, 25], mouth: [-24, 4, 45, 40] },
  uruuru: { leftEye: [-57, -31, 42, 46], rightEye: [16, -31, 42, 46], mouth: [-18, -4, 33, 24] },
  haku: { leftEye: [-55, -27, 35, 36], rightEye: [-3, -27, 33, 36], mouth: [-18, -2, 35, 29] },
};

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${path}`));
    image.src = path;
  });
}

function mixObject(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) out[key] = lerp(Number(a?.[key]) || 0, Number(b?.[key]) || 0, t);
  return out;
}

function expressionAt(name, intensity = 1) {
  const neutral = EXPRESSION_PARAMS.neutral;
  const target = EXPRESSION_PARAMS[name] || neutral;
  return mixObject(neutral, target, Math.min(1, clamp(intensity, 0, 1.5)));
}

function motionFor(name, seconds, age, intensity = 1) {
  const i = clamp(intensity, 0, 1.5);
  const motion = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0 };
  switch (name) {
    case "happy_bob": motion.y = Math.sin(seconds * 4.2) * 2.4 * i; motion.rotation = Math.sin(seconds * 2.1) * 0.7 * i; break;
    case "jump_once": { const p = Math.min(1, age / 0.9); const jump = Math.sin(p * Math.PI) * (1 - p * 0.15); motion.y = -24 * jump * i; motion.scaleY = 1 + 0.045 * jump * i; motion.scaleX = 1 - 0.025 * jump * i; break; }
    case "pose_forward_hands": motion.y = Math.sin(seconds * 1.8) * 1.3 * i; motion.rotation = Math.sin(seconds * 1.25) * 0.45 * i; break;
    case "pleading_idle": motion.y = Math.sin(seconds * 2) * 1.2 * i; motion.scaleY = 1 + Math.sin(seconds * 2) * 0.008 * i; break;
    case "lay_idle": motion.x = Math.sin(seconds * 0.65) * 1.6 * i; motion.y = Math.sin(seconds * 1.25) * 0.8 * i; break;
    case "sick_recoil": { const recoil = Math.exp(-Math.min(age, 2) * 2.8) * Math.sin(age * 17); motion.x = recoil * 7 * i; motion.rotation = recoil * 2.2 * i; break; }
    case "angry_tense": motion.x = Math.sin(seconds * 20) * 0.9 * i; motion.rotation = Math.sin(seconds * 16) * 0.35 * i; motion.scaleX = 1 + 0.012 * i; break;
    case "annoyed_shift": motion.x = Math.sin(seconds * 0.95) * 2.3 * i; motion.rotation = Math.sin(seconds * 0.8) * 0.7 * i; break;
    case "sad_sink": motion.y = (2.4 + Math.sin(seconds * 1.15) * 0.8) * i; motion.rotation = Math.sin(seconds * 0.7) * 0.35 * i; break;
    case "startle": { const impulse = Math.exp(-Math.min(age, 1.5) * 5); motion.y = -11 * impulse * i; motion.scaleX = 1 + 0.045 * impulse * i; motion.scaleY = 1 + 0.07 * impulse * i; break; }
    case "shy_shift": motion.x = Math.sin(seconds * 1.2) * 1.8 * i; motion.rotation = Math.sin(seconds * 1.05) * 0.75 * i; break;
    case "scared_shiver": motion.x = Math.sin(seconds * 25) * 1.8 * i; motion.y = Math.cos(seconds * 22) * 0.8 * i; motion.rotation = Math.sin(seconds * 19) * 0.65 * i; break;
    case "smug_hold": motion.y = Math.sin(seconds * 1.35) * 1.1 * i; motion.rotation = 0.35 * i + Math.sin(seconds * 0.8) * 0.25; break;
    case "confused_tilt": motion.rotation = Math.sin(seconds * 1.3) * 1.35 * i; motion.x = Math.sin(seconds * 0.65) * 1.4 * i; break;
    case "love_bob": motion.y = Math.sin(seconds * 3.2) * 2.7 * i; motion.scaleX = 1 + (0.012 + 0.008 * Math.sin(seconds * 3.2)) * i; motion.scaleY = motion.scaleX; break;
    case "idle_breath": default: motion.y = Math.sin(seconds * 1.3) * 0.7 * i; motion.rotation = Math.sin(seconds * 0.58) * 0.22 * i; break;
  }
  return motion;
}

export class AvatarController {
  constructor(canvas, presets = FALLBACK_PRESETS) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.presets = presets; this.images = {}; this.parts = {};
    this.currentEmotion = "neutral"; this.currentIntensity = 1; this.emotionStartedAt = now(); this.transition = null;
    this.manualMouth = 0; this.mouthTarget = 0; this.mouthOpen = 0; this.mouthForm = 0; this.mouthFormTarget = 0;
    this.viseme = "CLOSED"; this.previousViseme = "CLOSED"; this.visemeChangedAt = now();
    this.blinkEnabled = true; this.breathEnabled = true; this.lipSyncTest = false; this.lipSyncMode = "manual"; this.audioFeatures = null;
    this.audioResult = { rms: 0, low: 0, mid: 0, high: 0, noiseFloor: 0.018, open: 0, weight: 0, viseme: "CLOSED" }; this.lipSyncState = createLipSyncState();
    this.audioContext = null; this.microphoneStream = null; this.microphoneSource = null; this.analyser = null; this.timeData = null; this.frequencyData = null;
    this.showParameters = false; this.showBounds = false; this.started = false; this.lastTime = 0; this.breathValue = 0; this.blinkLevel = 1; this.nextBlinkAt = 0; this.blinkStart = -1; this.blinkDuration = 520;
    this.frameTimes = []; this.fps = 0; this.parameters = {}; this.pointerTarget = { x: 0, y: 0 }; this.pointer = { x: 0, y: 0 }; this.effectSeed = Math.random() * 1000;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement || canvas);
    this.onPointerMove = (event) => this.updatePointer(event); this.onPointerLeave = () => { this.pointerTarget.x = 0; this.pointerTarget.y = 0; };
    canvas.addEventListener("pointermove", this.onPointerMove); canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  async load() {
    const sources = await Promise.all(Object.entries(SOURCE_FILES).map(async ([key, path]) => [key, await loadImage(path)]));
    const parts = await Promise.all(Object.entries(PART_FILES).map(async ([key, path]) => [key, await loadImage(path)]));
    this.images = Object.fromEntries(sources); this.parts = Object.fromEntries(parts); this.resize(); this.scheduleNextBlink(now()); return this;
  }

  resize() {
    const box = this.canvas.parentElement?.getBoundingClientRect(); const cssWidth = Math.max(320, Math.round(box?.width || 420)); const cssHeight = Math.max(360, Math.round(Math.min(cssWidth * 1.12, 560))); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${cssWidth}px`; this.canvas.style.height = `${cssHeight}px`; this.canvas.width = Math.round(cssWidth * dpr); this.canvas.height = Math.round(cssHeight * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.width = cssWidth; this.height = cssHeight;
  }

  updatePointer(event) { const rect = this.canvas.getBoundingClientRect(); this.pointerTarget.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1); this.pointerTarget.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1); }
  start() { if (this.started) return; this.started = true; const frame = (time) => { if (!this.started) return; this.update(time); this.render(time); requestAnimationFrame(frame); }; requestAnimationFrame(frame); }
  stop() { this.started = false; }

  settleTransition(time = now()) {
    if (!this.transition) return; const progress = clamp((time - this.transition.start) / this.transition.duration);
    if (progress >= 0.5) { this.currentEmotion = this.transition.to; this.currentIntensity = this.transition.toIntensity; } else { this.currentEmotion = this.transition.from; this.currentIntensity = this.transition.fromIntensity; }
    this.transition.resolve?.(); this.transition = null; this.emotionStartedAt = time;
  }

  setEmotion(id, options = {}) {
    if (!this.presets[id]) return Promise.reject(new Error(`알 수 없는 emotion: ${id}`));
    const immediate = Boolean(options.immediate); const intensity = clamp(options.intensity ?? 1, 0, 1.5); const duration = Math.max(80, Number(options.duration) || (this.presets[id].transitionMotion === "lay_transition" ? 820 : 520));
    if (this.transition) this.settleTransition(now());
    if (immediate || id === this.currentEmotion) { this.currentEmotion = id; this.currentIntensity = intensity; this.emotionStartedAt = now(); return Promise.resolve(); }
    this.transition = { from: this.currentEmotion, to: id, fromIntensity: this.currentIntensity, toIntensity: intensity, start: now(), duration, resolve: null };
    return new Promise((resolve) => { this.transition.resolve = resolve; });
  }

  async reset() { this.settleTransition(now()); this.currentEmotion = "neutral"; this.currentIntensity = 1; this.emotionStartedAt = now(); this.setMouthOpen(0); this.breathEnabled = true; this.blinkEnabled = true; this.pointerTarget = { x: 0, y: 0 }; }
  setVisemeName(viseme) { const key = VISEMES[viseme] ? viseme : "CLOSED"; if (key !== this.viseme) { this.previousViseme = this.viseme; this.viseme = key; this.visemeChangedAt = now(); } }
  setMouthOpen(value) { const open = clamp01(value); this.manualMouth = open; this.mouthTarget = open; const key = open > 0.62 ? "A" : open > 0.22 ? "I" : "CLOSED"; this.setVisemeName(key); this.mouthFormTarget = VISEMES[key]?.mouthForm || 0; if (!this.lipSyncTest && this.lipSyncMode !== "microphone" && this.lipSyncMode !== "external") this.lipSyncMode = "manual"; }
  setViseme(viseme, weight = 1) { const key = String(viseme || "CLOSED").toUpperCase(); const selected = VISEMES[key] || VISEMES.CLOSED; const w = clamp01(weight); this.setVisemeName(key); this.mouthTarget = clamp01(selected.mouthOpen * w); this.manualMouth = this.mouthTarget; this.mouthFormTarget = (selected.mouthForm || 0) * w; }
  setLipSyncTest(enabled) { this.lipSyncTest = Boolean(enabled); if (this.lipSyncTest) this.lipSyncMode = "test"; else if (this.lipSyncMode === "test") { this.lipSyncMode = "manual"; this.mouthTarget = this.manualMouth; } }

  async startMicrophoneLipSync() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("이 브라우저는 마이크 입력을 지원하지 않습니다.");
    await this.stopMicrophoneLipSync();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) { stream.getTracks().forEach((track) => track.stop()); throw new Error("Web Audio API를 사용할 수 없습니다."); }
    const context = new AudioContextClass(); if (context.state === "suspended") await context.resume(); const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.36; source.connect(analyser);
    this.audioContext = context; this.microphoneStream = stream; this.microphoneSource = source; this.analyser = analyser; this.timeData = new Uint8Array(analyser.fftSize); this.frequencyData = new Uint8Array(analyser.frequencyBinCount); this.lipSyncState = createLipSyncState(); this.lipSyncTest = false; this.lipSyncMode = "microphone"; return true;
  }

  async stopMicrophoneLipSync({ preserveMode = false } = {}) {
    try { this.microphoneSource?.disconnect(); } catch {} this.microphoneStream?.getTracks().forEach((track) => track.stop()); if (this.audioContext && this.audioContext.state !== "closed") { try { await this.audioContext.close(); } catch {} }
    this.audioContext = null; this.microphoneStream = null; this.microphoneSource = null; this.analyser = null; this.timeData = null; this.frequencyData = null; if (!preserveMode && this.lipSyncMode === "microphone") this.lipSyncMode = this.lipSyncTest ? "test" : "manual";
  }

  setAudioFeatures(features) { this.audioFeatures = { rms: Math.max(0, Number(features?.rms) || 0), low: Math.max(0, Number(features?.low) || 0), mid: Math.max(0, Number(features?.mid) || 0), high: Math.max(0, Number(features?.high) || 0) }; this.lipSyncMode = "external"; }
  clearAudioFeatures() { this.audioFeatures = null; if (this.lipSyncMode === "external") this.lipSyncMode = this.lipSyncTest ? "test" : "manual"; }
  setBlinkEnabled(enabled) { this.blinkEnabled = Boolean(enabled); if (!this.blinkEnabled) this.blinkLevel = 1; }
  setBreathEnabled(enabled) { this.breathEnabled = Boolean(enabled); }
  setDebug({ showParameters, showBounds } = {}) { if (showParameters !== undefined) this.showParameters = Boolean(showParameters); if (showBounds !== undefined) this.showBounds = Boolean(showBounds); }
  scheduleNextBlink(time) { this.nextBlinkAt = time + 2600 + Math.random() * 4200; }
  activePresetForBlink(time) { if (!this.transition) return this.presets[this.currentEmotion] || FALLBACK_PRESETS.neutral; const p = clamp((time - this.transition.start) / this.transition.duration); return this.presets[p > 0.45 ? this.transition.to : this.transition.from] || FALLBACK_PRESETS.neutral; }

  updateBlink(time) {
    const preset = this.activePresetForBlink(time); if (!this.blinkEnabled || preset.blinkMode === "disabled") { this.blinkLevel = 1; return; }
    if (this.blinkStart < 0 && time >= this.nextBlinkAt) { this.blinkStart = time; this.blinkDuration = preset.blinkMode === "special" ? 430 : 330; }
    if (this.blinkStart >= 0) { const progress = clamp((time - this.blinkStart) / this.blinkDuration); if (progress < 0.34) this.blinkLevel = 1 - easeInOut(progress / 0.34); else if (progress < 0.49) this.blinkLevel = 0; else this.blinkLevel = easeOut((progress - 0.49) / 0.51); if (progress >= 1) { this.blinkStart = -1; this.blinkLevel = 1; this.scheduleNextBlink(time); } }
  }

  sampleLipSync(dt, seconds, preset) {
    if (preset?.lipSyncEnabled === false) { this.mouthTarget = 0; this.mouthFormTarget = 0; this.setVisemeName("CLOSED"); return; }
    let features = null;
    if (this.lipSyncMode === "microphone" && this.analyser && this.timeData && this.frequencyData) { this.analyser.getByteTimeDomainData(this.timeData); this.analyser.getByteFrequencyData(this.frequencyData); features = analyseSpectrum(this.timeData, this.frequencyData, this.audioContext?.sampleRate || 48000, this.analyser.fftSize); }
    else if (this.lipSyncMode === "external" && this.audioFeatures) features = this.audioFeatures;
    if (features) { this.audioResult = smoothLipSync(this.lipSyncState, features, dt); const selected = VISEMES[this.audioResult.viseme] || VISEMES.CLOSED; this.setVisemeName(this.audioResult.viseme); this.mouthTarget = clamp01(Math.max(this.audioResult.open * 0.96, selected.mouthOpen * this.audioResult.weight * 0.72)); this.mouthFormTarget = (selected.mouthForm || 0) * this.audioResult.weight; return; }
    if (this.lipSyncTest) { const carrier = 0.5 + 0.5 * Math.sin(seconds * 9.4); const phrase = 0.5 + 0.5 * Math.sin(seconds * 1.7 + 0.3); const open = clamp01(0.04 + carrier * phrase * 0.9); const sequence = ["A", "I", "U", "E", "O"]; const key = sequence[Math.floor(seconds * 4) % sequence.length]; const selected = VISEMES[key]; this.setVisemeName(open < 0.08 ? "CLOSED" : key); this.mouthTarget = open; this.mouthFormTarget = (selected.mouthForm || 0) * open; this.audioResult = { ...this.audioResult, rms: open * 0.2, open, weight: open, viseme: this.viseme }; return; }
    this.mouthTarget = this.manualMouth;
  }

  update(time) {
    if (!this.lastTime) this.lastTime = time; const dt = Math.min(64, Math.max(1, time - this.lastTime)); this.lastTime = time; const seconds = time / 1000; const activeId = this.transition ? this.transition.to : this.currentEmotion; const preset = this.presets[activeId] || FALLBACK_PRESETS.neutral;
    const period = 3.2 + (Math.sin(seconds * 0.17) + 1) * 0.65; this.breathValue = this.breathEnabled ? (Math.sin((seconds / period) * Math.PI * 2) + 1) / 2 : 0; this.updateBlink(time); this.sampleLipSync(dt, seconds, preset);
    this.mouthOpen += (this.mouthTarget - this.mouthOpen) * (1 - Math.exp(-dt * 0.028)); this.mouthForm += (this.mouthFormTarget - this.mouthForm) * (1 - Math.exp(-dt * 0.022)); this.pointer.x += (this.pointerTarget.x - this.pointer.x) * (1 - Math.exp(-dt * 0.008)); this.pointer.y += (this.pointerTarget.y - this.pointer.y) * (1 - Math.exp(-dt * 0.008)); this.parameters = this.getParameterSnapshot(time);
    this.frameTimes.push(time); while (this.frameTimes.length && this.frameTimes[0] < time - 1000) this.frameTimes.shift(); this.fps = this.frameTimes.length;
    if (this.transition && clamp((time - this.transition.start) / this.transition.duration) >= 1) { const resolver = this.transition.resolve; this.currentEmotion = this.transition.to; this.currentIntensity = this.transition.toIntensity; this.emotionStartedAt = time; this.transition = null; resolver?.(); }
  }

  buildParameters(emotionId, intensity, time) {
    const seconds = time / 1000; const preset = this.presets[emotionId] || FALLBACK_PRESETS.neutral; const expression = expressionAt(preset.expression, intensity); const breathe = this.breathValue * (preset.breathScale ?? 1); const gazeX = this.pointer.x; const gazeY = this.pointer.y; const spokenMouthForm = lerp(expression.mouthForm || 0, this.mouthForm, clamp01(this.mouthOpen * 1.25));
    return { ParamAngleX: gazeX * 5.5 * intensity, ParamAngleY: -gazeY * 3.8 * intensity, ParamAngleZ: (preset.pose?.rotation || 0) + gazeX * 1.2, ParamBodyAngleX: Math.sin(seconds * 0.7) * 0.45 * intensity, ParamBodyAngleY: breathe * 0.7 - 0.35, ParamBodyAngleZ: Math.sin(seconds * 0.53) * 0.32 * intensity, ParamEyeLOpen: clamp01((expression.eyeOpen ?? 1) * this.blinkLevel), ParamEyeROpen: clamp01((expression.eyeOpen ?? 1) * this.blinkLevel), ParamEyeLSmile: expression.eyeSmile || 0, ParamEyeRSmile: expression.eyeSmile || 0, ParamEyeBallX: clamp((expression.eyeBallX || 0) + gazeX * 0.48, -1, 1), ParamEyeBallY: clamp((expression.eyeBallY || 0) - gazeY * 0.35, -1, 1), ParamBrowLY: expression.browL || 0, ParamBrowRY: expression.browR || 0, ParamBrowLAngle: expression.browL || 0, ParamBrowRAngle: expression.browR || 0, ParamBrowLForm: expression.browL || 0, ParamBrowRForm: expression.browR || 0, ParamMouthOpenY: this.mouthOpen, ParamMouthForm: spokenMouthForm, ParamCheek: expression.cheek || 0, ParamBreath: breathe, ParamTwinTailL: Math.sin(seconds * 1.3) * breathe, ParamTwinTailR: Math.sin(seconds * 1.3 + 0.42) * breathe };
  }

  getParameterSnapshot(time) { if (!this.transition) return this.buildParameters(this.currentEmotion, this.currentIntensity, time); const p = easeInOut(clamp((time - this.transition.start) / this.transition.duration)); return mixObject(this.buildParameters(this.transition.from, this.transition.fromIntensity, time), this.buildParameters(this.transition.to, this.transition.toIntensity, time), p); }

  render(time) {
    const ctx = this.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); const dpr = this.canvas.width / this.width; ctx.scale(dpr, dpr); ctx.fillStyle = "#16121c"; ctx.fillRect(0, 0, this.width, this.height); ctx.fillStyle = "rgba(255, 123, 183, .06)"; ctx.fillRect(18, 18, this.width - 36, this.height - 36);
    if (!Object.keys(this.images).length) { ctx.fillStyle = "#ffd8ea"; ctx.font = "16px sans-serif"; ctx.fillText("원본 PNG를 불러오는 중…", 28, 48); ctx.restore(); return; }
    if (this.transition) { const progress = easeInOut(clamp((time - this.transition.start) / this.transition.duration)); this.renderEntity(this.transition.from, this.transition.fromIntensity, 1 - progress, time); this.renderEntity(this.transition.to, this.transition.toIntensity, progress, time); } else this.renderEntity(this.currentEmotion, this.currentIntensity, 1, time); ctx.restore();
  }

  renderEntity(emotionId, intensity, alpha, time) {
    const preset = this.presets[emotionId] || FALLBACK_PRESETS.neutral; const image = this.images[preset.source]; if (!image || alpha <= 0.002) return; const ctx = this.ctx; const sourceW = image.naturalWidth || SOURCE_DIMENSIONS[preset.source]?.[0] || 259; const sourceH = image.naturalHeight || SOURCE_DIMENSIONS[preset.source]?.[1] || 270; const fit = Math.min((this.width * 0.78) / sourceW, (this.height * 0.82) / sourceH); const pose = preset.pose || { x: 0, y: 0, rotation: 0, scale: 1 }; const age = Math.max(0, (time - (this.transition?.to === emotionId ? this.transition.start : this.emotionStartedAt)) / 1000); const motion = motionFor(preset.bodyMotion, time / 1000, age, intensity); const breathe = this.breathEnabled ? Math.sin(time / 1000 * 1.35) * (preset.breathScale || 1) * 1.45 : 0; const x = this.width / 2 + (pose.x || 0) + motion.x + this.pointer.x * 1.6; const y = this.height * 0.49 + (pose.y || 0) + motion.y + breathe - this.pointer.y * 0.8; const rotation = radians((pose.rotation || 0) + motion.rotation + this.pointer.x * 0.8); const baseScale = fit * (pose.scale || 1); const breathStretch = this.breathEnabled ? 1 + (this.breathValue - 0.5) * 0.012 * (preset.breathScale || 1) : 1;
    ctx.save(); ctx.globalAlpha = clamp01(alpha); ctx.translate(x, y); ctx.rotate(rotation); ctx.transform(1, 0, motion.shearX, 1, 0, 0); ctx.scale(baseScale * motion.scaleX, baseScale * motion.scaleY * breathStretch); ctx.drawImage(image, -sourceW / 2, -sourceH / 2); const params = this.buildParameters(emotionId, intensity, time); this.drawEyeSystem(emotionId, preset.source, params, 1); this.drawMouthSystem(emotionId, preset.source, params, 1, time); this.drawEffects(preset, sourceW, sourceH, 1, time); if (this.showBounds) { ctx.strokeStyle = "rgba(255, 195, 225, .55)"; ctx.lineWidth = 1 / Math.max(baseScale, 0.001); ctx.strokeRect(-sourceW / 2, -sourceH / 2, sourceW, sourceH); } ctx.restore();
  }

  drawPart(partName, x, y, width, height, alpha = 1) { const part = this.parts[partName]; if (!part || alpha <= 0.001) return; this.ctx.save(); this.ctx.globalAlpha *= clamp01(alpha); this.ctx.drawImage(part, x, y, width, height); this.ctx.restore(); }

  drawEyeSystem(emotionId, source, params, alpha) {
    const layout = FACE_LAYOUTS[source]; if (!layout) return; const open = clamp01((params.ParamEyeLOpen + params.ParamEyeROpen) * 0.5); const closedAlpha = clamp01((1 - open) * 1.35) * alpha; const specialOpen = clamp01(open) * alpha;
    if (source === "uruuru") { this.drawPart("eyeUruuruL", ...layout.leftEye, specialOpen); this.drawPart("eyeUruuruR", ...layout.rightEye, specialOpen); } else if (source === "haku") { this.drawPart("eyeOpenL", ...layout.leftEye, specialOpen); this.drawPart("eyeOpenR", ...layout.rightEye, specialOpen); } else if (source === "peace" && ["teasing", "smug"].includes(emotionId)) this.drawPart("eyeWinkR", ...layout.rightEye, 0.88 * alpha);
    if (closedAlpha > 0.01 && source !== "gorogoro") { this.drawPart("eyeClosedL", ...layout.leftEye, closedAlpha); this.drawPart("eyeClosedR", ...layout.rightEye, closedAlpha); }
  }

  mouthPartFor(viseme, emotionId, source, open) { if (viseme === "CLOSED" || open < 0.05) { if (source === "uruuru" || ["pleading", "sad"].includes(emotionId)) return "mouthUruuru"; if (source === "peace") return "mouthSmall"; return "mouthClosed"; } return VISEMES[viseme]?.mouthPart || (open > 0.65 ? "mouthWide" : open > 0.28 ? "mouthA" : "mouthSmall"); }
  drawMouthSystem(emotionId, source, params, alpha, time) { const layout = FACE_LAYOUTS[source]; if (!layout) return; const open = clamp01(params.ParamMouthOpenY); const blend = easeOut(clamp01((time - this.visemeChangedAt) / 78)); const previousPart = this.mouthPartFor(this.previousViseme, emotionId, source, open); const currentPart = this.mouthPartFor(this.viseme, emotionId, source, open); const [x, y, width, height] = layout.mouth; const yScale = 0.9 + open * 0.24; const drawY = y - (height * (yScale - 1)) * 0.35; const drawH = height * yScale; const replacementAlpha = source === "jump" || source === "haku" ? 0.96 : clamp(0.55 + open * 0.5, 0, 1); if (previousPart !== currentPart && blend < 0.999) this.drawPart(previousPart, x, drawY, width, drawH, (1 - blend) * replacementAlpha * alpha); this.drawPart(currentPart, x, drawY, width, drawH, (previousPart === currentPart ? 1 : blend) * replacementAlpha * alpha); }

  drawEffects(preset, sourceW, sourceH, alpha, time) {
    if (!preset.effects?.length) return; const ctx = this.ctx; const seconds = time / 1000;
    if (preset.effects.includes("rainbow") && this.parts.rainbow) this.drawPart("rainbow", -sourceW * 0.22, -sourceH * 0.08, sourceW * 0.44, sourceH * 0.43, (0.55 + 0.25 * Math.sin(seconds * 3.1)) * alpha);
    if (preset.effects.includes("sparkle")) { ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = "rgba(255, 224, 244, .9)"; for (let i = 0; i < 5; i += 1) { const phase = seconds * (0.9 + i * 0.07) + this.effectSeed + i * 1.7; const px = Math.sin(phase * 1.3) * sourceW * 0.42; const py = -sourceH * 0.2 + Math.cos(phase) * sourceH * 0.28; const size = 1.5 + (0.5 + 0.5 * Math.sin(phase * 3)) * 2; ctx.beginPath(); ctx.moveTo(px, py - size * 2); ctx.lineTo(px + size * 0.65, py - size * 0.65); ctx.lineTo(px + size * 2, py); ctx.lineTo(px + size * 0.65, py + size * 0.65); ctx.lineTo(px, py + size * 2); ctx.lineTo(px - size * 0.65, py + size * 0.65); ctx.lineTo(px - size * 2, py); ctx.lineTo(px - size * 0.65, py - size * 0.65); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    if (preset.effects.includes("tears")) { ctx.save(); ctx.globalAlpha *= alpha * (0.55 + 0.25 * Math.sin(seconds * 2.2)); ctx.fillStyle = "rgba(171, 220, 255, .82)"; const layout = FACE_LAYOUTS[preset.source] || FACE_LAYOUTS.uruuru; for (const eye of [layout.leftEye, layout.rightEye]) { const x = eye[0] + eye[2] * 0.52; const y = eye[1] + eye[3] * 0.9 + ((seconds * 22) % 13); ctx.beginPath(); ctx.ellipse(x, y, 2.2, 5.6, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  }

  getSnapshot() { return { emotion: this.transition ? this.transition.to : this.currentEmotion, transition: this.transition ? { from: this.transition.from, to: this.transition.to } : null, mouthOpen: this.mouthOpen, mouthTarget: this.mouthTarget, mouthForm: this.mouthForm, viseme: this.viseme, lipSyncMode: this.lipSyncMode, audio: { ...this.audioResult }, blinkLevel: this.blinkLevel, breath: this.breathValue, fps: this.fps, parameters: this.parameters }; }
  async destroy() { this.stop(); this.resizeObserver.disconnect(); this.canvas.removeEventListener("pointermove", this.onPointerMove); this.canvas.removeEventListener("pointerleave", this.onPointerLeave); await this.stopMicrophoneLipSync(); }
}

export async function createAvatar(canvas, presets = FALLBACK_PRESETS) { const avatar = new AvatarController(canvas, presets); await avatar.load(); avatar.start(); return avatar; }
