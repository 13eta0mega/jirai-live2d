import { FALLBACK_PRESETS, PART_FILES, SOURCE_FILES } from "../avatar/data.js";
import { createGrid } from "./grid.js";
import { createLipSyncState } from "../avatar/lipsync.js";
import { createSecondaryMotionState } from "./physics.js";
import { WebGLMeshRenderer } from "./renderer.js";
import { clamp, emptyAudio, loadImage, loadOptional, now } from "./controller-common.js";
import { stateMethods } from "./controller-state.js";
import { renderMethods } from "./controller-render.js";

export class MeshAvatarController {
  constructor(canvas, presets = FALLBACK_PRESETS, options = {}) {
    this.canvas = canvas;
    this.presets = presets;
    this.renderer = new WebGLMeshRenderer(canvas);
    this.grid = createGrid(options.columns || 24, options.rows || 28);
    this.deformed = new Float32Array(this.grid.positions.length);
    this.secondary = createSecondaryMotionState();
    this.images = {};
    this.parts = {};
    this.currentEmotion = "neutral";
    this.currentIntensity = 1;
    this.emotionStartedAt = now();
    this.transition = null;
    this.lastTransitionSample = null;
    this.manualMouth = 0;
    this.mouthTarget = 0;
    this.mouthOpen = 0;
    this.mouthForm = 0;
    this.mouthFormTarget = 0;
    this.viseme = "CLOSED";
    this.previousViseme = "CLOSED";
    this.visemeChangedAt = now();
    this.lipSyncMode = "manual";
    this.lipSyncTest = false;
    this.lipSyncState = createLipSyncState();
    this.audioResult = emptyAudio();
    this.audioFeatures = null;
    this.audioContext = null;
    this.microphoneStream = null;
    this.microphoneSource = null;
    this.analyser = null;
    this.timeData = null;
    this.frequencyData = null;
    this.trackEndedHandlers = new Map();
    this.blinkEnabled = true;
    this.blinkLevel = 1;
    this.blinkStart = -1;
    this.nextBlinkAt = now() + 3000;
    this.breathEnabled = true;
    this.breathValue = 0;
    this.pointerTarget = { x: 0, y: 0 };
    this.pointer = { x: 0, y: 0 };
    this.pointerVelocityX = 0;
    this.lastTime = 0;
    this.started = false;
    this.frameTimes = [];
    this.fps = 0;
    this.parameters = {};
    this.showMesh = false;
    this.onPointerMove = (event) => this.updatePointer(event);
    this.onPointerLeave = () => { this.pointerTarget.x = 0; this.pointerTarget.y = 0; };
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.onWindowResize = () => this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement || canvas);
    } else window.addEventListener("resize", this.onWindowResize);
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
    this.width = width;
    this.height = height;
  }

  updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointerTarget.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    this.pointerTarget.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
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

  stop() { this.started = false; }
}

Object.assign(MeshAvatarController.prototype, stateMethods, renderMethods);

export async function createMeshAvatar(canvas, presets = FALLBACK_PRESETS, options = {}) {
  const avatar = new MeshAvatarController(canvas, presets, options);
  await avatar.load();
  avatar.start();
  return avatar;
}
