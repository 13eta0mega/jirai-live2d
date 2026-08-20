import assert from 'node:assert/strict';
import {
  SOURCE_ARM_RIGS, armTransitionPose, armStablePose, validateArmRigConfig,
  transformPositionsRigid, armNativeAngle,
} from '../src/mesh/articulation.js';
import {
  EMOTION_FACE_PROFILES, MOUTH_SAFE_BOUNDS, resolveMouthRect, expressionTimeline,
  mouthPartForEmotion, eyeModeForEmotion, resolveEyeRects,
} from '../src/mesh/face-rig.js';

assert.deepEqual(validateArmRigConfig(), [], 'arm rig config must be valid');
for (const [source, rig] of Object.entries(SOURCE_ARM_RIGS)) {
  for (const side of ['left', 'right']) {
    assert.ok(Number.isFinite(rig[side].nativeAngle), `${source}.${side}: native angle`);
    assert.equal(rig[side].pivot.length, 2);
  }
}


const transitionModule = await import('../src/mesh/transition.js');
const bodyEarly = transitionModule.sampleTransition({ source: 'stand', transitionMotion: 'face_blend' }, { source: 'jump', transitionMotion: 'jump_settle' }, 0.30);
const bodyMid = transitionModule.sampleTransition({ source: 'stand', transitionMotion: 'face_blend' }, { source: 'jump', transitionMotion: 'jump_settle' }, 0.50);
const bodyLate = transitionModule.sampleTransition({ source: 'stand', transitionMotion: 'face_blend' }, { source: 'jump', transitionMotion: 'jump_settle' }, 0.70);
assert.ok(bodyEarly.sourceMix < 0.05, 'body texture handoff must not start as a long dissolve before the articulated action');
assert.ok(bodyMid.sourceMix > 0.45 && bodyMid.sourceMix < 0.55, 'body texture handoff must cross near the motion midpoint');
assert.ok(bodyLate.sourceMix > 0.95, 'body texture handoff must finish quickly so the target pose can settle');

const pose0 = armTransitionPose('stand', 'neutral', 'jump', 'excited', 0);
const poseMid = armTransitionPose('stand', 'neutral', 'jump', 'excited', 0.5);
const pose1 = armTransitionPose('stand', 'neutral', 'jump', 'excited', 1);
assert.ok(Math.abs(poseMid.left.worldAngle - pose0.left.worldAngle) > 25, 'neutral->excited left arm must visibly rotate');
assert.ok(Math.abs(poseMid.right.worldAngle - pose0.right.worldAngle) > 25, 'neutral->excited right arm must visibly rotate');
assert.ok(Math.abs(pose1.left.worldAngle - pose0.left.worldAngle) > 60, 'neutral->excited needs a real arm pose change, not mesh-only wobble');
assert.ok(Math.abs(pose1.right.worldAngle - pose0.right.worldAngle) > 60, 'neutral->excited needs a real arm pose change, not mesh-only wobble');
const radToDeg = (v) => v * 180 / Math.PI;
for (const side of ['left', 'right']) {
  const fromWorld = armNativeAngle('stand', side) + radToDeg(poseMid[side].fromRotation);
  const toWorld = armNativeAngle('jump', side) + radToDeg(poseMid[side].toRotation);
  const delta = ((fromWorld - toWorld + 540) % 360) - 180;
  assert.ok(Math.abs(delta) < 1e-6, `texture handoff must preserve ${side} arm world angle`);
}
let prevL = pose0.left.worldAngle;
for (let i = 1; i <= 120; i += 1) {
  const sample = armTransitionPose('stand', 'neutral', 'jump', 'excited', i / 120);
  assert.ok(Number.isFinite(sample.left.worldAngle) && Number.isFinite(sample.right.worldAngle));
  const delta = ((sample.left.worldAngle - prevL + 540) % 360) - 180;
  assert.ok(Math.abs(delta) < 4.5, 'arm interpolation may not jump frame-to-frame');
  prevL = sample.left.worldAngle;
}
const stableAngry = armStablePose('stand', 'angry');
const stableHappy = armStablePose('stand', 'happy');
assert.notEqual(stableAngry.left.worldAngle, stableHappy.left.worldAngle, 'same-source emotions must still have distinct arm posing');

const pts = new Float32Array([0,0, 1,0]);
const rotated = transformPositionsRigid(pts, [0,0], Math.PI/2);
assert.ok(Math.abs(rotated[2]) < 1e-6 && Math.abs(rotated[3] - 1) < 1e-6, 'rigid arm layer rotation must be geometric');

