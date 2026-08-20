import { EXPRESSION_PARAMS, FALLBACK_PRESETS, PART_FILES, SOURCE_FILES, VISEMES } from "../avatar/data.js";
import { analyseSpectrum, clamp01, createLipSyncState, smoothLipSync } from "../avatar/lipsync.js";
import { createGrid, createDeformedQuad, deformGrid } from "./grid.js";
import { createSecondaryMotionState, stepSecondaryMotion } from "./physics.js";
import { WebGLMeshRenderer } from "./renderer.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const radians = (degrees) => degrees * Math.PI / 180;
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

const QUAD_UVS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
const QUAD_INDICES = new Uint16Array([0, 2, 1, 1, 2, 3]);
const emptyAudio = () => ({ rms: 0, low: 0, mid: 0, high: 0, noiseFloor: 0.018, open: 0, weight: 0, viseme: "CLOSED" });

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${path}`));
    image.src = path;
  });
}

async function loadOptional(entries) {
  const results = await Promise.all(entries.map(async ([key, path]) => {
    try { return [key, await loadImage(path)]; }
    catch (error) { console.warn(`[mesh-rig] optional part skipped: ${key}`, error); return null; }
  }));
  return Object.fromEntries(results.filter(Boolean));
}

function expressionFor(name, intensity) {
  const neutral = EXPRESSION_PARAMS.neutral;
  const target = EXPRESSION_PARAMS[name] || neutral;
  const t = clamp(intensity, 0, 1);
  const result = {};
  for (const key of new Set([...Object.keys(neutral), ...Object.keys(target)])) {
    result[key] = lerp(Number(neutral[key]) || 0, Number(target[key]) || 0, t);
  }
  return result;
}

function motionFor(name, seconds, age, intensity) {
  const i = clamp(intensity, 0, 1.5);
  const m = { x: 0, y: 0, rotation: 0, scale: 1, bodyX: 0, bodyZ: 0 };
  switch (name) {
    case "happy_bob": m.y = Math.sin(seconds * 4.2) * 0.018 * i; m.rotation = Math.sin(seconds * 2.1) * 0.8 * i; m.bodyZ = Math.sin(seconds * 2.1) * 1.2 * i; break;
    case "jump_once": { const p = Math.min(1, age / 0.9); const jump = Math.sin(p * Math.PI); m.y = -0.11 * jump * i; m.scale = 1 + 0.035 * jump * i; break; }
    case "pose_forward_hands": m.y = Math.sin(seconds * 1.8) * 0.009 * i; m.bodyZ = Math.sin(seconds * 1.25) * 0.8 * i; break;
    case "pleading_idle": m.y = Math.sin(seconds * 2) * 0.008 * i; m.bodyX = Math.sin(seconds * 1.1) * 0.45 * i; break;
    case "lay_idle": m.x = Math.sin(seconds * 0.65) * 0.012 * i; m.bodyZ = Math.sin(seconds * 1.25) * 0.5 * i; break;
    case "sick_recoil": { const impulse = Math.exp(-Math.min(age, 2) * 2.8) * Math.sin(age * 17); m.x = impulse * 0.04 * i; m.rotation = impulse * 2.2 * i; break; }
    case "angry_tense": m.x = Math.sin(seconds * 20) * 0.006 * i; m.bodyX = Math.sin(seconds * 16) * 1.1 * i; break;
    case "annoyed_shift": m.x = Math.sin(seconds * 0.95) * 0.016 * i; m.rotation = Math.sin(seconds * 0.8) * 0.7 * i; break;
    case "sad_sink": m.y = 0.018 * i + Math.sin(seconds * 1.15) * 0.005 * i; m.bodyZ = Math.sin(seconds * 0.7) * 0.6 * i; break;
    case "startle": { const impulse = Math.exp(-Math.min(age, 1.5) * 5); m.y = -0.07 * impulse * i; m.scale = 1 + 0.04 * impulse * i; break; }
    case "shy_shift": m.x = Math.sin(seconds * 1.2) * 0.012 * i; m.rotation = Math.sin(seconds * 1.05) * 0.75 * i; break;
    case "scared_shiver": m.x = Math.sin(seconds * 25) * 0.012 * i; m.y = Math.cos(seconds * 22) * 0.005 * i; m.bodyZ = Math.sin(seconds * 19) * 1.5 * i; break;
    case "smug_hold": m.y = Math.sin(seconds * 1.35) * 0.007 * i; m.rotation = 0.4 * i; break;
    case "confused_tilt": m.rotation = Math.sin(seconds * 1.3) * 1.4 * i; m.bodyZ = Math.sin(seconds * 0.8) * 0.7 * i; break;
    case "love_bob": m.y = Math.sin(seconds * 3.2) * 0.018 * i; m.scale = 1.012 + Math.sin(seconds * 3.2) * 0.008 * i; break;
    default: m.y = Math.sin(seconds * 1.3) * 0.004 * i; m.bodyZ = Math.sin(seconds * 0.58) * 0.35 * i; break;
  }
  return m;
}

export class MeshAvatarController {
  constructor(canvas, presets = FALLBACK_PRESETS, options = {}) {
    this.canvas = canvas;
    this.presets = presets;
    this.renderer = new WebGLMeshRenderer(canvas);
    this.grid = createGrid(options.columns || 24, options.rows || 28);
    this.deformed = new Float32Array(this.grid.positions.length);
    this.secondary = createSecondaryMotionState();
    this.images = {}; this.parts = {};
    this.currentEmotion = "neutral"; this.currentIntensity = 1; this.emotionStartedAt = now(); this.transition = null;
    this.manualMouth = 0; this.mouthTarget = 0; this.mouthOpen = 0; this.mouthForm = 0; this.mouthFormTarget = 0;
    this.viseme = "CLOSED"; this.previousViseme = "CLOSED"; this.visemeChangedAt = now();
    this.lipSyncMode = "manual"; this.lipSyncTest = false; this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); this.audioFeatures = null;
    this.audioContext = null; this.microphoneStream = null; this.microphoneSource = null; this.analyser = null; this.timeData = null; this.frequencyData = null;
    this.blinkEnabled = true; this.blinkLevel = 1; this.blinkStart = -1; this.nextBlinkAt = now() + 3000; this.breathEnabled = true; this.breathValue = 0;
    this.pointerTarget = { x: 0, y: 0 }; this.pointer = { x: 0, y: 0 }; this.pointerVelocityX = 0;
    this.lastTime = 0; this.started = false; this.frameTimes = []; this.fps = 0; this.parameters = {}; this.showMesh = false;
    this.onPointerMove = (event) => this.updatePointer(event); this.onPointerLeave = () => { this.pointerTarget.x = 0; this.pointerTarget.y = 0; };
    canvas.addEventListener("pointermove", this.onPointerMove); canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.onWindowResize = () => this.resize();
    if (typeof ResizeObserver !== "undefined") { this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement || canvas); }
    else window.addEventListener("resize", this.onWindowResize);
  }

  async load() {
    const sources = await Promise.all(Object.entries(SOURCE_FILES).map(async ([key, path]) => [key, await loadImage(path)]));
    this.images = Object.fromEntries(sources);
    this.parts = await loadOptional(Object.entries(PART_FILES));
    this.resize();
    return this;
  }

  resize() {
    const box = this.canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(320, Math.round(box?.width || 420));
    const height = Math.max(360, Math.round(Math.min(width * 1.12, 560)));
    this.renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, 2));
    this.width = width; this.height = height;
  }

  updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    this.pointerTarget.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    this.pointerTarget.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  }

  start() { if (this.started) return; this.started = true; const frame = (time) => { if (!this.started) return; this.update(time); this.render(time); requestAnimationFrame(frame); }; requestAnimationFrame(frame); }
  stop() { this.started = false; }

  setEmotion(id, options = {}) {
    if (!this.presets[id]) return Promise.reject(new Error(`알 수 없는 emotion: ${id}`));
    if (this.transition) { this.currentEmotion = this.transition.to; this.currentIntensity = this.transition.toIntensity; this.transition.resolve?.(); this.transition = null; }
    const intensity = clamp(options.intensity ?? 1, 0, 1.5);
    if (options.immediate || id === this.currentEmotion) { this.currentEmotion = id; this.currentIntensity = intensity; this.emotionStartedAt = now(); return Promise.resolve(); }
    const duration = Math.max(100, Number(options.duration) || 460);
    this.transition = { from: this.currentEmotion, to: id, fromIntensity: this.currentIntensity, toIntensity: intensity, start: now(), duration, resolve: null };
    return new Promise((resolve) => { this.transition.resolve = resolve; });
  }

  setMouthOpen(value) { const open = clamp01(value); this.manualMouth = open; this.mouthTarget = open; const key = open > 0.62 ? "A" : open > 0.22 ? "I" : "CLOSED"; this.setVisemeName(key); this.mouthFormTarget = VISEMES[key]?.mouthForm || 0; if (this.lipSyncMode === "manual") this.audioResult = emptyAudio(); }
  setVisemeName(value) { const key = VISEMES[value] ? value : "CLOSED"; if (key !== this.viseme) { this.previousViseme = this.viseme; this.viseme = key; this.visemeChangedAt = now(); } }
  setViseme(value, weight = 1) { const requested = String(value || "CLOSED").toUpperCase(); const key = VISEMES[requested] ? requested : "CLOSED"; const viseme = VISEMES[key]; const w = clamp01(weight); this.setVisemeName(key); this.manualMouth = viseme.mouthOpen * w; this.mouthTarget = this.manualMouth; this.mouthFormTarget = (viseme.mouthForm || 0) * w; }
  setBlinkEnabled(enabled) { this.blinkEnabled = Boolean(enabled); if (!enabled) { this.blinkStart = -1; this.blinkLevel = 1; } }
  setBreathEnabled(enabled) { this.breathEnabled = Boolean(enabled); }
  setDebug({ showBounds, showMesh } = {}) { if (showMesh !== undefined) this.showMesh = Boolean(showMesh); else if (showBounds !== undefined) this.showMesh = Boolean(showBounds); }

  setLipSyncTest(enabled) { this.lipSyncTest = Boolean(enabled); if (enabled) { if (this.lipSyncMode === "microphone") void this.stopMicrophoneLipSync({ preserveMode: true }); this.lipSyncMode = "test"; this.audioFeatures = null; this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); } else if (this.lipSyncMode === "test") { this.lipSyncMode = "manual"; this.mouthTarget = this.manualMouth; this.audioResult = emptyAudio(); } }
  setAudioFeatures(features) { if (this.lipSyncMode === "microphone") void this.stopMicrophoneLipSync({ preserveMode: true }); this.lipSyncTest = false; this.lipSyncMode = "external"; this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); this.audioFeatures = { rms: Math.max(0, Number(features?.rms) || 0), low: Math.max(0, Number(features?.low) || 0), mid: Math.max(0, Number(features?.mid) || 0), high: Math.max(0, Number(features?.high) || 0) }; }
  clearAudioFeatures() { this.audioFeatures = null; if (this.lipSyncMode === "external") { this.lipSyncMode = "manual"; this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); this.mouthTarget = this.manualMouth; } }

  async startMicrophoneLipSync() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("이 브라우저는 마이크 입력을 지원하지 않습니다.");
    await this.stopMicrophoneLipSync();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    let context;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) throw new Error("Web Audio API를 사용할 수 없습니다.");
      context = new AudioContextClass(); if (context.state === "suspended") await context.resume();
      const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.34; source.connect(analyser);
      this.microphoneStream = stream; this.audioContext = context; this.microphoneSource = source; this.analyser = analyser; this.timeData = new Uint8Array(analyser.fftSize); this.frequencyData = new Uint8Array(analyser.frequencyBinCount); this.lipSyncState = createLipSyncState(); this.lipSyncTest = false; this.lipSyncMode = "microphone"; return true;
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop()); if (context && context.state !== "closed") { try { await context.close(); } catch {} } throw error;
    }
  }

  async stopMicrophoneLipSync({ preserveMode = false } = {}) { try { this.microphoneSource?.disconnect(); } catch {} this.microphoneStream?.getTracks().forEach((track) => track.stop()); if (this.audioContext && this.audioContext.state !== "closed") { try { await this.audioContext.close(); } catch {} } this.audioContext = null; this.microphoneStream = null; this.microphoneSource = null; this.analyser = null; this.timeData = null; this.frequencyData = null; if (!preserveMode && this.lipSyncMode === "microphone") this.lipSyncMode = "manual"; this.audioResult = emptyAudio(); }

  sampleLipSync(dt, seconds, preset) {
    if (preset?.lipSyncEnabled === false) { this.mouthTarget = 0; this.mouthFormTarget = 0; this.setVisemeName("CLOSED"); return; }
    let features = null;
    if (this.lipSyncMode === "microphone" && this.analyser) { this.analyser.getByteTimeDomainData(this.timeData); this.analyser.getByteFrequencyData(this.frequencyData); features = analyseSpectrum(this.timeData, this.frequencyData, this.audioContext?.sampleRate || 48000, this.analyser.fftSize); }
    else if (this.lipSyncMode === "external") features = this.audioFeatures;
    if (features) { this.audioResult = smoothLipSync(this.lipSyncState, features, dt); const selected = VISEMES[this.audioResult.viseme] || VISEMES.CLOSED; this.setVisemeName(this.audioResult.viseme); this.mouthTarget = clamp01(Math.max(this.audioResult.open * 0.96, selected.mouthOpen * this.audioResult.weight * 0.7)); this.mouthFormTarget = (selected.mouthForm || 0) * this.audioResult.weight; return; }
    if (this.lipSyncTest) { const open = clamp01((0.5 + 0.5 * Math.sin(seconds * 9.2)) * (0.48 + 0.48 * Math.sin(seconds * 1.7))); const sequence = ["A", "I", "U", "E", "O"]; const key = sequence[Math.floor(seconds * 4) % sequence.length]; this.setVisemeName(open < 0.06 ? "CLOSED" : key); this.mouthTarget = open; this.mouthFormTarget = (VISEMES[key]?.mouthForm || 0) * open; this.audioResult = { ...emptyAudio(), rms: open * 0.2, open, weight: open, viseme: this.viseme }; return; }
    this.mouthTarget = this.manualMouth;
  }

  updateBlink(time) {
    if (!this.blinkEnabled) { this.blinkLevel = 1; return; }
    if (this.blinkStart < 0 && time >= this.nextBlinkAt) this.blinkStart = time;
    if (this.blinkStart >= 0) { const p = clamp((time - this.blinkStart) / 300); this.blinkLevel = p < 0.42 ? 1 - ease(p / 0.42) : ease((p - 0.42) / 0.58); if (p >= 1) { this.blinkStart = -1; this.blinkLevel = 1; this.nextBlinkAt = time + 2700 + Math.random() * 3600; } }
  }

  buildParameters(emotionId, intensity, time, motion) {
    const preset = this.presets[emotionId] || FALLBACK_PRESETS.neutral; const expression = expressionFor(preset.expression, intensity); const gazeX = this.pointer.x; const gazeY = this.pointer.y;
    return { ParamAngleX: gazeX * 12 * intensity, ParamAngleY: -gazeY * 8 * intensity, ParamAngleZ: gazeX * 2.2, ParamBodyAngleX: motion.bodyX, ParamBodyAngleY: this.breathValue * 0.9 - 0.45, ParamBodyAngleZ: motion.bodyZ, ParamEyeLOpen: clamp01((expression.eyeOpen ?? 1) * this.blinkLevel), ParamEyeROpen: clamp01((expression.eyeOpen ?? 1) * this.blinkLevel), ParamMouthOpenY: this.mouthOpen, ParamMouthForm: lerp(expression.mouthForm || 0, this.mouthForm, clamp01(this.mouthOpen * 1.2)), ParamCheek: expression.cheek || 0, ParamBreath: this.breathValue * (preset.breathScale ?? 1) };
  }

  update(time) {
    if (!this.lastTime) this.lastTime = time; const dt = Math.min(64, Math.max(1, time - this.lastTime)); const seconds = time / 1000; const oldX = this.pointer.x; this.pointer.x += (this.pointerTarget.x - this.pointer.x) * (1 - Math.exp(-dt * 0.009)); this.pointer.y += (this.pointerTarget.y - this.pointer.y) * (1 - Math.exp(-dt * 0.009)); this.pointerVelocityX = (this.pointer.x - oldX) / (dt / 1000); this.lastTime = time;
    this.breathValue = this.breathEnabled ? (Math.sin(seconds * 1.55) + 1) * 0.5 : 0; this.updateBlink(time);
    const activeId = this.transition ? this.transition.to : this.currentEmotion; const preset = this.presets[activeId] || FALLBACK_PRESETS.neutral; this.sampleLipSync(dt, seconds, preset);
    this.mouthOpen += (this.mouthTarget - this.mouthOpen) * (1 - Math.exp(-dt * 0.03)); this.mouthForm += (this.mouthFormTarget - this.mouthForm) * (1 - Math.exp(-dt * 0.024));
    const age = Math.max(0, (time - (this.transition?.start || this.emotionStartedAt)) / 1000); const motion = motionFor(preset.bodyMotion, seconds, age, this.currentIntensity); stepSecondaryMotion(this.secondary, { headX: this.pointer.x, bodyZ: motion.bodyZ / 5, velocityX: clamp(this.pointerVelocityX / 8, -1, 1), breath: this.breathValue }, dt);
    this.frameTimes.push(time); while (this.frameTimes.length && this.frameTimes[0] < time - 1000) this.frameTimes.shift(); this.fps = this.frameTimes.length;
    if (this.transition && (time - this.transition.start) / this.transition.duration >= 1) { const resolver = this.transition.resolve; this.currentEmotion = this.transition.to; this.currentIntensity = this.transition.toIntensity; this.emotionStartedAt = time; this.transition = null; resolver?.(); }
  }

  drawPart(partName, rect, sourceW, sourceH, parameters, transform, opacity = 1) { const image = this.parts[partName]; if (!image || opacity <= 0.001) return; const positions = createDeformedQuad(rect, sourceW, sourceH, parameters, this.secondary); this.renderer.drawMesh(image, positions, QUAD_UVS, QUAD_INDICES, { ...transform, opacity }); }

  drawFace(emotionId, source, sourceW, sourceH, parameters, transform, time, opacity) {
    const layout = FACE_LAYOUTS[source]; if (!layout) return;
    const eyeOpen = clamp01((parameters.ParamEyeLOpen + parameters.ParamEyeROpen) * 0.5); const closed = clamp01((1 - eyeOpen) * 1.4) * opacity;
    if (source === "uruuru") { this.drawPart("eyeUruuruL", layout.leftEye, sourceW, sourceH, parameters, transform, eyeOpen * opacity); this.drawPart("eyeUruuruR", layout.rightEye, sourceW, sourceH, parameters, transform, eyeOpen * opacity); }
    if (closed > 0.01 && source !== "gorogoro") { this.drawPart("eyeClosedL", layout.leftEye, sourceW, sourceH, parameters, transform, closed); this.drawPart("eyeClosedR", layout.rightEye, sourceW, sourceH, parameters, transform, closed); }
    if (source === "peace" && ["teasing", "smug"].includes(emotionId)) this.drawPart("eyeWinkR", layout.rightEye, sourceW, sourceH, parameters, transform, 0.88 * opacity);
    const open = clamp01(parameters.ParamMouthOpenY); const partFor = (viseme) => { if (viseme === "CLOSED" || open < 0.05) return source === "uruuru" ? "mouthUruuru" : source === "peace" ? "mouthSmall" : "mouthClosed"; return VISEMES[viseme]?.mouthPart || "mouthA"; };
    const blend = clamp01((time - this.visemeChangedAt) / 80); const previous = partFor(this.previousViseme); const current = partFor(this.viseme); if (previous !== current && blend < 1) this.drawPart(previous, layout.mouth, sourceW, sourceH, parameters, transform, (1 - blend) * opacity); this.drawPart(current, layout.mouth, sourceW, sourceH, parameters, transform, (previous === current ? 1 : blend) * opacity);
  }

  renderEntity(emotionId, intensity, opacity, time) {
    const preset = this.presets[emotionId] || FALLBACK_PRESETS.neutral; const image = this.images[preset.source]; if (!image) return;
    const sourceW = image.naturalWidth || SOURCE_DIMENSIONS[preset.source][0]; const sourceH = image.naturalHeight || SOURCE_DIMENSIONS[preset.source][1]; const seconds = time / 1000; const age = Math.max(0, (time - (this.transition?.to === emotionId ? this.transition.start : this.emotionStartedAt)) / 1000); const motion = motionFor(preset.bodyMotion, seconds, age, intensity); const parameters = this.buildParameters(emotionId, intensity, time, motion); this.parameters = parameters; deformGrid(this.grid.positions, parameters, this.secondary, this.deformed);
    const scale = this.renderer.fitScale(image, 0.84); const pose = preset.pose || {}; const transform = { scale: [scale[0] * (pose.scale || 1) * motion.scale, scale[1] * (pose.scale || 1) * motion.scale], offset: [motion.x + ((pose.x || 0) / sourceW) * scale[0] * 2, motion.y + ((pose.y || 0) / sourceH) * scale[1] * 2], rotation: radians((pose.rotation || 0) + motion.rotation), opacity };
    this.renderer.drawMesh(image, this.deformed, this.grid.uvs, this.grid.triangles, transform); this.drawFace(emotionId, preset.source, sourceW, sourceH, parameters, transform, time, opacity); if (this.showMesh) this.renderer.drawWireframe(this.deformed, this.grid.lines, transform);
  }

  render(time) { this.renderer.clear(); if (this.transition) { const p = ease(clamp((time - this.transition.start) / this.transition.duration)); this.renderEntity(this.transition.from, this.transition.fromIntensity, 1 - p, time); this.renderEntity(this.transition.to, this.transition.toIntensity, p, time); } else this.renderEntity(this.currentEmotion, this.currentIntensity, 1, time); }

  getSnapshot() { return { emotion: this.transition ? this.transition.to : this.currentEmotion, transition: this.transition ? { from: this.transition.from, to: this.transition.to } : null, mouthOpen: this.mouthOpen, mouthForm: this.mouthForm, viseme: this.viseme, lipSyncMode: this.lipSyncMode, audio: { ...this.audioResult }, blinkLevel: this.blinkLevel, breath: this.breathValue, fps: this.fps, parameters: this.parameters, renderer: "webgl-mesh", grid: `${this.grid.columns}x${this.grid.rows}` }; }

  async reset() { this.currentEmotion = "neutral"; this.currentIntensity = 1; this.transition?.resolve?.(); this.transition = null; this.emotionStartedAt = now(); this.manualMouth = 0; this.mouthTarget = 0; this.mouthFormTarget = 0; this.setVisemeName("CLOSED"); this.lipSyncTest = false; this.audioFeatures = null; await this.stopMicrophoneLipSync(); this.lipSyncMode = "manual"; this.blinkEnabled = true; this.breathEnabled = true; }
  async destroy() { this.stop(); await this.stopMicrophoneLipSync(); this.resizeObserver?.disconnect(); if (!this.resizeObserver) window.removeEventListener("resize", this.onWindowResize); this.canvas.removeEventListener("pointermove", this.onPointerMove); this.canvas.removeEventListener("pointerleave", this.onPointerLeave); this.renderer.destroy(); }
}

export async function createMeshAvatar(canvas, presets = FALLBACK_PRESETS, options = {}) { const avatar = new MeshAvatarController(canvas, presets, options); await avatar.load(); avatar.start(); return avatar; }
