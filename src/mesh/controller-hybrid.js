import { clamp01 } from '../avatar/lipsync.js';
import { QUAD_INDICES, QUAD_UVS, expressionForPreset, motionFor, radians, sourceSize } from './controller-common.js';
import { createDeformedQuadNormalized, deformGrid } from './grid.js';
import { mouthPartForEmotion } from './face-rig.js';
import { renderMethods as baseRenderMethods } from './controller-render.js';
import { hybridReferenceWeights, resolveGeneratedMouthRect } from './generated-reference-rig.js';

function referenceTransform(avatar, emotion, intensity, time, image, ageOrigin) {
  const preset = avatar.presets[emotion];
  if (!preset || !image) return null;
  const baseImage = avatar.images[preset.source];
  const [sourceW, sourceH] = sourceSize(preset.source, baseImage);
  const age = Math.max(0, (time - ageOrigin) / 1000);
  const motion = motionFor(preset.bodyMotion, time / 1000, age, intensity);
  const fit = avatar.renderer.fitScale(image, 0.84);
  const pose = preset.pose || {};
  const scale = (pose.scale || 1) * motion.scale;
  return {
    scale: [fit[0] * scale, fit[1] * scale],
    offset: [motion.x + ((pose.x || 0) / sourceW) * fit[0] * 2, motion.y + ((pose.y || 0) / sourceH) * fit[1] * 2],
    rotation: radians((pose.rotation || 0) + motion.rotation),
    opacity: 1,
  };
}

