import { FALLBACK_PRESETS, VISEMES } from "../avatar/data.js";
import { analyseSpectrum, clamp01, createLipSyncState, smoothLipSync } from "../avatar/lipsync.js";
import { stepSecondaryMotion } from "./physics.js";
import { blendMotion, lerp, sampleTransition } from "./transition.js";
import { clamp, ease, emptyAudio, motionFor, now } from "./controller-common.js";

export const stateMethods = {
  setEmotion(id, options = {}) {
    if (!this.presets[id]) return Promise.reject(new Error(`알 수 없는 emotion: ${id}`));
    if (this.transition) { this.currentEmotion = this.transition.to; this.currentIntensity = this.transition.toIntensity; this.emotionStartedAt = this.transition.start; this.transition.resolve?.(); this.transition = null; }
    const intensity = clamp(options.intensity ?? 1, 0, 1.5);
    if (options.immediate || id === this.currentEmotion) { this.currentEmotion = id; this.currentIntensity = intensity; this.emotionStartedAt = now(); return Promise.resolve(); }
    const duration = Math.max(260, Number(options.duration) || 620);
    this.transition = { from: this.currentEmotion, to: id, fromIntensity: this.currentIntensity, toIntensity: intensity, start: now(), duration, resolve: null };
    return new Promise((resolve) => { this.transition.resolve = resolve; });
  },
  setMouthOpen(value) { const open = clamp01(value); this.manualMouth = open; this.mouthTarget = open; const key = open > 0.62 ? "A" : open > 0.22 ? "I" : "CLOSED"; this.setVisemeName(key); this.mouthFormTarget = VISEMES[key]?.mouthForm || 0; if (this.lipSyncMode === "manual") this.audioResult = emptyAudio(); },
  setVisemeName(value) { const key = VISEMES[value] ? value : "CLOSED"; if (key !== this.viseme) { this.previousViseme = this.viseme; this.viseme = key; this.visemeChangedAt = now(); } },
  setViseme(value, weight = 1) { const requested = String(value || "CLOSED").toUpperCase(); const key = VISEMES[requested] ? requested : "CLOSED"; const viseme = VISEMES[key]; const w = clamp01(weight); this.setVisemeName(key); this.manualMouth = viseme.mouthOpen * w; this.mouthTarget = this.manualMouth; this.mouthFormTarget = (viseme.mouthForm || 0) * w; },
  setBlinkEnabled(enabled) { this.blinkEnabled = Boolean(enabled); this.blinkStart = -1; this.blinkLevel = 1; this.nextBlinkAt = now() + 2400 + Math.random() * 1800; },
  setBreathEnabled(enabled) { this.breathEnabled = Boolean(enabled); },
  setDebug({ showBounds, showMesh } = {}) { if (showMesh !== undefined) this.showMesh = Boolean(showMesh); else if (showBounds !== undefined) this.showMesh = Boolean(showBounds); },
  setLipSyncTest(enabled) { this.lipSyncTest = Boolean(enabled); if (enabled) { if (this.lipSyncMode === "microphone") void this.stopMicrophoneLipSync({ preserveMode: true }); this.lipSyncMode = "test"; this.audioFeatures = null; this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); } else if (this.lipSyncMode === "test") { this.lipSyncMode = "manual"; this.mouthTarget = this.manualMouth; this.audioResult = emptyAudio(); } },
  setAudioFeatures(features) { if (this.lipSyncMode === "microphone") void this.stopMicrophoneLipSync({ preserveMode: true }); if (this.lipSyncMode !== "external") { this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); } this.lipSyncTest = false; this.lipSyncMode = "external"; this.audioFeatures = { rms: Math.max(0, Number(features?.rms) || 0), low: Math.max(0, Number(features?.low) || 0), mid: Math.max(0, Number(features?.mid) || 0), high: Math.max(0, Number(features?.high) || 0) }; },
  clearAudioFeatures() { this.audioFeatures = null; if (this.lipSyncMode === "external") { this.lipSyncMode = "manual"; this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); this.mouthTarget = this.manualMouth; } },
  async startMicrophoneLipSync() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("이 브라우저는 마이크 입력을 지원하지 않습니다.");
    await this.stopMicrophoneLipSync();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    let context;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) throw new Error("Web Audio API를 사용할 수 없습니다.");
      context = new AudioContextClass(); if (context.state === "suspended") await context.resume();
      const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.34; source.connect(analyser);
      this.microphoneStream = stream; this.audioContext = context; this.microphoneSource = source; this.analyser = analyser; this.timeData = new Uint8Array(analyser.fftSize); this.frequencyData = new Uint8Array(analyser.frequencyBinCount); this.lipSyncState = createLipSyncState(); this.audioResult = emptyAudio(); this.lipSyncTest = false; this.lipSyncMode = "microphone";
      for (const track of stream.getTracks()) { const handler = () => { void this.stopMicrophoneLipSync(); }; this.trackEndedHandlers.set(track, handler); track.addEventListener?.("ended", handler, { once: true }); }
      return true;
    } catch (error) { stream.getTracks().forEach((track) => track.stop()); if (context && context.state !== "closed") { try { await context.close(); } catch {} } this.audioResult = emptyAudio(); this.lipSyncMode = "manual"; throw error; }
  },
  async stopMicrophoneLipSync({ preserveMode = false } = {}) {
    try { this.microphoneSource?.disconnect(); } catch {}
    for (const track of this.microphoneStream?.getTracks?.() || []) { const handler = this.trackEndedHandlers.get(track); if (handler) track.removeEventListener?.("ended", handler); this.trackEndedHandlers.delete(track); track.stop(); }
    const context = this.audioContext; this.audioContext = null; this.microphoneStream = null; this.microphoneSource = null; this.analyser = null; this.timeData = null; this.frequencyData = null; if (!preserveMode && this.lipSyncMode === "microphone") this.lipSyncMode = "manual"; this.audioResult = emptyAudio(); if (context && context.state !== "closed") { try { await context.close(); } catch {} }
  },
  sampleLipSync(dt, seconds, preset) {
    if (preset?.lipSyncEnabled === false) { this.mouthTarget = 0; this.mouthFormTarget = 0; this.setVisemeName("CLOSED"); return; }
    let features = null;
    if (this.lipSyncMode === "microphone" && this.analyser) { this.analyser.getByteTimeDomainData(this.timeData); this.analyser.getByteFrequencyData(this.frequencyData); features = analyseSpectrum(this.timeData, this.frequencyData, this.audioContext?.sampleRate || 48000, this.analyser.fftSize); } else if (this.lipSyncMode === "external") features = this.audioFeatures;
    if (features) { this.audioResult = smoothLipSync(this.lipSyncState, features, dt); const selected = VISEMES[this.audioResult.viseme] || VISEMES.CLOSED; this.setVisemeName(this.audioResult.viseme); this.mouthTarget = clamp01(Math.max(this.audioResult.open * 0.96, selected.mouthOpen * this.audioResult.weight * 0.7)); this.mouthFormTarget = (selected.mouthForm || 0) * this.audioResult.weight; return; }
    if (this.lipSyncTest) { const open = clamp01((0.5 + 0.5 * Math.sin(seconds * 9.2)) * (0.48 + 0.48 * Math.sin(seconds * 1.7))); const sequence = ["A", "I", "U", "E", "O"]; const key = sequence[Math.floor(seconds * 4) % sequence.length]; this.setVisemeName(open < 0.06 ? "CLOSED" : key); this.mouthTarget = open; this.mouthFormTarget = (VISEMES[key]?.mouthForm || 0) * open; this.audioResult = { ...emptyAudio(), rms: open * 0.2, open, weight: open, viseme: this.viseme }; return; }
    this.mouthTarget = this.manualMouth;
  },
  updateBlink(time) { if (!this.blinkEnabled) { this.blinkLevel = 1; return; } if (this.blinkStart < 0 && time >= this.nextBlinkAt) this.blinkStart = time; if (this.blinkStart >= 0) { const p = clamp((time - this.blinkStart) / 300); this.blinkLevel = p < 0.42 ? 1 - ease(p / 0.42) : ease((p - 0.42) / 0.58); if (p >= 1) { this.blinkStart = -1; this.blinkLevel = 1; this.nextBlinkAt = time + 2700 + Math.random() * 3600; } } },
  buildParameters(expression, intensity, motion) { const gazeX = this.pointer.x; const gazeY = this.pointer.y; return { ParamAngleX: gazeX * 12 * intensity, ParamAngleY: -gazeY * 8 * intensity, ParamAngleZ: gazeX * 2.2, ParamBodyAngleX: motion.bodyX, ParamBodyAngleY: this.breathValue * 0.9 - 0.45, ParamBodyAngleZ: motion.bodyZ, ParamEyeLOpen: clamp01((expression.eyeOpen ?? 1) * this.blinkLevel), ParamEyeROpen: clamp01((expression.eyeOpen ?? 1) * this.blinkLevel), ParamMouthOpenY: this.mouthOpen, ParamMouthForm: lerp(expression.mouthForm || 0, this.mouthForm, clamp01(this.mouthOpen * 1.2)), ParamCheek: expression.cheek || 0, ParamBreath: this.breathValue }; },
  transitionState(time) { if (!this.transition) return null; const fromPreset = this.presets[this.transition.from] || FALLBACK_PRESETS.neutral; const toPreset = this.presets[this.transition.to] || FALLBACK_PRESETS.neutral; const raw = clamp((time - this.transition.start) / this.transition.duration); return { fromPreset, toPreset, sample: sampleTransition(fromPreset, toPreset, raw) }; },
  update(time) {
    if (!this.lastTime) this.lastTime = time; const dt = Math.min(64, Math.max(1, time - this.lastTime)); const seconds = time / 1000; const oldX = this.pointer.x; this.pointer.x += (this.pointerTarget.x - this.pointer.x) * (1 - Math.exp(-dt * 0.009)); this.pointer.y += (this.pointerTarget.y - this.pointer.y) * (1 - Math.exp(-dt * 0.009)); this.pointerVelocityX = (this.pointer.x - oldX) / (dt / 1000); this.lastTime = time;
    this.breathValue = this.breathEnabled ? (Math.sin(seconds * 1.55) + 1) * 0.5 : 0; this.updateBlink(time);
    const activeId = this.transition ? this.transition.to : this.currentEmotion; const activePreset = this.presets[activeId] || FALLBACK_PRESETS.neutral; this.sampleLipSync(dt, seconds, activePreset); this.mouthOpen += (this.mouthTarget - this.mouthOpen) * (1 - Math.exp(-dt * 0.03)); this.mouthForm += (this.mouthFormTarget - this.mouthForm) * (1 - Math.exp(-dt * 0.024));
    let secondaryMotion; const state = this.transitionState(time);
    if (state) { const fromAge = Math.max(0, (time - this.emotionStartedAt) / 1000); const toAge = Math.max(0, (time - this.transition.start) / 1000); secondaryMotion = blendMotion(motionFor(state.fromPreset.bodyMotion, seconds, fromAge, this.transition.fromIntensity), motionFor(state.toPreset.bodyMotion, seconds, toAge, this.transition.toIntensity), state.sample.progress); this.lastTransitionSample = state.sample; }
    else { const age = Math.max(0, (time - this.emotionStartedAt) / 1000); secondaryMotion = motionFor(activePreset.bodyMotion, seconds, age, this.currentIntensity); this.lastTransitionSample = null; }
    stepSecondaryMotion(this.secondary, { headX: this.pointer.x, bodyZ: secondaryMotion.bodyZ / 5, velocityX: clamp(this.pointerVelocityX / 8, -1, 1), breath: this.breathValue }, dt);
    this.frameTimes.push(time); while (this.frameTimes.length && this.frameTimes[0] < time - 1000) this.frameTimes.shift(); this.fps = this.frameTimes.length;
    if (this.transition && (time - this.transition.start) / this.transition.duration >= 1) { const finished = this.transition; this.currentEmotion = finished.to; this.currentIntensity = finished.toIntensity; this.emotionStartedAt = finished.start; this.transition = null; this.lastTransitionSample = null; finished.resolve?.(); }
  }
};
