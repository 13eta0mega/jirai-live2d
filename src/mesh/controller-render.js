import { FALLBACK_PRESETS, VISEMES } from "../avatar/data.js";
import { clamp01 } from "../avatar/lipsync.js";
import { createDeformedQuad, createDeformedQuadNormalized, deformGrid } from "./grid.js";
import { FACE_LAYOUTS, blendNormalizedRect } from "./layout.js";
import { blendMotion, blendPose, lerp } from "./transition.js";
import { QUAD_INDICES, QUAD_UVS, expressionForPreset, blendExpression, motionFor, now, radians, sourceSize } from "./controller-common.js";

export const renderMethods = {
  drawPart(partName, rect, sourceW, sourceH, parameters, transform, opacity = 1, transitionWarp = {}) {
    const image = this.parts[partName]; if (!image || opacity <= 0.001) return;
    const positions = createDeformedQuad(rect, sourceW, sourceH, parameters, this.secondary, transitionWarp);
    this.renderer.drawMesh(image, positions, QUAD_UVS, QUAD_INDICES, { ...transform, opacity });
  },
  drawPartNormalized(partName, rect, parameters, transform, opacity = 1, transitionWarp = {}) {
    const image = this.parts[partName]; if (!image || !rect || opacity <= 0.001) return;
    const positions = createDeformedQuadNormalized(rect, parameters, this.secondary, transitionWarp);
    this.renderer.drawMesh(image, positions, QUAD_UVS, QUAD_INDICES, { ...transform, opacity });
  },
  mouthPartFor(source, viseme, open) {
    if (viseme === "CLOSED" || open < 0.05) { if (source === "uruuru") return "mouthUruuru"; if (source === "peace") return "mouthSmall"; return "mouthClosed"; }
    return VISEMES[viseme]?.mouthPart || "mouthA";
  },
  drawFace(emotionId, source, sourceW, sourceH, parameters, transform, time, opacity = 1, transitionWarp = {}) {
    const layout = FACE_LAYOUTS[source]; if (!layout) return;
    const eyeOpen = clamp01((parameters.ParamEyeLOpen + parameters.ParamEyeROpen) * 0.5); const closed = clamp01((1 - eyeOpen) * 1.25) * opacity;
    if (source === "uruuru" && eyeOpen > 0.35) { this.drawPart("eyeUruuruL", layout.leftEye, sourceW, sourceH, parameters, transform, eyeOpen * opacity, transitionWarp); this.drawPart("eyeUruuruR", layout.rightEye, sourceW, sourceH, parameters, transform, eyeOpen * opacity, transitionWarp); }
    if (closed > 0.01) { this.drawPart("eyeClosedL", layout.leftEye, sourceW, sourceH, parameters, transform, closed, transitionWarp); this.drawPart("eyeClosedR", layout.rightEye, sourceW, sourceH, parameters, transform, closed, transitionWarp); }
    if (source === "peace" && ["teasing", "smug"].includes(emotionId)) this.drawPart("eyeWinkR", layout.rightEye, sourceW, sourceH, parameters, transform, 0.9 * opacity, transitionWarp);
    const open = clamp01(parameters.ParamMouthOpenY); const blend = clamp01((time - this.visemeChangedAt) / 90); const previous = this.mouthPartFor(source, this.previousViseme, open); const current = this.mouthPartFor(source, this.viseme, open);
    if (previous !== current && blend < 1) this.drawPart(previous, layout.mouth, sourceW, sourceH, parameters, transform, (1 - blend) * opacity, transitionWarp);
    this.drawPart(current, layout.mouth, sourceW, sourceH, parameters, transform, (previous === current ? 1 : blend) * opacity, transitionWarp);
  },
  drawTransitionFace(fromEmotion, toEmotion, fromSource, toSource, fromSize, toSize, parameters, transform, time, sample) {
    const fromLayout = FACE_LAYOUTS[fromSource]; const toLayout = FACE_LAYOUTS[toSource]; if (!fromLayout && !toLayout) return;
    const blendRect = (key) => blendNormalizedRect(fromLayout?.[key], fromSize, toLayout?.[key], toSize, sample.progress);
    const leftEye = blendRect("leftEye"); const rightEye = blendRect("rightEye"); const mouth = blendRect("mouth");
    const eyeOpen = clamp01((parameters.ParamEyeLOpen + parameters.ParamEyeROpen) * 0.5); const closed = clamp01((1 - eyeOpen) * 1.25);
    if (closed > 0.01) { this.drawPartNormalized("eyeClosedL", leftEye, parameters, transform, closed, sample.warp); this.drawPartNormalized("eyeClosedR", rightEye, parameters, transform, closed, sample.warp); }
    if (toSource === "uruuru" && eyeOpen > 0.35) { const weight = sample.sourceMix * eyeOpen; this.drawPartNormalized("eyeUruuruL", leftEye, parameters, transform, weight, sample.warp); this.drawPartNormalized("eyeUruuruR", rightEye, parameters, transform, weight, sample.warp); }
    else if (fromSource === "uruuru" && eyeOpen > 0.35) { const weight = (1 - sample.sourceMix) * eyeOpen; this.drawPartNormalized("eyeUruuruL", leftEye, parameters, transform, weight, sample.warp); this.drawPartNormalized("eyeUruuruR", rightEye, parameters, transform, weight, sample.warp); }
    if (toSource === "peace" && ["teasing", "smug"].includes(toEmotion)) this.drawPartNormalized("eyeWinkR", rightEye, parameters, transform, sample.progress * 0.9, sample.warp);
    const dominantSource = sample.sourceMix >= 0.5 ? toSource : fromSource; const open = clamp01(parameters.ParamMouthOpenY); const visemeBlend = clamp01((time - this.visemeChangedAt) / 90);
    const previous = this.mouthPartFor(dominantSource, this.previousViseme, open); const current = this.mouthPartFor(dominantSource, this.viseme, open);
    if (previous !== current && visemeBlend < 1) this.drawPartNormalized(previous, mouth, parameters, transform, 1 - visemeBlend, sample.warp);
    this.drawPartNormalized(current, mouth, parameters, transform, previous === current ? 1 : visemeBlend, sample.warp);
  },
  renderEntity(emotionId, intensity, time) {
    const preset = this.presets[emotionId] || FALLBACK_PRESETS.neutral; const image = this.images[preset.source]; if (!image) return;
    const [sourceW, sourceH] = sourceSize(preset.source, image); const seconds = time / 1000; const age = Math.max(0, (time - this.emotionStartedAt) / 1000);
    const motion = motionFor(preset.bodyMotion, seconds, age, intensity); const expression = expressionForPreset(preset, intensity); const parameters = this.buildParameters(expression, intensity, motion); this.parameters = parameters;
    deformGrid(this.grid.positions, parameters, this.secondary, this.deformed, {});
    const fit = this.renderer.fitScale(image, 0.84); const pose = preset.pose || {};
    const transform = { scale: [fit[0] * (pose.scale || 1) * motion.scale, fit[1] * (pose.scale || 1) * motion.scale], offset: [motion.x + ((pose.x || 0) / sourceW) * fit[0] * 2, motion.y + ((pose.y || 0) / sourceH) * fit[1] * 2], rotation: radians((pose.rotation || 0) + motion.rotation), opacity: 1 };
    this.renderer.drawMesh(image, this.deformed, this.grid.uvs, this.grid.triangles, transform); this.drawFace(emotionId, preset.source, sourceW, sourceH, parameters, transform, time, 1, {}); if (this.showMesh) this.renderer.drawWireframe(this.deformed, this.grid.lines, transform);
  },
  renderTransition(time) {
    const state = this.transitionState(time); if (!state) return this.renderEntity(this.currentEmotion, this.currentIntensity, time);
    const { fromPreset, toPreset, sample } = state; const imageA = this.images[fromPreset.source]; const imageB = this.images[toPreset.source]; if (!imageA || !imageB) return;
    const fromSize = sourceSize(fromPreset.source, imageA); const toSize = sourceSize(toPreset.source, imageB); const seconds = time / 1000;
    const fromAge = Math.max(0, (time - this.emotionStartedAt) / 1000); const toAge = Math.max(0, (time - this.transition.start) / 1000);
    const fromMotion = motionFor(fromPreset.bodyMotion, seconds, fromAge, this.transition.fromIntensity); const toMotion = motionFor(toPreset.bodyMotion, seconds, toAge, this.transition.toIntensity); const motion = blendMotion(fromMotion, toMotion, sample.progress);
    const expression = blendExpression(fromPreset, this.transition.fromIntensity, toPreset, this.transition.toIntensity, sample.progress); const intensity = lerp(this.transition.fromIntensity, this.transition.toIntensity, sample.progress); const parameters = this.buildParameters(expression, intensity, motion); this.parameters = parameters;
    deformGrid(this.grid.positions, parameters, this.secondary, this.deformed, sample.warp);
    const fitA = this.renderer.fitScale(imageA, 0.84); const fitB = this.renderer.fitScale(imageB, 0.84); const pose = blendPose(fromPreset.pose, toPreset.pose, sample.progress); const fit = [lerp(fitA[0], fitB[0], sample.progress), lerp(fitA[1], fitB[1], sample.progress)];
    const poseOffsetA = [((fromPreset.pose?.x || 0) / fromSize[0]) * fitA[0] * 2, ((fromPreset.pose?.y || 0) / fromSize[1]) * fitA[1] * 2]; const poseOffsetB = [((toPreset.pose?.x || 0) / toSize[0]) * fitB[0] * 2, ((toPreset.pose?.y || 0) / toSize[1]) * fitB[1] * 2]; const pulse = 1 + sample.warp.scalePulse;
    const transform = { scale: [fit[0] * pose.scale * motion.scale * pulse, fit[1] * pose.scale * motion.scale * pulse], offset: [motion.x + lerp(poseOffsetA[0], poseOffsetB[0], sample.progress), motion.y + lerp(poseOffsetA[1], poseOffsetB[1], sample.progress)], rotation: radians(pose.rotation + motion.rotation), opacity: 1 };
    this.renderer.drawMeshBlend(imageA, imageB, this.deformed, this.grid.uvs, this.grid.triangles, sample.sourceMix, transform);
    this.drawTransitionFace(this.transition.from, this.transition.to, fromPreset.source, toPreset.source, fromSize, toSize, parameters, transform, time, sample);
    if (this.showMesh) this.renderer.drawWireframe(this.deformed, this.grid.lines, transform); this.lastTransitionSample = sample;
  },
  render(time) { this.renderer.clear(); if (this.transition) this.renderTransition(time); else this.renderEntity(this.currentEmotion, this.currentIntensity, time); },
  getSnapshot() {
    const sample = this.lastTransitionSample;
    return { emotion: this.transition ? this.transition.to : this.currentEmotion, transition: this.transition ? { from: this.transition.from, to: this.transition.to, progress: sample?.progress ?? 0, sourceMix: sample?.sourceMix ?? 0, motion: sample?.motion || null } : null, mouthOpen: this.mouthOpen, mouthForm: this.mouthForm, viseme: this.viseme, lipSyncMode: this.lipSyncMode, audio: { ...this.audioResult }, blinkLevel: this.blinkLevel, breath: this.breathValue, fps: this.fps, parameters: this.parameters, renderer: "webgl-mesh-v2", grid: `${this.grid.columns}x${this.grid.rows}` };
  },
  async reset() {
    this.currentEmotion = "neutral"; this.currentIntensity = 1; this.transition?.resolve?.(); this.transition = null; this.lastTransitionSample = null; this.emotionStartedAt = now();
    this.manualMouth = 0; this.mouthTarget = 0; this.mouthOpen = 0; this.mouthFormTarget = 0; this.mouthForm = 0; this.setVisemeName("CLOSED"); this.lipSyncTest = false; this.audioFeatures = null;
    await this.stopMicrophoneLipSync(); this.lipSyncMode = "manual"; this.blinkEnabled = true; this.blinkStart = -1; this.blinkLevel = 1; this.nextBlinkAt = now() + 2600; this.breathEnabled = true;
  },
  async destroy() { this.stop(); await this.stopMicrophoneLipSync(); this.resizeObserver?.disconnect(); if (!this.resizeObserver) window.removeEventListener("resize", this.onWindowResize); this.canvas.removeEventListener("pointermove", this.onPointerMove); this.canvas.removeEventListener("pointerleave", this.onPointerLeave); this.renderer.destroy(); }
};
