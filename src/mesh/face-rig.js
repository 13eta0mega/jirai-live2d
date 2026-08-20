import { FACE_LAYOUTS, SOURCE_DIMENSIONS, rectToNormalized } from './layout.js';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => {
  if (a === b) return v < a ? 0 : 1;
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const EMOTION_FACE_PROFILES = {
  neutral:     { mouthScale: [1.00, 1.00], mouthShift: [0, 0], browStrength: 0.00, eyeScale: [1.00, 1.02] },
  happy:       { mouthScale: [1.13, 0.96], mouthShift: [0, 1], browStrength: 0.08, eyeScale: [1.00, 1.00] },
  excited:     { mouthScale: [1.18, 1.06], mouthShift: [0, 2], browStrength: 0.18, eyeScale: [1.00, 1.00] },
  teasing:     { mouthScale: [1.04, 0.86], mouthShift: [1, 0], browStrength: 0.10, eyeScale: [0.98, 0.96] },
  pleading:    { mouthScale: [0.90, 0.84], mouthShift: [0, 1], browStrength: 0.28, eyeScale: [1.00, 1.00] },
  relaxed:     { mouthScale: [0.90, 0.76], mouthShift: [0, 0], browStrength: 0.00, eyeScale: [1.00, 1.00] },
  sick:        { mouthScale: [0.92, 1.00], mouthShift: [0, 2], browStrength: -0.18, eyeScale: [0.96, 0.92] },
  angry:       { mouthScale: [0.88, 0.78], mouthShift: [0, 1], browStrength: -0.78, eyeScale: [1.02, 0.74] },
  annoyed:     { mouthScale: [0.88, 0.76], mouthShift: [1, 0], browStrength: -0.28, eyeScale: [1.00, 0.80] },
  sad:         { mouthScale: [0.88, 0.82], mouthShift: [0, 2], browStrength: 0.52, eyeScale: [1.00, 1.00] },
  surprised:   { mouthScale: [0.84, 1.18], mouthShift: [0, 2], browStrength: 0.70, eyeScale: [1.04, 1.16] },
  embarrassed: { mouthScale: [0.92, 0.82], mouthShift: [-1, 1], browStrength: 0.14, eyeScale: [0.98, 0.92] },
  scared:      { mouthScale: [0.88, 1.12], mouthShift: [0, 2], browStrength: 0.48, eyeScale: [1.00, 1.00] },
  smug:        { mouthScale: [1.02, 0.82], mouthShift: [1, 0], browStrength: -0.05, eyeScale: [0.98, 0.94] },
  confused:    { mouthScale: [0.90, 0.86], mouthShift: [1, 1], browStrength: 0.34, eyeScale: [1.00, 1.04] },
  love:        { mouthScale: [1.16, 1.02], mouthShift: [0, 1], browStrength: 0.14, eyeScale: [1.00, 1.00] },
};

export const VISEME_RECT_PROFILES = {
  CLOSED: { scale: [1.00, 1.00], shift: [0, 0] },
  A:      { scale: [1.00, 1.02], shift: [0, 1] },
  I:      { scale: [0.94, 0.74], shift: [0, 0] },
  U:      { scale: [0.80, 0.92], shift: [0, 1] },
  E:      { scale: [1.00, 0.80], shift: [0, 0] },
  O:      { scale: [0.82, 1.16], shift: [0, 1] },
};

export const MOUTH_SAFE_BOUNDS = {
  stand:   [-32, -27, 32, 17],
  peace:   [-34, -29, 34, 21],
  jump:    [-38, -7, 38, 54],
  uruuru:  [-31, -13, 31, 28],
  haku:    [-33, -12, 33, 38],
  gorogoro:[-30, 20, 32, 58],
};

function scaleRectAroundCenter(rect, sx = 1, sy = 1, dx = 0, dy = 0) {
  if (!rect) return null;
  const [x, y, w, h] = rect;
  const cx = x + w * 0.5 + dx;
  const cy = y + h * 0.5 + dy;
  const nw = Math.max(1, w * sx);
  const nh = Math.max(1, h * sy);
  return [cx - nw * 0.5, cy - nh * 0.5, nw, nh];
}

export function fitRectToBounds(rect, bounds) {
  if (!rect || !bounds) return rect ? [...rect] : null;
  let [x, y, w, h] = rect;
  const [minX, minY, maxX, maxY] = bounds;
  const maxW = Math.max(1, maxX - minX);
  const maxH = Math.max(1, maxY - minY);
  const scale = Math.min(1, maxW / Math.max(1, w), maxH / Math.max(1, h));
  w *= scale; h *= scale;
  x = Math.min(maxX - w, Math.max(minX, x));
  y = Math.min(maxY - h, Math.max(minY, y));
  return [x, y, w, h];
}

export function resolveMouthRect(source, emotion = 'neutral', viseme = 'CLOSED', open = 0) {
  const base = FACE_LAYOUTS[source]?.mouth;
  if (!base) return null;
  const emotionProfile = EMOTION_FACE_PROFILES[emotion] || EMOTION_FACE_PROFILES.neutral;
  const visemeProfile = VISEME_RECT_PROFILES[viseme] || VISEME_RECT_PROFILES.CLOSED;
  const lipWeight = clamp(open * 1.15);
  const vsx = lerp(1, visemeProfile.scale[0], lipWeight);
  const vsy = lerp(1, visemeProfile.scale[1], lipWeight);
  const vdx = visemeProfile.shift[0] * lipWeight;
  const vdy = visemeProfile.shift[1] * lipWeight;
  const rect = scaleRectAroundCenter(
    base,
    emotionProfile.mouthScale[0] * vsx,
    emotionProfile.mouthScale[1] * vsy,
    emotionProfile.mouthShift[0] + vdx,
    emotionProfile.mouthShift[1] + vdy,
  );
  return fitRectToBounds(rect, MOUTH_SAFE_BOUNDS[source]);
}

export function resolveEyeRects(source, emotion = 'neutral') {
  const layout = FACE_LAYOUTS[source];
  if (!layout) return { leftEye: null, rightEye: null };
  const profile = EMOTION_FACE_PROFILES[emotion] || EMOTION_FACE_PROFILES.neutral;
  const strength = clamp(Math.abs(profile.browStrength), 0, 1);
  const squeeze = ['happy', 'excited', 'love', 'relaxed', 'smug', 'teasing'].includes(emotion)
    ? lerp(1, 0.90, Math.min(1, strength + 0.35))
    : 1;
  const sx = Number(profile.eyeScale?.[0]) || 1;
  const sy = (Number(profile.eyeScale?.[1]) || 1) * squeeze;
  return {
    leftEye: scaleRectAroundCenter(layout.leftEye, sx, sy),
    rightEye: scaleRectAroundCenter(layout.rightEye, sx, sy),
  };
}

export function resolveBrowRects(source, emotion = 'neutral') {
  const eyes = resolveEyeRects(source, emotion);
  const make = (rect) => {
    if (!rect) return null;
    const [x, y, w] = rect;
    return [x + w * 0.08, y - 7, w * 0.84, 5.5];
  };
  return { leftBrow: make(eyes.leftEye), rightBrow: make(eyes.rightEye) };
}


export const EMOTION_EYE_MODES = {
  neutral: 'open', happy: 'closed', excited: 'closed', teasing: 'wink',
  pleading: 'uruuru', relaxed: 'closed', sick: 'open', angry: 'open',
  annoyed: 'open', sad: 'uruuru', surprised: 'open', embarrassed: 'open',
  scared: 'uruuru', smug: 'wink', confused: 'open', love: 'closed',
};

export function eyeModeForEmotion(emotion = 'neutral') {
  return EMOTION_EYE_MODES[emotion] || 'open';
}

export function eyePartsForEmotion(emotion = 'neutral') {
  const mode = eyeModeForEmotion(emotion);
  if (mode === 'uruuru') return { mode, left: 'eyeUruuruL', right: 'eyeUruuruR' };
  if (mode === 'open') return { mode, left: 'eyeOpenL', right: 'eyeOpenR' };
  if (mode === 'closed') return { mode, left: 'eyeClosedL', right: 'eyeClosedR' };
  if (mode === 'wink') return { mode, left: 'eyeOpenL', right: 'eyeWinkR' };
  return { mode: 'open', left: 'eyeOpenL', right: 'eyeOpenR' };
}

export function browAngles(emotion = 'neutral', expression = {}) {
  const profile = EMOTION_FACE_PROFILES[emotion] || EMOTION_FACE_PROFILES.neutral;
  const left = Number(expression.browL ?? profile.browStrength) || 0;
  const right = Number(expression.browR ?? profile.browStrength) || 0;
  return {
    left: -left * 18,
    right: right * 18,
  };
}

export function expressionTimeline(rawProgress = 0, sourceChanges = false) {
  const p = clamp(rawProgress);
  const brows = smoothstep(0.04, 0.58, p);
  const eyes = smoothstep(0.10, 0.72, p);
  const mouth = smoothstep(0.16, 0.82, p);
  const cheeks = smoothstep(0.20, 0.88, p);
  const handoffBlink = sourceChanges
    ? Math.sin(Math.PI * smoothstep(0.34, 0.66, p)) * (1 - smoothstep(0.66, 0.76, p))
    : 0;
  return { brows, eyes, mouth, cheeks, handoffBlink: clamp(handoffBlink) };
}

export function mouthPartForEmotion(source, emotion, viseme, open) {
  if (viseme === 'CLOSED' || open < 0.05) {
    if (['happy', 'teasing', 'embarrassed', 'smug', 'love'].includes(emotion)) return 'mouthSmall';
    if (['pleading', 'sad'].includes(emotion) || source === 'uruuru') return 'mouthUruuru';
    return 'mouthClosed';
  }
  if (['happy', 'excited', 'love'].includes(emotion) && ['A', 'E', 'O'].includes(viseme)) return 'mouthWide';
  if (['surprised', 'scared'].includes(emotion) && ['A', 'O'].includes(viseme)) return 'mouthWide';
  if (['angry', 'annoyed'].includes(emotion) && viseme === 'O') return 'mouthA';
  if (viseme === 'I' || viseme === 'E') return 'mouthSmall';
  if (viseme === 'O') return 'mouthWide';
  return 'mouthA';
}

export function mouthRectNormalized(source, emotion, viseme, open) {
  const rect = resolveMouthRect(source, emotion, viseme, open);
  const size = SOURCE_DIMENSIONS[source];
  return rect && size ? rectToNormalized(rect, size[0], size[1]) : null;
}

export const SOURCE_FACE_ROTATION = {
  stand: 0,
  jump: 0,
  peace: 0,
  uruuru: 0,
  haku: 0,
  gorogoro: 27,
};

export function sourceFaceRotation(source) {
  return Number(SOURCE_FACE_ROTATION[source]) || 0;
}