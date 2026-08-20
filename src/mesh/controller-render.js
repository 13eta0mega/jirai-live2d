import { FALLBACK_PRESETS } from '../avatar/data.js';
import { clamp01 } from '../avatar/lipsync.js';
import { createDeformedQuad, createDeformedQuadNormalized, deformGrid, deformPoint } from './grid.js';
import { FACE_LAYOUTS, blendNormalizedRect, rectToNormalized } from './layout.js';
import { blendMotion, blendPose, lerp } from './transition.js';
import { QUAD_INDICES, QUAD_UVS, expressionForPreset, motionFor, now, radians, sourceSize } from './controller-common.js';
import {
  browAngles, expressionTimeline, eyePartsForEmotion, mouthPartForEmotion, resolveBrowRects, resolveEyeRects,
  resolveMouthRect, sourceFaceRotation,
} from './face-rig.js';
import {
  SOURCE_ARM_RIGS, armStablePose, armTransitionPose, transformPositionsRigid,
} from './articulation.js';

const unionRect = (a, b) => {
  if (!a) return b ? [...b] : null; if (!b) return [...a];
  const x0 = Math.min(a[0], b[0]); const y0 = Math.min(a[1], b[1]);
  const x1 = Math.max(a[0] + a[2], b[0] + b[2]); const y1 = Math.max(a[1] + a[3], b[1] + b[3]);
  return [x0, y0, x1 - x0, y1 - y0];
};
const expandRect = (rect, amount = 1.5) => rect ? [rect[0] - amount, rect[1] - amount, rect[2] + amount * 2, rect[3] + amount * 2] : null;
const blinkClosedWeight = (blinkLevel) => {
  const level = clamp01(blinkLevel);
  const t = clamp01(level / 0.86);
  return 1 - t * t * (3 - 2 * t);
};

function timedExpression(fromPreset, fromIntensity, toPreset, toIntensity, timeline) {
  const a = expressionForPreset(fromPreset, fromIntensity); const b = expressionForPreset(toPreset, toIntensity); const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const t = key.startsWith('brow') ? timeline.brows
      : key.startsWith('eye') ? timeline.eyes
        : key === 'mouthForm' ? timeline.mouth
          : key === 'cheek' ? timeline.cheeks : timeline.eyes;
    out[key] = lerp(Number(a[key]) || 0, Number(b[key]) || 0, t);
  }
  return out;
}

