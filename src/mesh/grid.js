const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export function createGrid(columns = 24, rows = 28) {
  const cols = Math.max(2, Math.floor(columns));
  const rws = Math.max(2, Math.floor(rows));
  const count = (cols + 1) * (rws + 1);
  const positions = new Float32Array(count * 2);
  const uvs = new Float32Array(count * 2);
  let p = 0;
  for (let y = 0; y <= rws; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      const u = x / cols; const v = y / rws;
      positions[p] = u * 2 - 1; uvs[p++] = u;
      positions[p] = v * 2 - 1; uvs[p++] = v;
    }
  }
  const triangles = new Uint16Array(cols * rws * 6);
  const lines = new Uint16Array((cols * (rws + 1) + rws * (cols + 1)) * 2);
  let ti = 0; let li = 0; const stride = cols + 1;
  for (let y = 0; y < rws; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const a = y * stride + x; const b = a + 1; const c = a + stride; const d = c + 1;
      triangles[ti++] = a; triangles[ti++] = c; triangles[ti++] = b;
      triangles[ti++] = b; triangles[ti++] = c; triangles[ti++] = d;
    }
  }
  for (let y = 0; y <= rws; y += 1) for (let x = 0; x < cols; x += 1) { const a = y * stride + x; lines[li++] = a; lines[li++] = a + 1; }
  for (let x = 0; x <= cols; x += 1) for (let y = 0; y < rws; y += 1) { const a = y * stride + x; lines[li++] = a; lines[li++] = a + stride; }
  return { columns: cols, rows: rws, positions, uvs, triangles, lines };
}

export function deformPoint(x, y, parameters = {}, secondary = {}, transitionWarp = {}) {
  const angleX = clamp(parameters.ParamAngleX, -30, 30) / 30;
  const angleY = clamp(parameters.ParamAngleY, -30, 30) / 30;
  const angleZ = clamp(parameters.ParamAngleZ, -30, 30) * Math.PI / 180;
  const bodyX = clamp(parameters.ParamBodyAngleX, -10, 10) / 10;
  const bodyZ = clamp(parameters.ParamBodyAngleZ, -10, 10) / 10;
  const breath = clamp(parameters.ParamBreath, 0, 1);
  const mouthOpen = clamp(parameters.ParamMouthOpenY, 0, 1);
  const mouthForm = clamp(parameters.ParamMouthForm, -1, 1);
  const cheek = clamp(parameters.ParamCheek, 0, 1);
  const head = 1 - smoothstep(-0.18, 0.46, y);
  const torso = smoothstep(-0.26, 0.55, y) * (1 - smoothstep(0.7, 1.02, y));
  const lower = smoothstep(0.25, 0.98, y);
  const leftSide = smoothstep(0.12, 0.92, -x) * (1 - smoothstep(0.5, 1, y));
  const rightSide = smoothstep(0.12, 0.92, x) * (1 - smoothstep(0.5, 1, y));
  const faceCore = (1 - smoothstep(0.34, 0.72, Math.abs(x))) * (1 - smoothstep(0.12, 0.58, Math.abs(y + 0.18)));
  const mouthZone = (1 - smoothstep(0.08, 0.42, Math.abs(x))) * (1 - smoothstep(0.035, 0.24, Math.abs(y + 0.12)));
  const armSide = smoothstep(0.28, 0.58, Math.abs(x));
  const armTop = smoothstep(-0.48, -0.12, y);
  const armBottom = 1 - smoothstep(0.54, 0.82, y);
  const armMask = armSide * armTop * armBottom;
  const upperBody = 1 - smoothstep(0.55, 0.96, y);
  let px = x; let py = y;
  px += angleX * 0.105 * head * (1 - Math.abs(x) * 0.28);
  py -= angleY * 0.052 * head * (1 - Math.abs(x) * 0.18);
  const headPivotY = -0.32; const hx = px; const hy = py - headPivotY; const rotation = angleZ * 0.42 * head; const cos = Math.cos(rotation); const sin = Math.sin(rotation);
  px = hx * cos - hy * sin; py = hx * sin + hy * cos + headPivotY;
  px += bodyX * 0.04 * torso * (0.35 + (y + 1) * 0.45);
  px += bodyZ * 0.03 * torso * (y + 0.15);
  px *= 1 + breath * 0.018 * torso; py -= breath * 0.013 * torso;
  px *= 1 + cheek * 0.008 * faceCore; px += x * mouthForm * 0.022 * mouthZone; py += mouthOpen * 0.018 * mouthZone;
  const leftTail = Number(secondary.leftTail?.value ?? secondary.leftTail ?? 0) || 0;
  const rightTail = Number(secondary.rightTail?.value ?? secondary.rightTail ?? 0) || 0;
  const skirt = Number(secondary.skirt?.value ?? secondary.skirt ?? 0) || 0;
  const bodyLag = Number(secondary.bodyLag?.value ?? secondary.bodyLag ?? 0) || 0;
  px += leftTail * 0.052 * leftSide * (0.55 + (1 - y) * 0.22); py += Math.abs(leftTail) * 0.008 * leftSide;
  px += rightTail * 0.052 * rightSide * (0.55 + (1 - y) * 0.22); py += Math.abs(rightTail) * 0.008 * rightSide;
  px += skirt * 0.034 * lower * (0.45 + Math.abs(x) * 0.55); px += bodyLag * 0.026 * torso;
  const armLift = Number(transitionWarp.armLift) || 0; const armSpread = Number(transitionWarp.armSpread) || 0;
  const bodyLift = Number(transitionWarp.bodyLift) || 0; const bodySquash = Number(transitionWarp.bodySquash) || 0;
  const lean = Number(transitionWarp.lean) || 0; const headLift = Number(transitionWarp.headLift) || 0;
  px += Math.sign(x || 1) * armSpread * armMask; py -= armLift * armMask * (0.62 + Math.abs(x) * 0.45);
  py += bodyLift * upperBody; py += headLift * head; px += lean * torso * (y + 0.22); py = -0.10 + (py + 0.10) * (1 + bodySquash * torso);
  return [px, py];
}

