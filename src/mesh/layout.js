export const SOURCE_DIMENSIONS = {
  stand: [259, 270],
  jump: [300, 273],
  peace: [259, 270],
  uruuru: [270, 246],
  gorogoro: [270, 246],
  haku: [250, 246],
};

// Rectangles are centered source-space coordinates: x/y are offsets from source center.
export const FACE_LAYOUTS = {
  stand: { leftEye: [-39.5, -32, 27, 20], rightEye: [15.5, -32, 27, 20], mouth: [-17.5, -19, 33, 25] },
  peace: { leftEye: [-39.5, -32, 27, 20], rightEye: [17.5, -32, 27, 20], mouth: [-19.5, -20, 32, 30] },
  jump: { leftEye: [-43, -29, 31, 25], rightEye: [14, -29, 31, 25], mouth: [-24, 3.5, 44, 40] },
  uruuru: { leftEye: [-57, -31, 41, 45], rightEye: [16, -31, 41, 45], mouth: [-17, -3, 31, 21] },
  haku: { leftEye: [-55, -27, 34, 35], rightEye: [-3, -27, 32, 35], mouth: [-18, -2, 35, 29] },
};

export function rectToNormalized(rect, sourceWidth, sourceHeight) {
  if (!rect || !sourceWidth || !sourceHeight) return null;
  const [x, y, width, height] = rect;
  return [
    (x / sourceWidth) * 2,
    (y / sourceHeight) * 2,
    (width / sourceWidth) * 2,
    (height / sourceHeight) * 2,
  ];
}

export function normalizedToRect(rect, sourceWidth, sourceHeight) {
  if (!rect || !sourceWidth || !sourceHeight) return null;
  const [x, y, width, height] = rect;
  return [
    x * sourceWidth * 0.5,
    y * sourceHeight * 0.5,
    width * sourceWidth * 0.5,
    height * sourceHeight * 0.5,
  ];
}

export function blendNormalizedRect(fromRect, fromSize, toRect, toSize, t) {
  if (!fromRect && !toRect) return null;
  if (!fromRect) return rectToNormalized(toRect, toSize[0], toSize[1]);
  if (!toRect) return rectToNormalized(fromRect, fromSize[0], fromSize[1]);
  const a = rectToNormalized(fromRect, fromSize[0], fromSize[1]);
  const b = rectToNormalized(toRect, toSize[0], toSize[1]);
  const p = Math.max(0, Math.min(1, Number(t) || 0));
  return a.map((value, index) => value + (b[index] - value) * p);
}