export const renderMethods = {
  drawImageNormalized(image, rect, parameters, transform, opacity = 1, transitionWarp = {}, localTransform = {}) {
    if (!image || !rect || opacity <= 0.001) return;
    const positions = createDeformedQuadNormalized(rect, parameters, this.secondary, transitionWarp, localTransform);
    this.renderer.drawMesh(image, positions, QUAD_UVS, QUAD_INDICES, { ...transform, opacity });
  },
  drawPart(partName, rect, sourceW, sourceH, parameters, transform, opacity = 1, transitionWarp = {}, localTransform = {}) {
    const image = this.parts[partName]; if (!image || opacity <= 0.001 || !rect) return;
    const positions = createDeformedQuad(rect, sourceW, sourceH, parameters, this.secondary, transitionWarp, localTransform);
    this.renderer.drawMesh(image, positions, QUAD_UVS, QUAD_INDICES, { ...transform, opacity });
  },
  drawPartNormalized(partName, rect, parameters, transform, opacity = 1, transitionWarp = {}, localTransform = {}) {
    const image = this.parts[partName]; if (!image || !rect || opacity <= 0.001) return;
    this.drawImageNormalized(image, rect, parameters, transform, opacity, transitionWarp, localTransform);
  },
  drawFeatureCover(source, kind, rect, sourceW, sourceH, parameters, transform, opacity, transitionWarp = {}, localTransform = {}) {
    const image = this.layers[source]?.covers?.[kind]; if (!image || !rect || opacity <= 0.001) return;
    this.drawImageNormalized(image, rectToNormalized(rect, sourceW, sourceH), parameters, transform, opacity, transitionWarp, localTransform);
  },
  drawFeatureCoverNormalized(source, kind, rect, parameters, transform, opacity, transitionWarp = {}, localTransform = {}) {
    const image = this.layers[source]?.covers?.[kind]; if (!image || !rect || opacity <= 0.001) return;
    this.drawImageNormalized(image, rect, parameters, transform, opacity, transitionWarp, localTransform);
  },
  drawBrows(emotionId, source, sourceW, sourceH, expression, parameters, transform, opacity = 1, transitionWarp = {}, localRotation = 0) {
    if (!this.parts.brow || opacity <= 0.001) return;
    const rects = resolveBrowRects(source, emotionId); const angles = browAngles(emotionId, expression);
    const baseRotation = radians(sourceFaceRotation(source)) + localRotation;
    this.drawFeatureCover(source, 'leftBrow', rects.leftBrow, sourceW, sourceH, parameters, transform, opacity, transitionWarp, { rotation: baseRotation });
    this.drawFeatureCover(source, 'rightBrow', rects.rightBrow, sourceW, sourceH, parameters, transform, opacity, transitionWarp, { rotation: baseRotation });
    this.drawPart('brow', rects.leftBrow, sourceW, sourceH, parameters, transform, opacity, transitionWarp, { rotation: baseRotation + radians(angles.left) });
    this.drawPart('brow', rects.rightBrow, sourceW, sourceH, parameters, transform, opacity, transitionWarp, { rotation: baseRotation + radians(angles.right) });
  },
  drawFace(emotionId, source, sourceW, sourceH, expression, parameters, transform, time, opacity = 1, transitionWarp = {}) {
    const baseLayout = FACE_LAYOUTS[source]; if (!baseLayout) return;
    const eyeRects = resolveEyeRects(source, emotionId); const baseRotation = radians(sourceFaceRotation(source)); const local = { rotation: baseRotation };
    const blinkClosed = blinkClosedWeight(this.blinkLevel);
    const eyeParts = eyePartsForEmotion(emotionId);
    this.drawFeatureCover(source, 'leftEye', expandRect(baseLayout.leftEye, 1.4), sourceW, sourceH, parameters, transform, opacity, transitionWarp, local);
    this.drawFeatureCover(source, 'rightEye', expandRect(baseLayout.rightEye, 1.4), sourceW, sourceH, parameters, transform, opacity, transitionWarp, local);
    const variantWeight = (1 - blinkClosed) * opacity;
    if (variantWeight > 0.003) {
      this.drawPart(eyeParts.left, eyeRects.leftEye, sourceW, sourceH, parameters, transform, variantWeight, transitionWarp, local);
      this.drawPart(eyeParts.right, eyeRects.rightEye, sourceW, sourceH, parameters, transform, variantWeight, transitionWarp, local);
    }
    if (blinkClosed > 0.003) {
      this.drawPart('eyeClosedL', eyeRects.leftEye, sourceW, sourceH, parameters, transform, blinkClosed * opacity, transitionWarp, local);
      this.drawPart('eyeClosedR', eyeRects.rightEye, sourceW, sourceH, parameters, transform, blinkClosed * opacity, transitionWarp, local);
    }
    this.drawBrows(emotionId, source, sourceW, sourceH, expression, parameters, transform, 0.92 * opacity, transitionWarp);

    const open = clamp01(parameters.ParamMouthOpenY); const blend = clamp01((time - this.visemeChangedAt) / 105);
    const previousRect = resolveMouthRect(source, emotionId, this.previousViseme, open); const currentRect = resolveMouthRect(source, emotionId, this.viseme, open);
    this.drawFeatureCover(source, 'mouth', expandRect(baseLayout.mouth, 2.0), sourceW, sourceH, parameters, transform, opacity, transitionWarp, local);
    const previous = mouthPartForEmotion(source, emotionId, this.previousViseme, open); const current = mouthPartForEmotion(source, emotionId, this.viseme, open);
    if (previous !== current && blend < 1) this.drawPart(previous, previousRect, sourceW, sourceH, parameters, transform, (1 - blend) * opacity, transitionWarp, local);
    this.drawPart(current, currentRect, sourceW, sourceH, parameters, transform, (previous === current ? 1 : blend) * opacity, transitionWarp, local);
  },
  drawTransitionFace(fromEmotion, toEmotion, fromSource, toSource, fromSize, toSize, expression, parameters, transform, time, sample, timeline) {
    const baseFrom = FACE_LAYOUTS[fromSource]; const baseTo = FACE_LAYOUTS[toSource]; if (!baseFrom && !baseTo) return;
    const fromEyes = resolveEyeRects(fromSource, fromEmotion); const toEyes = resolveEyeRects(toSource, toEmotion);
    const blendEye = (key) => blendNormalizedRect(fromEyes?.[key], fromSize, toEyes?.[key], toSize, timeline.eyes);
    const leftEye = blendEye('leftEye'); const rightEye = blendEye('rightEye');
    const faceRotation = radians(lerp(sourceFaceRotation(fromSource), sourceFaceRotation(toSource), timeline.eyes)); const local = { rotation: faceRotation };
    const fromEyeParts = eyePartsForEmotion(fromEmotion); const toEyeParts = eyePartsForEmotion(toEmotion);
    const blinkClosed = Math.max(blinkClosedWeight(this.blinkLevel), clamp01(timeline.handoffBlink * 0.96));
    if (baseFrom) {
      this.drawFeatureCoverNormalized(fromSource, 'leftEye', rectToNormalized(expandRect(baseFrom.leftEye, 1.4), fromSize[0], fromSize[1]), parameters, transform, 1 - sample.sourceMix, sample.warp, { rotation: radians(sourceFaceRotation(fromSource)) });
      this.drawFeatureCoverNormalized(fromSource, 'rightEye', rectToNormalized(expandRect(baseFrom.rightEye, 1.4), fromSize[0], fromSize[1]), parameters, transform, 1 - sample.sourceMix, sample.warp, { rotation: radians(sourceFaceRotation(fromSource)) });
    }
    if (baseTo) {
      this.drawFeatureCoverNormalized(toSource, 'leftEye', rectToNormalized(expandRect(baseTo.leftEye, 1.4), toSize[0], toSize[1]), parameters, transform, sample.sourceMix, sample.warp, { rotation: radians(sourceFaceRotation(toSource)) });
      this.drawFeatureCoverNormalized(toSource, 'rightEye', rectToNormalized(expandRect(baseTo.rightEye, 1.4), toSize[0], toSize[1]), parameters, transform, sample.sourceMix, sample.warp, { rotation: radians(sourceFaceRotation(toSource)) });
    }
    const visible = 1 - blinkClosed; const fromEyeWeight = visible * (1 - timeline.eyes); const toEyeWeight = visible * timeline.eyes;
    const drawEyePair = (parts, weight) => {
      if (weight <= 0.003) return;
      this.drawPartNormalized(parts.left, leftEye, parameters, transform, weight, sample.warp, local);
      this.drawPartNormalized(parts.right, rightEye, parameters, transform, weight, sample.warp, local);
    };
    if (fromEyeParts.left === toEyeParts.left && fromEyeParts.right === toEyeParts.right) drawEyePair(toEyeParts, visible);
    else { drawEyePair(fromEyeParts, fromEyeWeight); drawEyePair(toEyeParts, toEyeWeight); }
    if (blinkClosed > 0.003) {
      this.drawPartNormalized('eyeClosedL', leftEye, parameters, transform, blinkClosed, sample.warp, local);
      this.drawPartNormalized('eyeClosedR', rightEye, parameters, transform, blinkClosed, sample.warp, local);
    }

    const fromBrows = resolveBrowRects(fromSource, fromEmotion); const toBrows = resolveBrowRects(toSource, toEmotion); const angles = browAngles(toEmotion, expression);
    const leftBrow = blendNormalizedRect(fromBrows?.leftBrow, fromSize, toBrows?.leftBrow, toSize, timeline.brows); const rightBrow = blendNormalizedRect(fromBrows?.rightBrow, fromSize, toBrows?.rightBrow, toSize, timeline.brows);
    if (this.parts.brow) {
      this.drawFeatureCoverNormalized(fromSource, 'leftBrow', leftBrow, parameters, transform, 0.92 * (1 - sample.sourceMix), sample.warp, { rotation: faceRotation });
      this.drawFeatureCoverNormalized(toSource, 'leftBrow', leftBrow, parameters, transform, 0.92 * sample.sourceMix, sample.warp, { rotation: faceRotation });
      this.drawFeatureCoverNormalized(fromSource, 'rightBrow', rightBrow, parameters, transform, 0.92 * (1 - sample.sourceMix), sample.warp, { rotation: faceRotation });
      this.drawFeatureCoverNormalized(toSource, 'rightBrow', rightBrow, parameters, transform, 0.92 * sample.sourceMix, sample.warp, { rotation: faceRotation });
      this.drawPartNormalized('brow', leftBrow, parameters, transform, 0.92, sample.warp, { rotation: faceRotation + radians(angles.left) });
      this.drawPartNormalized('brow', rightBrow, parameters, transform, 0.92, sample.warp, { rotation: faceRotation + radians(angles.right) });
    }

    const open = clamp01(parameters.ParamMouthOpenY); const fromMouth = resolveMouthRect(fromSource, fromEmotion, this.viseme, open); const toMouth = resolveMouthRect(toSource, toEmotion, this.viseme, open); const mouth = blendNormalizedRect(fromMouth, fromSize, toMouth, toSize, timeline.mouth);
    if (baseFrom?.mouth) this.drawFeatureCoverNormalized(fromSource, 'mouth', rectToNormalized(expandRect(baseFrom.mouth, 2.0), fromSize[0], fromSize[1]), parameters, transform, 1 - sample.sourceMix, sample.warp, { rotation: radians(sourceFaceRotation(fromSource)) });
    if (baseTo?.mouth) this.drawFeatureCoverNormalized(toSource, 'mouth', rectToNormalized(expandRect(baseTo.mouth, 2.0), toSize[0], toSize[1]), parameters, transform, sample.sourceMix, sample.warp, { rotation: radians(sourceFaceRotation(toSource)) });
    const fromPart = mouthPartForEmotion(fromSource, fromEmotion, this.viseme, open); const toPart = mouthPartForEmotion(toSource, toEmotion, this.viseme, open); const mouthRotation = radians(lerp(sourceFaceRotation(fromSource), sourceFaceRotation(toSource), timeline.mouth));
    if (fromPart === toPart) this.drawPartNormalized(toPart, mouth, parameters, transform, 1, sample.warp, { rotation: mouthRotation });
    else { this.drawPartNormalized(fromPart, mouth, parameters, transform, 1 - timeline.mouth, sample.warp, { rotation: mouthRotation }); this.drawPartNormalized(toPart, mouth, parameters, transform, timeline.mouth, sample.warp, { rotation: mouthRotation }); }
  },
  drawArmLayer(source, side, rotation, opacity, parameters, transform, transitionWarp = {}, order = 'behind') {
    const layer = this.layers[source]; const rig = SOURCE_ARM_RIGS[source]; if (!layer || !rig || rig.order !== order || opacity <= 0.001) return;
    const image = side === 'left' ? layer.leftArm : layer.rightArm; const arm = rig[side]; if (!image || !arm?.pivot) return;
    const pivot = deformPoint(arm.pivot[0], arm.pivot[1], parameters, this.secondary, transitionWarp);
    const out = side === 'left' ? this.armDeformedLeft : this.armDeformedRight;
    transformPositionsRigid(this.deformed, pivot, rotation, [0,0], out);
    this.renderer.drawMesh(image, out, this.grid.uvs, this.grid.triangles, { ...transform, opacity });
  },
  drawStableArms(source, emotionId, parameters, transform, transitionWarp = {}, order = 'behind') {
    if (!SOURCE_ARM_RIGS[source]) return;
    const pose = armStablePose(source, emotionId); this.armPoseSnapshot = pose;
    this.drawArmLayer(source, 'left', pose.left.rotation, 1, parameters, transform, transitionWarp, order);
    this.drawArmLayer(source, 'right', pose.right.rotation, 1, parameters, transform, transitionWarp, order);
  },
  drawTransitionArms(fromSource, fromEmotion, toSource, toEmotion, parameters, transform, transitionWarp, order) {
    const pose = armTransitionPose(fromSource, fromEmotion, toSource, toEmotion, this.lastTransitionSample?.raw ?? 0); this.armPoseSnapshot = pose;
    const mix = pose.sourceMix;
    if (fromSource === toSource && SOURCE_ARM_RIGS[fromSource]) {
      this.drawArmLayer(fromSource, 'left', pose.left.fromRotation, 1, parameters, transform, transitionWarp, order);
      this.drawArmLayer(fromSource, 'right', pose.right.fromRotation, 1, parameters, transform, transitionWarp, order);
      return;
    }
    this.drawArmLayer(fromSource, 'left', pose.left.fromRotation, 1 - mix, parameters, transform, transitionWarp, order);
    this.drawArmLayer(fromSource, 'right', pose.right.fromRotation, 1 - mix, parameters, transform, transitionWarp, order);
    this.drawArmLayer(toSource, 'left', pose.left.toRotation, mix, parameters, transform, transitionWarp, order);
    this.drawArmLayer(toSource, 'right', pose.right.toRotation, mix, parameters, transform, transitionWarp, order);
  },
  drawShoulderLayer(source, side, opacity, transform) {
    const layer = this.layers[source];
    const image = side === 'left' ? layer?.leftShoulder : layer?.rightShoulder;
    if (!image || opacity <= 0.001) return;
    this.renderer.drawMesh(image, this.deformed, this.grid.uvs, this.grid.triangles, { ...transform, opacity });
  },
  drawStableShoulders(source, transform) {
    if (!SOURCE_ARM_RIGS[source]) return;
    this.drawShoulderLayer(source, 'left', 1, transform);
    this.drawShoulderLayer(source, 'right', 1, transform);
  },
  drawTransitionShoulders(fromSource, fromEmotion, toSource, toEmotion, transform) {
    const pose = armTransitionPose(fromSource, fromEmotion, toSource, toEmotion, this.lastTransitionSample?.raw ?? 0);
    if (fromSource === toSource) {
      this.drawShoulderLayer(fromSource, 'left', 1, transform);
      this.drawShoulderLayer(fromSource, 'right', 1, transform);
      return;
    }
    const mix = pose.sourceMix;
    this.drawShoulderLayer(fromSource, 'left', 1 - mix, transform);
    this.drawShoulderLayer(fromSource, 'right', 1 - mix, transform);
    this.drawShoulderLayer(toSource, 'left', mix, transform);
    this.drawShoulderLayer(toSource, 'right', mix, transform);
  },
  renderEntity(emotionId, intensity, time) {
    const preset = this.presets[emotionId] || FALLBACK_PRESETS.neutral; const image = this.images[preset.source]; if (!image) return;
    const layers = this.layers[preset.source] || { body: image }; const [sourceW, sourceH] = sourceSize(preset.source, image); const seconds = time / 1000; const age = Math.max(0, (time - this.emotionStartedAt) / 1000);
    const motion = motionFor(preset.bodyMotion, seconds, age, intensity); const expression = expressionForPreset(preset, intensity); const parameters = this.buildParameters(expression, intensity, motion); this.parameters = parameters;
    deformGrid(this.grid.positions, parameters, this.secondary, this.deformed, {});
    const fit = this.renderer.fitScale(image, 0.84); const pose = preset.pose || {};
    const transform = { scale: [fit[0] * (pose.scale || 1) * motion.scale, fit[1] * (pose.scale || 1) * motion.scale], offset: [motion.x + ((pose.x || 0) / sourceW) * fit[0] * 2, motion.y + ((pose.y || 0) / sourceH) * fit[1] * 2], rotation: radians((pose.rotation || 0) + motion.rotation), opacity: 1 };
    this.drawStableArms(preset.source, emotionId, parameters, transform, {}, 'behind');
    this.renderer.drawMesh(layers.body || image, this.deformed, this.grid.uvs, this.grid.triangles, transform);
    this.drawStableArms(preset.source, emotionId, parameters, transform, {}, 'front');
    this.drawStableShoulders(preset.source, transform);
    this.drawFace(emotionId, preset.source, sourceW, sourceH, expression, parameters, transform, time, 1, {});
    if (this.showMesh) this.renderer.drawWireframe(this.deformed, this.grid.lines, transform);
  },
  renderTransition(time) {
    const state = this.transitionState(time); if (!state) return this.renderEntity(this.currentEmotion, this.currentIntensity, time);
    const { fromPreset, toPreset, sample } = state; this.lastTransitionSample = sample;
    const imageA = this.images[fromPreset.source]; const imageB = this.images[toPreset.source]; if (!imageA || !imageB) return;
    const layerA = this.layers[fromPreset.source] || { body: imageA }; const layerB = this.layers[toPreset.source] || { body: imageB };
    const fromSize = sourceSize(fromPreset.source, imageA); const toSize = sourceSize(toPreset.source, imageB); const seconds = time / 1000;
    const fromAge = Math.max(0, (time - this.emotionStartedAt) / 1000); const toAge = Math.max(0, (time - this.transition.start) / 1000);
    const fromMotion = motionFor(fromPreset.bodyMotion, seconds, fromAge, this.transition.fromIntensity); const toMotion = motionFor(toPreset.bodyMotion, seconds, toAge, this.transition.toIntensity); const motion = blendMotion(fromMotion, toMotion, sample.progress);
    const timeline = expressionTimeline(sample.raw, fromPreset.source !== toPreset.source); const expression = timedExpression(fromPreset, this.transition.fromIntensity, toPreset, this.transition.toIntensity, timeline);
    const intensity = lerp(this.transition.fromIntensity, this.transition.toIntensity, sample.progress); const parameters = this.buildParameters(expression, intensity, motion);
    const blinkBridge = 1 - timeline.handoffBlink * 0.90; parameters.ParamEyeLOpen *= blinkBridge; parameters.ParamEyeROpen *= blinkBridge; this.parameters = parameters;
    const articulated = Boolean(SOURCE_ARM_RIGS[fromPreset.source] || SOURCE_ARM_RIGS[toPreset.source]); const bodyWarp = articulated ? { ...sample.warp, armLift: 0, armSpread: 0 } : sample.warp;
    deformGrid(this.grid.positions, parameters, this.secondary, this.deformed, bodyWarp);
    const fitA = this.renderer.fitScale(imageA, 0.84); const fitB = this.renderer.fitScale(imageB, 0.84); const pose = blendPose(fromPreset.pose, toPreset.pose, sample.progress); const fit = [lerp(fitA[0], fitB[0], sample.progress), lerp(fitA[1], fitB[1], sample.progress)];
    const poseOffsetA = [((fromPreset.pose?.x || 0) / fromSize[0]) * fitA[0] * 2, ((fromPreset.pose?.y || 0) / fromSize[1]) * fitA[1] * 2]; const poseOffsetB = [((toPreset.pose?.x || 0) / toSize[0]) * fitB[0] * 2, ((toPreset.pose?.y || 0) / toSize[1]) * fitB[1] * 2]; const pulse = 1 + sample.warp.scalePulse;
    const transform = { scale: [fit[0] * pose.scale * motion.scale * pulse, fit[1] * pose.scale * motion.scale * pulse], offset: [motion.x + lerp(poseOffsetA[0], poseOffsetB[0], sample.progress), motion.y + lerp(poseOffsetA[1], poseOffsetB[1], sample.progress)], rotation: radians(pose.rotation + motion.rotation), opacity: 1 };
    this.drawTransitionArms(fromPreset.source, this.transition.from, toPreset.source, this.transition.to, parameters, transform, bodyWarp, 'behind');
    this.renderer.drawMeshBlend(layerA.body || imageA, layerB.body || imageB, this.deformed, this.grid.uvs, this.grid.triangles, sample.sourceMix, transform);
    this.drawTransitionArms(fromPreset.source, this.transition.from, toPreset.source, this.transition.to, parameters, transform, bodyWarp, 'front');
    this.drawTransitionShoulders(fromPreset.source, this.transition.from, toPreset.source, this.transition.to, transform);
    this.drawTransitionFace(this.transition.from, this.transition.to, fromPreset.source, toPreset.source, fromSize, toSize, expression, parameters, transform, time, { ...sample, warp: bodyWarp }, timeline);
    if (this.showMesh) this.renderer.drawWireframe(this.deformed, this.grid.lines, transform);
  },
  render(time) { this.renderer.clear(); if (this.transition) this.renderTransition(time); else this.renderEntity(this.currentEmotion, this.currentIntensity, time); },
  getSnapshot() {
    const sample = this.lastTransitionSample;
    return { emotion: this.transition ? this.transition.to : this.currentEmotion, transition: this.transition ? { from: this.transition.from, to: this.transition.to, progress: sample?.progress ?? 0, sourceMix: sample?.sourceMix ?? 0, motion: sample?.motion || null } : null, armPose: this.armPoseSnapshot || null, mouthOpen: this.mouthOpen, mouthForm: this.mouthForm, viseme: this.viseme, lipSyncMode: this.lipSyncMode, audio: { ...this.audioResult }, blinkLevel: this.blinkLevel, breath: this.breathValue, fps: this.fps, parameters: this.parameters, renderer: 'webgl-articulated-v3', grid: `${this.grid.columns}x${this.grid.rows}` };
  },
  async reset() {
    this.currentEmotion = 'neutral'; this.currentIntensity = 1; this.transition?.resolve?.(); this.transition = null; this.lastTransitionSample = null; this.armPoseSnapshot = null; this.emotionStartedAt = now();
    this.manualMouth = 0; this.mouthTarget = 0; this.mouthOpen = 0; this.mouthFormTarget = 0; this.mouthForm = 0; this.setVisemeName('CLOSED'); this.lipSyncTest = false; this.audioFeatures = null;
    await this.stopMicrophoneLipSync(); this.lipSyncMode = 'manual'; this.blinkEnabled = true; this.blinkStart = -1; this.blinkLevel = 1; this.nextBlinkAt = now() + 2600; this.breathEnabled = true;
  },
  async destroy() { this.stop(); await this.stopMicrophoneLipSync(); this.resizeObserver?.disconnect(); if (!this.resizeObserver) window.removeEventListener('resize', this.onWindowResize); this.canvas.removeEventListener('pointermove', this.onPointerMove); this.canvas.removeEventListener('pointerleave', this.onPointerLeave); this.renderer.destroy(); }
};

function smoothstepLocal(a, b, v) {
  const t = clamp01((v - a) / Math.max(1e-6, b - a));
  return t * t * (3 - 2 * t);
}