export function deformGrid(basePositions, parameters, secondary, out = null, transitionWarp = {}) {
  const result = out && out.length === basePositions.length ? out : new Float32Array(basePositions.length);
  for (let i = 0; i < basePositions.length; i += 2) {
    const [x, y] = deformPoint(basePositions[i], basePositions[i + 1], parameters, secondary, transitionWarp);
    result[i] = x; result[i + 1] = y;
  }
  return result;
}

function transformLocalPoint(x, y, rect, localTransform = {}) {
  const [rx, ry, rw, rh] = rect;
  const cx = rx + rw * 0.5; const cy = ry + rh * 0.5;
  const sx = Number(localTransform.scale?.[0] ?? 1) || 1; const sy = Number(localTransform.scale?.[1] ?? 1) || 1;
  const ox = Number(localTransform.offset?.[0]) || 0; const oy = Number(localTransform.offset?.[1]) || 0;
  const rotation = Number(localTransform.rotation) || 0; const c = Math.cos(rotation); const s = Math.sin(rotation);
  const dx = (x - cx) * sx; const dy = (y - cy) * sy;
  return [cx + dx * c - dy * s + ox, cy + dx * s + dy * c + oy];
}

export function createDeformedQuad(rect, sourceWidth, sourceHeight, parameters, secondary, transitionWarp = {}, localTransform = {}) {
  const [x, y, width, height] = rect;
  return createDeformedQuadNormalized([(x / sourceWidth) * 2, (y / sourceHeight) * 2, (width / sourceWidth) * 2, (height / sourceHeight) * 2], parameters, secondary, transitionWarp, localTransform);
}

export function createDeformedQuadNormalized(rect, parameters, secondary, transitionWarp = {}, localTransform = {}) {
  const [x, y, width, height] = rect;
  const raw = [[x,y],[x+width,y],[x,y+height],[x+width,y+height]];
  const corners = raw.map(([px,py]) => {
    const [lx,ly] = transformLocalPoint(px,py,rect,localTransform);
    return deformPoint(lx,ly,parameters,secondary,transitionWarp);
  });
  return new Float32Array(corners.flat());
}