const emotionSource = {
  neutral:'stand', happy:'stand', excited:'jump', teasing:'peace', pleading:'uruuru', relaxed:'gorogoro', sick:'haku',
  angry:'stand', annoyed:'stand', sad:'uruuru', surprised:'jump', embarrassed:'stand', scared:'uruuru', smug:'peace', confused:'stand', love:'jump',
};
const visemes = ['CLOSED','A','I','U','E','O'];
for (const [emotion, source] of Object.entries(emotionSource)) {
  if (!MOUTH_SAFE_BOUNDS[source]) continue;
  for (const viseme of visemes) {
    for (const open of [0, 0.25, 0.6, 1]) {
      const rect = resolveMouthRect(source, emotion, viseme, open);
      assert.ok(rect?.every(Number.isFinite), `${emotion}/${viseme}: mouth rect finite`);
      assert.ok(rect[2] > 0 && rect[3] > 0, `${emotion}/${viseme}: mouth rect positive`);
      const [x,y,w,h] = rect; const [minX,minY,maxX,maxY] = MOUTH_SAFE_BOUNDS[source];
      assert.ok(x >= minX - 1e-6 && y >= minY - 1e-6, `${emotion}/${viseme}: mouth may not protrude left/top`);
      assert.ok(x + w <= maxX + 1e-6 && y + h <= maxY + 1e-6, `${emotion}/${viseme}: mouth may not protrude right/bottom`);
      assert.ok(mouthPartForEmotion(source, emotion, viseme, open), `${emotion}/${viseme}: mouth part must resolve`);
    }
  }
}
const standClosedRects = ['neutral','happy','angry','annoyed','embarrassed','confused']
  .map((emotion) => resolveMouthRect('stand', emotion, 'CLOSED', 0).map((v) => v.toFixed(2)).join(','));
assert.ok(new Set(standClosedRects).size >= 5, 'stand emotions must not share one fixed mouth placement/size');
assert.ok(Object.keys(EMOTION_FACE_PROFILES).length >= 16, 'all emotions require a face profile');
let lastBrows=0,lastEyes=0,lastMouth=0;
for (let i=0;i<=100;i+=1) {
  const t=expressionTimeline(i/100,true);
  assert.ok(t.brows + 1e-9 >= lastBrows && t.eyes + 1e-9 >= lastEyes && t.mouth + 1e-9 >= lastMouth, 'expression channels must advance monotonically');
  assert.ok(t.handoffBlink >= 0 && t.handoffBlink <= 1);
  lastBrows=t.brows; lastEyes=t.eyes; lastMouth=t.mouth;
}
assert.ok(expressionTimeline(0.5,true).handoffBlink > 0.45, 'source-changing face transition should blink through the visual handoff');


for (const emotion of Object.keys(emotionSource)) {
  assert.ok(['open','closed','wink','uruuru'].includes(eyeModeForEmotion(emotion)), `${emotion}: explicit eye mode required`);
  const source = emotionSource[emotion];
  const eyes = resolveEyeRects(source, emotion);
  assert.ok(eyes.leftEye?.every(Number.isFinite) && eyes.rightEye?.every(Number.isFinite), `${emotion}: eye anchors finite`);
  assert.ok(eyes.leftEye[2] > 0 && eyes.leftEye[3] > 0 && eyes.rightEye[2] > 0 && eyes.rightEye[3] > 0, `${emotion}: eye anchors positive`);
}

const { createDeformedQuadNormalized } = await import('../src/mesh/grid.js');
const quadRect=[-0.2,-0.1,0.4,0.2];
const quadBase=createDeformedQuadNormalized(quadRect,{},{ });
const quadRotated=createDeformedQuadNormalized(quadRect,{}, {}, {}, {rotation: Math.PI/2});
for (const value of quadRotated) assert.ok(Number.isFinite(value), 'rotated face quad must stay finite');
assert.ok(Math.abs(quadRotated[0]-quadBase[0])>0.05 || Math.abs(quadRotated[1]-quadBase[1])>0.05, 'local face rotation must move overlay corners');

console.log('articulation + face rig regression test passed');

const fs = await import('node:fs');
const renderSource = fs.readFileSync(new URL('../src/mesh/controller-render.js', import.meta.url), 'utf8');
const controllerSource = fs.readFileSync(new URL('../src/mesh/controller.js', import.meta.url), 'utf8');
assert.match(renderSource, /armTransitionPose/, 'transition renderer must use articulated arm pose solver');
assert.match(renderSource, /drawTransitionArms/, 'transition renderer must draw arm layers explicitly');
assert.match(renderSource, /resolveMouthRect/, 'mouth placement must resolve per emotion and viseme');
assert.match(renderSource, /drawFeatureCover/, 'mouth and eye overlays require underpaint to prevent double features');
assert.match(renderSource, /handoffBlink/, 'source-changing expressions require a blink bridge');
assert.match(controllerSource, /buildSourceLayers/, 'controller must preprocess flattened sprites into articulated layers');
assert.match(controllerSource, /normalizeOverlayParts/, 'face parts must trim transparent padding before placement');
assert.match(renderSource, /drawTransitionShoulders/, 'arm handoff must include shoulder seam covers');
assert.match(renderSource, /blinkClosedWeight/, 'blink rendering must use the blink channel rather than treating emotional eye openness as a ghosted blink');
const layerSource = fs.readFileSync(new URL('../src/mesh/layer-rig.js', import.meta.url), 'utf8');
assert.match(layerSource, /applyFeatherMask/, 'underpaint covers must feather their edges');
assert.match(layerSource, /leftShoulder/, 'articulated sources require a shoulder seam layer');
assert.equal(transitionModule.chooseTransitionMotion({source:'stand',transitionMotion:'face_blend'},{source:'jump',transitionMotion:'quick_react'}),'quick_react','surprised may use raised-arm source while retaining quick-reaction timing');
assert.match(controllerSource, /surprised:[\s\S]*source: 'jump'/, 'surprised must use a raised-arm source, not the vomit source');
assert.match(controllerSource, /scared:[\s\S]*source: 'uruuru'/, 'scared must use a fear/sad face source, not the vomit source');