export const hybridRenderMethods = {
  drawReferenceRigid(image, transform, opacity = 1) {
    if (!image || !transform || opacity <= 0.001) return;
    this.renderer.drawMesh(image, this.deformed, this.grid.uvs, this.grid.triangles, { ...transform, opacity });
  },

  drawReferenceQuad(image, rect, transform, opacity = 1) {
    if (!image || !rect || !transform || opacity <= 0.001) return;
    const positions = createDeformedQuadNormalized(rect, this.parameters || {}, this.secondary || {}, {});
    this.renderer.drawMesh(image, positions, QUAD_UVS, QUAD_INDICES, { ...transform, opacity });
  },

  drawGeneratedReferenceMouth(emotion, transform, time, opacity = 1) {
    const cover = this.generatedReferenceCovers?.[emotion];
    if (!cover || opacity <= 0.001) return;
    const open = clamp01(this.mouthOpen);
    const active = open > 0.025 || this.viseme !== 'CLOSED' || this.lipSyncTest;
    if (!active) return; // preserve the hand-drawn emotion mouth while silent
    const reveal = clamp01((open - 0.005) / 0.08 + (this.viseme !== 'CLOSED' ? 0.55 : 0));
    this.drawReferenceQuad(cover.image, cover.rect, transform, reveal * opacity);
    const blend = clamp01((time - this.visemeChangedAt) / 105);
    const preset = this.presets[emotion];
    const prevRect = resolveGeneratedMouthRect(emotion, this.previousViseme, open);
    const nextRect = resolveGeneratedMouthRect(emotion, this.viseme, open);
    const previous = mouthPartForEmotion(preset?.source || 'stand', emotion, this.previousViseme, open);
    const current = mouthPartForEmotion(preset?.source || 'stand', emotion, this.viseme, open);
    if (previous !== current && blend < 1) this.drawReferenceQuad(this.parts[previous], prevRect, transform, (1 - blend) * reveal * opacity);
    this.drawReferenceQuad(this.parts[current], nextRect, transform, (previous === current ? 1 : blend) * reveal * opacity);
  },

  prepareGeneratedReference(emotion, intensity, time, ageOrigin) {
    const image = this.generatedReferences?.[emotion];
    const preset = this.presets[emotion];
    if (!image || !preset) return null;
    const age = Math.max(0, (time - ageOrigin) / 1000);
    const motion = motionFor(preset.bodyMotion, time / 1000, age, intensity);
    const expression = expressionForPreset(preset, intensity);
    const parameters = this.buildParameters(expression, intensity, motion);
    this.parameters = parameters;
    deformGrid(this.grid.positions, parameters, this.secondary, this.deformed, {});
    return referenceTransform(this, emotion, intensity, time, image, ageOrigin);
  },

  drawGeneratedReference(emotion, intensity, time, opacity, ageOrigin) {
    const image = this.generatedReferences?.[emotion];
    if (!image || opacity <= 0.001) return;
    const transform = this.prepareGeneratedReference(emotion, intensity, time, ageOrigin);
    if (!transform) return;
    this.drawReferenceRigid(image, transform, opacity);
    this.drawGeneratedReferenceMouth(emotion, transform, time, opacity);
  },

  renderEntity(emotionId, intensity, time) {
    if (!this.generatedReferences?.[emotionId]) return baseRenderMethods.renderEntity.call(this, emotionId, intensity, time);
    this.drawGeneratedReference(emotionId, intensity, time, 1, this.emotionStartedAt);
    if (this.showMesh) this.renderer.drawWireframe(this.deformed, this.grid.lines, referenceTransform(this, emotionId, intensity, time, this.generatedReferences[emotionId], this.emotionStartedAt));
  },

  renderTransition(time) {
    if (!this.transition) return this.renderEntity(this.currentEmotion, this.currentIntensity, time);
    // The base articulated pass owns the middle of the motion. At the extreme
    // endpoints we intentionally skip it so transparent reference art cannot
    // reveal a second silhouette underneath.
    const prior = this.lastTransitionSample;
    const state = this.transitionState(time);
    if (!state) return this.renderEntity(this.currentEmotion, this.currentIntensity, time);
    const p = state.sample.raw ?? state.sample.progress ?? 0;
    const fromImage = this.generatedReferences?.[this.transition.from];
    const toImage = this.generatedReferences?.[this.transition.to];
    if (fromImage && p <= 0.06) {
      this.lastTransitionSample = state.sample;
      this.drawGeneratedReference(this.transition.from, this.transition.fromIntensity, time, 1, this.emotionStartedAt);
      return;
    }
    if (toImage && p >= 0.94) {
      this.lastTransitionSample = state.sample;
      this.drawGeneratedReference(this.transition.to, this.transition.toIntensity, time, 1, this.transition.start);
      return;
    }
    const weights = hybridReferenceWeights(p, Boolean(fromImage), Boolean(toImage));
    this.lastTransitionSample = prior;
    if (weights.articulated > 0.001) {
      const renderer = this.renderer;
      const originalDrawMesh = renderer.drawMesh;
      const originalDrawMeshBlend = renderer.drawMeshBlend;
      renderer.drawMesh = function(image, positions, uvs, indices, options = {}) {
        return originalDrawMesh.call(this, image, positions, uvs, indices, { ...options, opacity: (options.opacity ?? 1) * weights.articulated });
      };
      renderer.drawMeshBlend = function(imageA, imageB, positions, uvs, indices, mix, options = {}) {
        return originalDrawMeshBlend.call(this, imageA, imageB, positions, uvs, indices, mix, { ...options, opacity: (options.opacity ?? 1) * weights.articulated });
      };
      try { baseRenderMethods.renderTransition.call(this, time); }
      finally { renderer.drawMesh = originalDrawMesh; renderer.drawMeshBlend = originalDrawMeshBlend; }
    } else {
      this.lastTransitionSample = state.sample;
    }
    const sample = this.lastTransitionSample || state.sample;
    const resolvedWeights = hybridReferenceWeights(sample.raw ?? sample.progress ?? p, Boolean(fromImage), Boolean(toImage));
    if (fromImage) this.drawGeneratedReference(this.transition.from, this.transition.fromIntensity, time, resolvedWeights.from, this.emotionStartedAt);
    if (toImage) this.drawGeneratedReference(this.transition.to, this.transition.toIntensity, time, resolvedWeights.to, this.transition.start);
  },

  getSnapshot() {
    const snapshot = baseRenderMethods.getSnapshot.call(this);
    const p = this.lastTransitionSample?.raw ?? this.lastTransitionSample?.progress ?? 0;
    const weights = this.transition
      ? hybridReferenceWeights(p, Boolean(this.generatedReferences?.[this.transition.from]), Boolean(this.generatedReferences?.[this.transition.to]))
      : { from: 0, to: this.generatedReferences?.[this.currentEmotion] ? 1 : 0, articulated: this.generatedReferences?.[this.currentEmotion] ? 0 : 1 };
    return { ...snapshot, renderer: 'webgl-hybrid-articulated-v4', referenceBlend: weights };
  },
};
