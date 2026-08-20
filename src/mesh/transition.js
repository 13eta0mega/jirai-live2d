const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
export const smootherstep01 = (value) => {
  const t = clamp(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function blendPose(fromPose = {}, toPose = {}, t = 0) {
  const p = smootherstep01(t);
  return {
    x: lerp(Number(fromPose.x) || 0, Number(toPose.x) || 0, p),
    y: lerp(Number(fromPose.y) || 0, Number(toPose.y) || 0, p),
    rotation: lerp(Number(fromPose.rotation) || 0, Number(toPose.rotation) || 0, p),
    scale: lerp(Number(fromPose.scale) || 1, Number(toPose.scale) || 1, p),
  };
}

export function blendMotion(fromMotion = {}, toMotion = {}, t = 0) {
  const p = smootherstep01(t);
  const keys = ["x", "y", "rotation", "scale", "bodyX", "bodyZ"];
  const out = {};
  for (const key of keys) {
    const fallback = key === "scale" ? 1 : 0;
    out[key] = lerp(Number(fromMotion[key] ?? fallback), Number(toMotion[key] ?? fallback), p);
  }
  return out;
}

export function chooseTransitionMotion(fromPreset = {}, toPreset = {}) {
  const fromSource = fromPreset.source;
  const toSource = toPreset.source;
  if (fromSource === "jump" || toSource === "jump") return "jump_settle";
  if (fromSource === "gorogoro" || toSource === "gorogoro") return "lay_transition";
  if (fromSource === "haku" || toSource === "haku") {
    return toPreset.transitionMotion === "sick_transition" || fromPreset.transitionMotion === "sick_transition"
      ? "sick_transition" : "quick_react";
  }
  const requested = toPreset.transitionMotion || fromPreset.transitionMotion || "face_blend";
  return requested;
}

export function sampleTransition(fromPreset = {}, toPreset = {}, rawProgress = 0) {
  const raw = clamp(rawProgress);
  const progress = smootherstep01(raw);
  const sameSource = fromPreset.source === toPreset.source;
  const motion = chooseTransitionMotion(fromPreset, toPreset);
  const phase = Math.sin(Math.PI * progress);
  const sourceMix = sameSource ? 0 : smoothstep(0.28, 0.72, progress);
  const warp = {
    armLift: 0,
    armSpread: 0,
    bodyLift: 0,
    bodySquash: 0,
    lean: 0,
    headLift: 0,
    scalePulse: 0,
  };

  if (motion === "jump_settle") {
    const direction = toPreset.source === "jump" ? 1 : fromPreset.source === "jump" ? -1 : 1;
    const anticipation = Math.sin(Math.PI * smoothstep(0, 0.36, progress)) * (1 - smoothstep(0.34, 0.56, progress));
    warp.armLift = direction * 0.24 * phase;
    warp.armSpread = direction * 0.10 * phase;
    warp.bodyLift = direction * -0.075 * phase + 0.018 * anticipation;
    warp.bodySquash = 0.045 * anticipation - 0.025 * phase;
    warp.headLift = direction * -0.025 * phase;
    warp.scalePulse = 0.035 * phase;
  } else if (motion === "limb_blend") {
    const direction = toPreset.source === "stand" ? -1 : 1;
    warp.armLift = direction * 0.105 * phase;
    warp.armSpread = direction * 0.075 * phase;
    warp.bodyLift = -0.02 * phase;
    warp.lean = direction * 0.018 * phase;
    warp.scalePulse = 0.012 * phase;
  } else if (motion === "lay_transition") {
    const direction = toPreset.source === "gorogoro" ? 1 : -1;
    warp.bodyLift = direction * 0.075 * phase;
    warp.bodySquash = 0.04 * phase;
    warp.lean = direction * 0.11 * phase;
    warp.headLift = direction * 0.035 * phase;
  } else if (motion === "quick_react" || motion === "sick_transition") {
    const direction = toPreset.source === "haku" ? 1 : -1;
    warp.bodyLift = direction * -0.045 * phase;
    warp.armSpread = direction * 0.045 * phase;
    warp.bodySquash = -0.025 * phase;
    warp.lean = direction * -0.035 * phase;
    warp.scalePulse = 0.025 * phase;
  }

  return { raw, progress, sourceMix, sameSource, motion, phase, warp };
}
