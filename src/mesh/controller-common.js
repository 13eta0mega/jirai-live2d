import { EXPRESSION_PARAMS } from "../avatar/data.js";
import { SOURCE_DIMENSIONS } from "./layout.js";
import { lerp } from "./transition.js";

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
export const ease = (t) => t * t * (3 - 2 * t);
export const radians = (degrees) => degrees * Math.PI / 180;
export const now = () => performance.now();
export const QUAD_UVS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
export const QUAD_INDICES = new Uint16Array([0, 2, 1, 1, 2, 3]);
export const emptyAudio = () => ({ rms: 0, low: 0, mid: 0, high: 0, noiseFloor: 0.018, open: 0, weight: 0, viseme: "CLOSED" });

export function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${path}`));
    image.src = path;
  });
}

export async function loadOptional(entries) {
  const results = await Promise.all(entries.map(async ([key, path]) => {
    try { return [key, await loadImage(path)]; }
    catch (error) { console.warn(`[mesh-rig] optional part skipped: ${key}`, error); return null; }
  }));
  return Object.fromEntries(results.filter(Boolean));
}

export function expressionForPreset(preset, intensity) {
  const neutral = EXPRESSION_PARAMS.neutral;
  const target = EXPRESSION_PARAMS[preset?.expression] || neutral;
  const t = clamp(intensity, 0, 1);
  const result = {};
  for (const key of new Set([...Object.keys(neutral), ...Object.keys(target)])) {
    result[key] = lerp(Number(neutral[key]) || 0, Number(target[key]) || 0, t);
  }
  return result;
}

export function blendExpression(fromPreset, fromIntensity, toPreset, toIntensity, progress) {
  const a = expressionForPreset(fromPreset, fromIntensity);
  const b = expressionForPreset(toPreset, toIntensity);
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = lerp(Number(a[key]) || 0, Number(b[key]) || 0, progress);
  }
  return out;
}

export function motionFor(name, seconds, age, intensity) {
  const i = clamp(intensity, 0, 1.5);
  const m = { x: 0, y: 0, rotation: 0, scale: 1, bodyX: 0, bodyZ: 0 };
  switch (name) {
    case "happy_bob": m.y = Math.sin(seconds * 4.2) * 0.018 * i; m.rotation = Math.sin(seconds * 2.1) * 0.8 * i; m.bodyZ = Math.sin(seconds * 2.1) * 1.2 * i; break;
    case "jump_once": { const p = Math.min(1, age / 0.9); const jump = Math.sin(p * Math.PI); m.y = -0.085 * jump * i; m.scale = 1 + 0.028 * jump * i; break; }
    case "pose_forward_hands": m.y = Math.sin(seconds * 1.8) * 0.009 * i; m.bodyZ = Math.sin(seconds * 1.25) * 0.8 * i; break;
    case "pleading_idle": m.y = Math.sin(seconds * 2) * 0.008 * i; m.bodyX = Math.sin(seconds * 1.1) * 0.45 * i; break;
    case "lay_idle": m.x = Math.sin(seconds * 0.65) * 0.012 * i; m.bodyZ = Math.sin(seconds * 1.25) * 0.5 * i; break;
    case "sick_recoil": { const impulse = Math.exp(-Math.min(age, 2) * 2.8) * Math.sin(age * 17); m.x = impulse * 0.04 * i; m.rotation = impulse * 2.2 * i; break; }
    case "angry_tense": m.x = Math.sin(seconds * 20) * 0.006 * i; m.bodyX = Math.sin(seconds * 16) * 1.1 * i; break;
    case "annoyed_shift": m.x = Math.sin(seconds * 0.95) * 0.016 * i; m.rotation = Math.sin(seconds * 0.8) * 0.7 * i; break;
    case "sad_sink": m.y = 0.018 * i + Math.sin(seconds * 1.15) * 0.005 * i; m.bodyZ = Math.sin(seconds * 0.7) * 0.6 * i; break;
    case "startle": { const impulse = Math.exp(-Math.min(age, 1.5) * 5); m.y = -0.06 * impulse * i; m.scale = 1 + 0.035 * impulse * i; break; }
    case "shy_shift": m.x = Math.sin(seconds * 1.2) * 0.012 * i; m.rotation = Math.sin(seconds * 1.05) * 0.75 * i; break;
    case "scared_shiver": m.x = Math.sin(seconds * 25) * 0.012 * i; m.y = Math.cos(seconds * 22) * 0.005 * i; m.bodyZ = Math.sin(seconds * 19) * 1.5 * i; break;
    case "smug_hold": m.y = Math.sin(seconds * 1.35) * 0.007 * i; m.rotation = 0.4 * i; break;
    case "confused_tilt": m.rotation = Math.sin(seconds * 1.3) * 1.4 * i; m.bodyZ = Math.sin(seconds * 0.8) * 0.7 * i; break;
    case "love_bob": m.y = Math.sin(seconds * 3.2) * 0.018 * i; m.scale = 1.012 + Math.sin(seconds * 3.2) * 0.008 * i; break;
    default: m.y = Math.sin(seconds * 1.3) * 0.004 * i; m.bodyZ = Math.sin(seconds * 0.58) * 0.35 * i; break;
  }
  return m;
}

export function sourceSize(source, image) {
  return [image?.naturalWidth || SOURCE_DIMENSIONS[source]?.[0] || 1, image?.naturalHeight || SOURCE_DIMENSIONS[source]?.[1] || 1];
}
