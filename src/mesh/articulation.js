const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const degToRad = (degrees) => degrees * Math.PI / 180;

// UV masks are intentionally conservative: only pixels outside the torso core are cut out.
// This keeps shoulder seams covered by the base body while still making the arm silhouette articulate.
export const SOURCE_ARM_RIGS = {
  stand: { order: 'behind',
    left: {
      pivot: [-0.31, 0.12], nativeAngle: 140,
      mask: [[0.14,0.52],[0.28,0.50],[0.39,0.58],[0.36,0.74],[0.25,0.81],[0.14,0.72],[0.10,0.61]],
    },
    right: {
      pivot: [0.31, 0.12], nativeAngle: 40,
      mask: [[0.86,0.52],[0.72,0.50],[0.61,0.58],[0.64,0.74],[0.75,0.81],[0.86,0.72],[0.90,0.61]],
    },
  },
  jump: { order: 'behind',
    left: {
      pivot: [-0.23, 0.16], nativeAngle: -150,
      mask: [[0.08,0.44],[0.27,0.42],[0.42,0.57],[0.37,0.70],[0.23,0.66],[0.11,0.58]],
    },
    right: {
      pivot: [0.23, 0.16], nativeAngle: -30,
      mask: [[0.92,0.44],[0.73,0.42],[0.58,0.57],[0.63,0.70],[0.77,0.66],[0.89,0.58]],
    },
  },
  peace: { order: 'front',
    left: {
      pivot: [-0.29, 0.13], nativeAngle: 152,
      mask: [[0.16,0.52],[0.31,0.50],[0.43,0.60],[0.39,0.76],[0.26,0.82],[0.15,0.72]],
    },
    right: {
      pivot: [0.29, 0.13], nativeAngle: 28,
      mask: [[0.84,0.52],[0.69,0.50],[0.57,0.60],[0.61,0.76],[0.74,0.82],[0.85,0.72]],
    },
  },
};


export const SOURCE_ARM_POSES = {
  stand: { left: 140, right: 40 },
  jump: { left: -150, right: -30 },
  peace: { left: 152, right: 28 },
  uruuru: { left: 108, right: 72 },
  haku: { left: 126, right: 54 },
  gorogoro: { left: 172, right: 8 },
};

export const EMOTION_ARM_OFFSETS = {
  neutral:     { left: 0, right: 0 },
  happy:       { left: 8, right: -8 },
  excited:     { left: -8, right: 8 },
  teasing:     { left: -4, right: 4 },
  pleading:    { left: 0, right: 0 },
  relaxed:     { left: 0, right: 0 },
  sick:        { left: 0, right: 0 },
  angry:       { left: -12, right: 12 },
  annoyed:     { left: -4, right: 7 },
  sad:         { left: 0, right: 0 },
  surprised:   { left: 0, right: 0 },
  embarrassed: { left: -7, right: 7 },
  scared:      { left: 0, right: 0 },
  smug:        { left: 3, right: -3 },
  confused:    { left: -16, right: -2 },
  love:        { left: -5, right: 5 },
};

export function hasArticulatedArms(source) {
  return Boolean(SOURCE_ARM_RIGS[source]?.left && SOURCE_ARM_RIGS[source]?.right);
}

export function normalizeDegrees(value) {
  let angle = Number(value) || 0;
  while (angle > 180) angle -= 360;
  while (angle <= -180) angle += 360;
  return angle;
}

export function lerpAngleDegrees(a, b, t) {
  const start = normalizeDegrees(a);
  const delta = normalizeDegrees((Number(b) || 0) - start);
  const q = Math.max(-0.12, Math.min(1.12, Number(t) || 0));
  return normalizeDegrees(start + delta * q);
}

export function armNativeAngle(source, side) {
  return Number(SOURCE_ARM_POSES[source]?.[side] ?? SOURCE_ARM_RIGS[source]?.[side]?.nativeAngle) || 0;
}

