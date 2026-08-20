import { EXPRESSION_PARAMS, FALLBACK_PRESETS, PART_FILES, SOURCE_FILES, VISEMES } from "./data.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;
const radians = (degrees) => (degrees * Math.PI) / 180;

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${path}`));
    image.src = path;
  });
}

function sourceDimensions(source) {
  return {
    stand: [259, 270],
    jump: [300, 273],
    peace: [259, 270],
    uruuru: [270, 246],
    gorogoro: [270, 246],
    haku: [250, 246],
  }[source] || [259, 270];
}

/**
 * Raster cutout controller. It keeps the source sprites intact and blends
 * pose attachments, conservative eye/mouth crops, and procedural parameters.
 */
export class AvatarController {
  constructor(canvas, presets = FALLBACK_PRESETS) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.presets = presets;
    this.images = {};
    this.parts = {};
    this.currentEmotion = "neutral";
    this.transition = null;
    this.manualMouth = 0;
    this.mouthTarget = 0;
    this.mouthOpen = 0;
    this.viseme = "CLOSED";
    this.blinkEnabled = true;
    this.breathEnabled = true;
    this.lipSyncTest = false;
    this.showParameters = false;
    this.showBounds = false;
    this.started = false;
    this.lastTime = 0;
    this.breathValue = 0;
    this.blinkLevel = 1;
    this.nextBlinkAt = 0;
    this.blinkStart = -1;
    this.blinkDuration = 520;
    this.frameTimes = [];
    this.fps = 0;
    this.parameters = {};
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
  }

  async load() {
    const sourceEntries = Object.entries(SOURCE_FILES);
    const partEntries = Object.entries(PART_FILES);
    const loadedSources = await Promise.all(sourceEntries.map(async ([key, path]) => [key, await loadImage(path)]));
    const loadedParts = await Promise.all(partEntries.map(async ([key, path]) => [key, await loadImage(path)]));
    this.images = Object.fromEntries(loadedSources);
    this.parts = Object.fromEntries(loadedParts);
    this.resize();
    this.scheduleNextBlink(performance.now());
    return this;
  }

  resize() {
    const box = this.canvas.parentElement?.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.round(box?.width || 420));
    const cssHeight = Math.max(360, Math.round(Math.min(cssWidth * 1.12, 560)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = cssWidth;
    this.height = cssHeight;
  }

  start() {
    if (this.started) return;
    this.started = true;
    const frame = (time) => {
      if (!this.started) return;
      this.update(time);
      this.render(time);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  stop() {
    this.started = false;
  }

  setEmotion(id, options = {}) {
    if (!this.presets[id]) return Promise.reject(new Error(`알 수 없는 emotion: ${id}`));
    const immediate = Boolean(options.immediate);
    const duration = options.duration || (this.presets[id].transitionMotion === "lay_transition" ? 820 : 520);
    if (immediate || id === this.currentEmotion) {
      this.currentEmotion = id;
      this.transition = null;
      return Promise.resolve();
    }
    const from = this.transition ? this.transition.to : this.currentEmotion;
    this.transition = { from, to: id, start: performance.now(), duration };
    return new Promise((resolve) => {
      this.transition.resolve = resolve;
    });
  }

  async reset() {
    this.currentEmotion = "neutral";
    this.transition = null;
    this.setMouthOpen(0);
    this.viseme = "CLOSED";
    this.breathEnabled = true;
    this.blinkEnabled = true;
  }

  setMouthOpen(value) {
    this.manualMouth = clamp(Number(value) || 0);
    this.mouthTarget = this.manualMouth;
    this.viseme = this.manualMouth > 0.55 ? "A" : this.manualMouth > 0.2 ? "I" : "CLOSED";
  }

  setViseme(viseme, weight = 1) {
    const key = String(viseme || "CLOSED").toUpperCase();
    const selected = VISEMES[key] || VISEMES.CLOSED;
    this.viseme = key;
    this.mouthTarget = clamp(selected.mouthOpen * clamp(weight));
    this.manualMouth = this.mouthTarget;
  }

  setLipSyncTest(enabled) {
    this.lipSyncTest = Boolean(enabled);
  }

  setBlinkEnabled(enabled) {
    this.blinkEnabled = Boolean(enabled);
    if (!this.blinkEnabled) this.blinkLevel = 1;
  }

  setBreathEnabled(enabled) {
    this.breathEnabled = Boolean(enabled);
  }

  setDebug({ showParameters, showBounds } = {}) {
    if (showParameters !== undefined) this.showParameters = Boolean(showParameters);
    if (showBounds !== undefined) this.showBounds = Boolean(showBounds);
  }

  scheduleNextBlink(time) {
    const interval = 3000 + Math.random() * 4000;
    this.nextBlinkAt = time + interval;
  }

  updateBlink(time) {
    const preset = this.presets[this.currentEmotion] || FALLBACK_PRESETS.neutral;
    if (!this.blinkEnabled || preset.blinkMode === "disabled") {
      this.blinkLevel = 1;
      return;
    }
    if (this.blinkStart < 0 && time >= this.nextBlinkAt) {
      this.blinkStart = time;
      this.blinkDuration = preset.blinkMode === "special" ? 620 : 520;
    }
    if (this.blinkStart >= 0) {
      const progress = clamp((time - this.blinkStart) / this.blinkDuration);
      // Close 0..0.38, hold 0.38..0.55, open 0.55..1.
      if (progress < 0.38) this.blinkLevel = 1 - easeInOut(progress / 0.38);
      else if (progress < 0.55) this.blinkLevel = 0;
      else this.blinkLevel = easeOut((progress - 0.55) / 0.45);
      if (progress >= 1) {
        this.blinkStart = -1;
        this.blinkLevel = 1;
        this.scheduleNextBlink(time);
      }
    }
  }

  update(time) {
    if (!this.lastTime) this.lastTime = time;
    const dt = Math.min(64, time - this.lastTime);
    this.lastTime = time;
    const seconds = time / 1000;
    const preset = this.presets[this.currentEmotion] || FALLBACK_PRESETS.neutral;
    const period = 3.2 + (Math.sin(seconds * 0.17) + 1) * 0.65;
    this.breathValue = this.breathEnabled ? (Math.sin((seconds / period) * Math.PI * 2) + 1) / 2 : 0;
    this.updateBlink(time);
    const autoMouth = 0.08 + 0.82 * (0.5 + 0.5 * Math.sin(seconds * 6.1) * (0.75 + 0.25 * Math.sin(seconds * 1.7)));
    this.mouthTarget = this.lipSyncTest ? clamp(autoMouth) : this.manualMouth;
    this.mouthOpen += (this.mouthTarget - this.mouthOpen) * (1 - Math.exp(-dt * 0.018));
    this.parameters = this.getParameterSnapshot(seconds, preset);
    this.frameTimes.push(time);
    while (this.frameTimes.length && this.frameTimes[0] < time - 1000) this.frameTimes.shift();
    this.fps = this.frameTimes.length;
    if (this.transition) {
      const progress = clamp((time - this.transition.start) / this.transition.duration);
      if (progress >= 1) {
        const resolver = this.transition.resolve;
        this.currentEmotion = this.transition.to;
        this.transition = null;
        resolver?.();
      }
    }
  }

  getParameterSnapshot(seconds, preset) {
    const expression = EXPRESSION_PARAMS[preset.expression] || EXPRESSION_PARAMS.neutral;
    const breathe = this.breathValue * (preset.breathScale ?? 1);
    return {
      ParamAngleX: preset.pose?.rotation || 0,
      ParamAngleY: (preset.pose?.y || 0) * 0.08,
      ParamAngleZ: preset.pose?.rotation || 0,
      ParamBodyAngleX: Math.sin(seconds * 0.7) * 0.3,
      ParamBodyAngleY: breathe * 0.5 - 0.3,
      ParamBodyAngleZ: Math.sin(seconds * 0.53) * 0.2,
      ParamEyeLOpen: expression.eyeOpen * this.blinkLevel,
      ParamEyeROpen: expression.eyeOpen * this.blinkLevel,
      ParamEyeLSmile: expression.eyeSmile,
      ParamEyeRSmile: expression.eyeSmile,
      ParamEyeBallX: expression.eyeBallX,
      ParamEyeBallY: expression.eyeBallY,
      ParamBrowLY: expression.browL,
      ParamBrowRY: expression.browR,
      ParamBrowLAngle: expression.browL,
      ParamBrowRAngle: expression.browR,
      ParamBrowLForm: expression.browL,
      ParamBrowRForm: expression.browR,
      ParamMouthOpenY: this.mouthOpen,
      ParamMouthForm: expression.mouthForm,
      ParamCheek: expression.cheek,
      ParamBreath: breathe,
      ParamTwinTailL: Math.sin(seconds * 1.3) * breathe,
      ParamTwinTailR: Math.sin(seconds * 1.3 + 0.42) * breathe,
    };
  }

  render(time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const dpr = this.canvas.width / this.width;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#16121c";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "rgba(255, 123, 183, .06)";
    ctx.fillRect(18, 18, this.width - 36, this.height - 36);
    if (!Object.keys(this.images).length) {
      ctx.fillStyle = "#ffd8ea";
      ctx.font = "16px sans-serif";
      ctx.fillText("원본 PNG를 불러오는 중…", 28, 48);
      ctx.restore();
      return;
    }
    if (this.transition) {
      const progress = clamp((time - this.transition.start) / this.transition.duration);
      const eased = easeInOut(progress);
      this.renderEntity(this.transition.from, 1 - eased, time);
      this.renderEntity(this.transition.to, eased, time);
    } else {
      this.renderEntity(this.currentEmotion, 1, time);
    }
    ctx.restore();
  }

  renderEntity(emotionId, alpha, time) {
    const preset = this.presets[emotionId] || FALLBACK_PRESETS.neutral;
    const image = this.images[preset.source];
    if (!image) return;
    const ctx = this.ctx;
    const seconds = time / 1000;
    const sourceW = image.naturalWidth || sourceDimensions(preset.source)[0];
    const sourceH = image.naturalHeight || sourceDimensions(preset.source)[1];
    const fit = Math.min((this.width * 0.78) / sourceW, (this.height * 0.82) / sourceH);
    const breath = this.breathEnabled ? Math.sin(seconds * 1.4) * (preset.breathScale || 1) * 1.8 : 0;
    const shake = ["scared", "angry"].includes(emotionId) ? Math.sin(seconds * 18) * 1.1 : 0;
    const pose = preset.pose || { x: 0, y: 0, rotation: 0, scale: 1 };
    const x = this.width / 2 + (pose.x || 0) + shake;
    const y = this.height * 0.49 + (pose.y || 0) + breath;
    const rotation = radians((pose.rotation || 0) + (this.breathEnabled ? Math.sin(seconds * 0.7) * 0.25 : 0));
    const scale = fit * (pose.scale || 1);
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.drawImage(image, -sourceW / 2, -sourceH / 2);
    this.drawEyeSystem(emotionId, preset.source, this.parameters, alpha);
    this.drawMouthSystem(emotionId, preset.source, this.parameters, alpha);
    if (this.showBounds) {
      ctx.strokeStyle = "rgba(255, 195, 225, .55)";
      ctx.lineWidth = 1 / Math.max(scale, 0.001);
      ctx.strokeRect(-sourceW / 2, -sourceH / 2, sourceW, sourceH);
    }
    ctx.restore();
  }

  drawPart(partName, x, y, width, height, alpha = 1) {
    const part = this.parts[partName];
    if (!part || alpha <= 0.001) return;
    this.ctx.save();
    this.ctx.globalAlpha = clamp(alpha);
    this.ctx.drawImage(part, x, y, width, height);
    this.ctx.restore();
  }

  drawEyeSystem(emotionId, source, params, alpha) {
    const eyeOpen = clamp(params.ParamEyeLOpen);
    if (source === "stand") {
      // The original stand remains visible underneath; these crops only blend
      // the open/closed eye states and preserve the supplied pixels.
      this.drawPart("eyeOpenL", -48, -43, 36, 35, eyeOpen * alpha);
      this.drawPart("eyeOpenR", 13, -43, 36, 35, eyeOpen * alpha);
    } else if (source === "haku") {
      const closed = (1 - this.blinkLevel) * alpha;
      this.drawPart("eyeClosedL", -52, -41, 39, 28, closed);
      this.drawPart("eyeClosedR", 18, -41, 39, 28, closed);
    }
  }

  drawMouthSystem(emotionId, source, params, alpha) {
    const open = clamp(params.ParamMouthOpenY);
    if (open < 0.035) return;
    if (!["stand", "peace", "uruuru"].includes(source)) return;
    const key = this.viseme === "CLOSED" ? (open > 0.62 ? "mouthWide" : "mouthA") : (VISEMES[this.viseme]?.mouthPart || "mouthA");
    // Crop boxes contain the original mouth at different source coordinates;
    // this target puts their component over the stand face mouth center.
    const pos = source === "uruuru" ? [-14, -24, 42, 38] : [-14, -24, 42, 40];
    this.drawPart(key, pos[0], pos[1], pos[2], pos[3], clamp(open * 1.25) * alpha);
  }

  getSnapshot() {
    return {
      emotion: this.currentEmotion,
      transition: this.transition ? { from: this.transition.from, to: this.transition.to } : null,
      mouthOpen: this.mouthOpen,
      viseme: this.viseme,
      blinkLevel: this.blinkLevel,
      breath: this.breathValue,
      fps: this.fps,
      parameters: this.parameters,
    };
  }
}

export async function createAvatar(canvas, presets = FALLBACK_PRESETS) {
  const avatar = new AvatarController(canvas, presets);
  await avatar.load();
  avatar.start();
  return avatar;
}

