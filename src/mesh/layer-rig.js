import { SOURCE_ARM_RIGS } from './articulation.js';
import { FACE_LAYOUTS } from './layout.js';

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('Canvas API is required to build articulated sprite layers.');
}

function sourceDimensions(image) {
  return [image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1];
}

function drawMaskPath(ctx, points, width, height) {
  if (!points?.length) return;
  ctx.beginPath();
  points.forEach(([u, v], index) => {
    const x = u * width;
    const y = v * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

function makeMaskedLayer(image, points) {
  const [width, height] = sourceDimensions(image);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = '#fff';
  drawMaskPath(ctx, points, width, height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

function makeBodyWithoutArms(image, rig) {
  const [width, height] = sourceDimensions(image);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  if (!rig) return canvas;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  drawMaskPath(ctx, rig.left?.mask, width, height);
  drawMaskPath(ctx, rig.right?.mask, width, height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

function pivotToPixels(pivot, width, height) {
  if (!pivot) return null;
  return [((Number(pivot[0]) || 0) + 1) * 0.5 * width, ((Number(pivot[1]) || 0) + 1) * 0.5 * height];
}

function makeShoulderLayer(image, pivot, radius = 11) {
  const [width, height] = sourceDimensions(image);
  const center = pivotToPixels(pivot, width, height);
  if (!center) return null;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(center[0], center[1], radius * 1.18, radius, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, 0, 0, width, height);
  ctx.restore();
  return canvas;
}

function centeredRectToAbsolute(rect, width, height) {
  if (!rect) return null;
  return [width * 0.5 + rect[0], height * 0.5 + rect[1], rect[2], rect[3]];
}

function sampleSkinColor(imageCanvas, absRect) {
  const ctx = imageCanvas.getContext('2d');
  const [width, height] = [imageCanvas.width, imageCanvas.height];
  const [x, y, w, h] = absRect;
  const margin = Math.max(4, Math.round(Math.min(w, h) * 0.32));
  const sx = Math.max(0, Math.floor(x - margin));
  const sy = Math.max(0, Math.floor(y - margin));
  const ex = Math.min(width, Math.ceil(x + w + margin));
  const ey = Math.min(height, Math.ceil(y + h + margin));
  const data = ctx.getImageData(sx, sy, Math.max(1, ex - sx), Math.max(1, ey - sy)).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  const localW = Math.max(1, ex - sx);
  for (let py = 0; py < ey - sy; py += 1) {
    for (let px = 0; px < ex - sx; px += 1) {
      const gx = sx + px;
      const gy = sy + py;
      const inside = gx >= x && gx <= x + w && gy >= y && gy <= y + h;
      if (inside) continue;
      const index = (py * localW + px) * 4;
      const alpha = data[index + 3] / 255;
      if (alpha < 0.55) continue;
      const rr = data[index];
      const gg = data[index + 1];
      const bb = data[index + 2];
      const luminance = rr * 0.299 + gg * 0.587 + bb * 0.114;
      const spread = Math.max(rr, gg, bb) - Math.min(rr, gg, bb);
      if (luminance < 118 || spread > 115 || rr < gg * 0.82) continue;
      const wgt = alpha * (luminance / 255);
      r += rr * wgt;
      g += gg * wgt;
      b += bb * wgt;
      weight += wgt;
    }
  }
  if (weight < 1) return [245, 199, 192, 255];
  return [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight), 255];
}

function applyFeatherMask(ctx, width, height) {
  ctx.globalCompositeOperation = 'destination-in';
  const horizontal = ctx.createLinearGradient(0, 0, width, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(0.14, 'rgba(255,255,255,1)');
  horizontal.addColorStop(0.86, 'rgba(255,255,255,1)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, width, height);
  const vertical = ctx.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, 'rgba(255,255,255,0)');
  vertical.addColorStop(0.14, 'rgba(255,255,255,1)');
  vertical.addColorStop(0.86, 'rgba(255,255,255,1)');
  vertical.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function makeFeatureCover(imageCanvas, centeredRect) {
  const [width, height] = [imageCanvas.width, imageCanvas.height];
  const absRect = centeredRectToAbsolute(centeredRect, width, height);
  if (!absRect) return null;
  const [x, y, w, h] = absRect;
  const pad = 3;
  const outW = Math.max(4, Math.ceil(w + pad * 2));
  const outH = Math.max(4, Math.ceil(h + pad * 2));
  const canvas = makeCanvas(outW, outH);
  const ctx = canvas.getContext('2d');
  const [r, g, b, a] = sampleSkinColor(imageCanvas, [x - pad, y - pad, w + pad * 2, h + pad * 2]);
  ctx.clearRect(0, 0, outW, outH);
  const gradient = ctx.createLinearGradient(0, 0, 0, outH);
  gradient.addColorStop(0, `rgba(${Math.min(255, r + 4)},${Math.min(255, g + 3)},${Math.min(255, b + 3)},${a / 255})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},${a / 255})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, outW, outH);
  applyFeatherMask(ctx, outW, outH);
  return canvas;
}

function buildFeatureCovers(image, source) {
  const layout = FACE_LAYOUTS[source];
  if (!layout) return {};
  const [width, height] = sourceDimensions(image);
  const sourceCanvas = makeCanvas(width, height);
  const ctx = sourceCanvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  const browFromEye = (rect) => rect ? [rect[0] + rect[2] * 0.08, rect[1] - 7, rect[2] * 0.84, 5.5] : null;
  return {
    leftEye: makeFeatureCover(sourceCanvas, layout.leftEye),
    rightEye: makeFeatureCover(sourceCanvas, layout.rightEye),
    leftBrow: makeFeatureCover(sourceCanvas, browFromEye(layout.leftEye)),
    rightBrow: makeFeatureCover(sourceCanvas, browFromEye(layout.rightEye)),
    mouth: makeFeatureCover(sourceCanvas, layout.mouth),
  };
}

function trimTransparentPart(image, threshold = 10, padding = 1) {
  if (!image) return image;
  try {
    const [width, height] = sourceDimensions(image);
    const source = makeCanvas(width, height);
    const ctx = source.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] <= threshold) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) return image;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    if (cropW === width && cropH === height) return image;
    const trimmed = makeCanvas(cropW, cropH);
    trimmed.getContext('2d').drawImage(source, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return trimmed;
  } catch {
    return image;
  }
}

export function normalizeOverlayParts(parts = {}) {
  const result = { ...parts };
  for (const [key, image] of Object.entries(parts)) {
    if (/^(eye|mouth)/i.test(key)) result[key] = trimTransparentPart(image, 8, 1);
  }
  return result;
}

export function buildSourceLayers(image, source) {
  const rig = SOURCE_ARM_RIGS[source] || null;
  const body = rig ? makeBodyWithoutArms(image, rig) : image;
  return {
    body,
    leftArm: rig?.left ? makeMaskedLayer(image, rig.left.mask) : null,
    rightArm: rig?.right ? makeMaskedLayer(image, rig.right.mask) : null,
    leftShoulder: rig?.left ? makeShoulderLayer(image, rig.left.pivot, 11) : null,
    rightShoulder: rig?.right ? makeShoulderLayer(image, rig.right.pivot, 11) : null,
    covers: buildFeatureCovers(image, source),
    articulated: Boolean(rig),
  };
}

export function createProceduralFaceParts() {
  const brow = makeCanvas(64, 16);
  const ctx = brow.getContext('2d');
  ctx.clearRect(0, 0, 64, 16);
  ctx.strokeStyle = 'rgba(58, 26, 35, 0.96)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.quadraticCurveTo(32, 5.5, 56, 8);
  ctx.stroke();
  return { brow };
}