export function armEmotionAngle(source, emotion, side) {
  const offset = Number(EMOTION_ARM_OFFSETS[emotion]?.[side]) || 0;
  return normalizeDegrees(armNativeAngle(source, side) + offset);
}

function motionProgress(rawProgress) {
  const p = clamp(rawProgress);
  if (p < 0.12) {
    // Anticipation: move slightly opposite before the main sweep.
    const q = p / 0.12;
    return -0.035 * (q * q * (3 - 2 * q));
  }
  if (p < 0.78) {
    const q = (p - 0.12) / 0.66;
    const s = q * q * (3 - 2 * q);
    return -0.035 + (1.055 * s);
  }
  const q = (p - 0.78) / 0.22;
  // Small overshoot that settles exactly on 1.
  return 1 + Math.sin(Math.PI * q) * 0.035 * (1 - q);
}

export function armTransitionPose(fromSource, fromEmotion, toSource, toEmotion, rawProgress = 0) {
  const p = clamp(rawProgress);
  const armT = motionProgress(p);
  const sameSource = fromSource === toSource;
  const result = { progress: p, armProgress: armT, sourceMix: sameSource ? 0 : (hasArticulatedArms(fromSource) || hasArticulatedArms(toSource) ? clamp((p - 0.44) / 0.12) : p) };
  for (const side of ['left', 'right']) {
    const fromWorld = armEmotionAngle(fromSource, fromEmotion, side);
    const toWorld = armEmotionAngle(toSource, toEmotion, side);
    const worldAngle = lerpAngleDegrees(fromWorld, toWorld, armT);
    result[side] = {
      worldAngle,
      fromRotation: degToRad(normalizeDegrees(worldAngle - armNativeAngle(fromSource, side))),
      toRotation: degToRad(normalizeDegrees(worldAngle - armNativeAngle(toSource, side))),
      fromPivot: SOURCE_ARM_RIGS[fromSource]?.[side]?.pivot || null,
      toPivot: SOURCE_ARM_RIGS[toSource]?.[side]?.pivot || null,
    };
  }
  return result;
}

export function armStablePose(source, emotion) {
  const result = {};
  for (const side of ['left', 'right']) {
    const worldAngle = armEmotionAngle(source, emotion, side);
    result[side] = {
      worldAngle,
      rotation: degToRad(normalizeDegrees(worldAngle - armNativeAngle(source, side))),
      pivot: SOURCE_ARM_RIGS[source]?.[side]?.pivot || null,
    };
  }
  return result;
}

export function validateArmRigConfig() {
  const errors = [];
  for (const [source, rig] of Object.entries(SOURCE_ARM_RIGS)) {
    for (const side of ['left', 'right']) {
      const arm = rig[side];
      if (!arm?.pivot || arm.pivot.length !== 2) errors.push(`${source}.${side}: pivot missing`);
      for (const [index, point] of (arm?.mask || []).entries()) {
        if (point.length !== 2 || point.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) errors.push(`${source}.${side}.mask[${index}]: invalid UV`);
      }
      if ((arm?.mask || []).length < 3) errors.push(`${source}.${side}: mask needs >=3 points`);
    }
  }
  return errors;
}

export function transformPositionsRigid(positions, pivot, rotation = 0, translation = [0, 0], out = null) {
  const result = out && out.length === positions.length ? out : new Float32Array(positions.length);
  const px = Number(pivot?.[0]) || 0;
  const py = Number(pivot?.[1]) || 0;
  const tx = Number(translation?.[0]) || 0;
  const ty = Number(translation?.[1]) || 0;
  const c = Math.cos(Number(rotation) || 0);
  const s = Math.sin(Number(rotation) || 0);
  for (let i = 0; i < positions.length; i += 2) {
    const x = positions[i] - px;
    const y = positions[i + 1] - py;
    result[i] = px + x * c - y * s + tx;
    result[i + 1] = py + x * s + y * c + ty;
  }
  return result;
}