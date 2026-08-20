const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / Math.max(1e-6, b - a));
  return t * t * (3 - 2 * t);
};

export const GENERATED_REFERENCE_FILES = {
  neutral: 'assets/reference/v0.4/neutral.webp',
  happy: 'assets/reference/v0.4/happy.webp',
  excited: 'assets/reference/v0.4/excited.webp',
  angry: 'assets/reference/v0.4/angry.webp',
  embarrassed: 'assets/reference/v0.4/embarrassed.webp',
  sad: 'assets/reference/v0.4/sad.webp',
  surprised: 'assets/reference/v0.4/surprised.webp',
  scared: 'assets/reference/v0.4/scared.webp',
  teasing: 'assets/reference/v0.4/teasing.webp',
  love: 'assets/reference/v0.4/love.webp',
};

export const GENERATED_REFERENCE_MOUTH_RECTS = {
  neutral: [0.486188, 0.136740, 0.032228, 0.013812],
  happy: [0.469613, 0.129834, 0.050645, 0.027624],
  excited: [0.469613, 0.132597, 0.053407, 0.027624],
  angry: [0.483425, 0.133287, 0.036832, 0.016575],
  embarrassed: [0.473297, 0.142956, 0.050645, 0.016575],
  sad: [0.482505, 0.140884, 0.044199, 0.016575],
  surprised: [0.469613, 0.133287, 0.055249, 0.031077],
  scared: [0.455801, 0.140193, 0.059853, 0.019337],
  teasing: [0.469613, 0.129834, 0.046041, 0.024171],
  love: [0.471455, 0.129834, 0.046041, 0.026243],
};

const VISEME_SHAPE = {
  CLOSED: { scale: [0.82, 0.55], shift: [0, 0] },
  A: { scale: [1.02, 1.05], shift: [0, 0.002] },
  I: { scale: [0.95, 0.60], shift: [0, 0] },
  U: { scale: [0.68, 0.95], shift: [0, 0.0015] },
  E: { scale: [1.02, 0.70], shift: [0, 0] },
  O: { scale: [0.72, 1.10], shift: [0, 0.002] },
};

function scaleRect(rect, sx, sy, dx = 0, dy = 0) {
  const [x, y, w, h] = rect;
  const cx = x + w * 0.5 + dx;
  const cy = y + h * 0.5 + dy;
  const nw = w * sx;
  const nh = h * sy;
  return [cx - nw * 0.5, cy - nh * 0.5, nw, nh];
}

export function hasGeneratedReference(emotion) {
  return Boolean(GENERATED_REFERENCE_FILES[emotion]);
}

export function resolveGeneratedMouthRect(emotion, viseme = 'CLOSED', open = 0) {
  const base = GENERATED_REFERENCE_MOUTH_RECTS[emotion];
  if (!base) return null;
  const shape = VISEME_SHAPE[viseme] || VISEME_SHAPE.CLOSED;
  const weight = clamp01(Math.max(open, viseme === 'CLOSED' ? 0 : 0.72));
  const sx = 1 + (shape.scale[0] - 1) * weight;
  const sy = 1 + (shape.scale[1] - 1) * weight;
  return scaleRect(base, sx, sy, shape.shift[0] * weight, shape.shift[1] * weight);
}

export function hybridReferenceWeights(progress, hasFrom, hasTo) {
  const p = clamp01(progress);
  const from = hasFrom ? 1 - smoothstep(0.08, 0.30, p) : 0;
  const to = hasTo ? smoothstep(0.70, 0.92, p) : 0;
  return { from, to, articulated: clamp01(1 - Math.max(from, to)) };
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height; return canvas;
  }
  return null;
}

export function buildGeneratedMouthCover(image, emotion) {
  const rect = GENERATED_REFERENCE_MOUTH_RECTS[emotion];
  if (!image || !rect) return null;
  const width = image.naturalWidth || image.width || 1;
  const height = image.naturalHeight || image.height || 1;
  const [u, v, rw, rh] = rect;
  const x = Math.max(0, Math.round(u * width));
  const y = Math.max(0, Math.round(v * height));
  const w = Math.max(4, Math.round(rw * width));
  const h = Math.max(4, Math.round(rh * height));
  const padX = Math.max(3, Math.round(w * 0.20));
  const padY = Math.max(3, Math.round(h * 0.40));
  const outW = w + padX * 2;
  const outH = h + padY * 2;
  const canvas = makeCanvas(outW, outH);
  const sample = makeCanvas(width, height);
  if (!canvas || !sample) return null;
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(image, 0, 0, width, height);
  const sx = Math.max(0, x - padX);
  const sy = Math.max(0, y - Math.max(5, h));
  const sw = Math.min(width - sx, outW);
  const sh = Math.max(1, Math.min(height - sy, Math.max(5, h)));
  const data = sctx.getImageData(sx, sy, sw, sh).data;
  const rs = [], gs = [], bs = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (a < 180 || lum < 145 || r < 170 || g < 120 || b < 115 || Math.max(r,g,b)-Math.min(r,g,b) > 115) continue;
    rs.push(r); gs.push(g); bs.push(b);
  }
  const median = (values, fallback) => {
    if (!values.length) return fallback;
    values.sort((a,b) => a-b); return values[Math.floor(values.length / 2)];
  };
  const r = median(rs, 244), g = median(gs, 196), b = median(bs, 190);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, outH);
  grad.addColorStop(0, `rgba(${Math.min(255,r+3)},${Math.min(255,g+3)},${Math.min(255,b+3)},1)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, outW, outH);
  ctx.globalCompositeOperation = 'destination-in';
  const edge = Math.max(2, Math.min(padX, padY));
  const alpha = ctx.createRadialGradient(outW/2,outH/2,Math.max(1,Math.min(outW,outH)/2-edge),outW/2,outH/2,Math.max(outW,outH)/1.35);
  alpha.addColorStop(0,'rgba(255,255,255,1)'); alpha.addColorStop(0.78,'rgba(255,255,255,1)'); alpha.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = alpha; ctx.fillRect(0,0,outW,outH); ctx.globalCompositeOperation = 'source-over';
  return {
    image: canvas,
    rect: [(x - padX) / width, (y - padY) / height, outW / width, outH / height],
  };
}

export function validateGeneratedReferenceConfig() {
  const errors = [];
  for (const emotion of Object.keys(GENERATED_REFERENCE_FILES)) {
    const rect = GENERATED_REFERENCE_MOUTH_RECTS[emotion];
    if (!rect || rect.length !== 4) { errors.push(`${emotion}: mouth rect missing`); continue; }
    const [x,y,w,h] = rect;
    if (![x,y,w,h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x+w > 1 || y+h > 1) errors.push(`${emotion}: invalid mouth rect`);
  }
  return errors;
}
