import assert from 'node:assert/strict';
import { FALLBACK_PRESETS } from '../src/avatar/data.js';
import { resolveMouthRect } from '../src/mesh/face-rig.js';
import {
  GENERATED_REFERENCE_FILES, GENERATED_REFERENCE_MOUTH_RECTS,
  hybridReferenceWeights, resolveGeneratedMouthRect, validateGeneratedReferenceConfig,
} from '../src/mesh/generated-reference-rig.js';

const emotions = ['neutral','happy','excited','teasing','pleading','relaxed','sick','angry','annoyed','sad','surprised','embarrassed','scared','smug','confused','love'];
const visemes = ['CLOSED','A','I','U','E','O'];
assert.equal(validateGeneratedReferenceConfig().length, 0, 'generated reference config must be valid');
assert.equal(Object.keys(GENERATED_REFERENCE_FILES).length, 10, 'ten high-resolution generated reference endpoints are expected');

for (const emotion of emotions) {
  const preset = FALLBACK_PRESETS[emotion];
  assert(preset, `${emotion}: preset missing`);
  for (const viseme of visemes) {
    const open = viseme === 'CLOSED' ? 0 : 0.82;
    const rect = GENERATED_REFERENCE_MOUTH_RECTS[emotion]
      ? resolveGeneratedMouthRect(emotion, viseme, open)
      : resolveMouthRect(preset.source, emotion, viseme, open);
    assert(rect, `${emotion}/${viseme}: no mouth anchor`);
    const [x,y,w,h] = rect;
    if (GENERATED_REFERENCE_MOUTH_RECTS[emotion]) {
      assert(x >= 0 && y >= 0 && x+w <= 1 && y+h <= 1, `${emotion}/${viseme}: generated mouth out of normalized bounds`);
      assert(w < 0.09 && h < 0.07, `${emotion}/${viseme}: generated mouth oversized`);
    } else {
      assert(w > 0 && h > 0, `${emotion}/${viseme}: fallback mouth invalid`);
    }
  }
}

let previousFrom = 1;
let previousTo = 0;
for (let i = 0; i <= 100; i += 1) {
  const p = i / 100;
  const weights = hybridReferenceWeights(p, true, true);
  assert(weights.from <= previousFrom + 1e-9, `from reference opacity must be monotonic at ${p}`);
  assert(weights.to + 1e-9 >= previousTo, `to reference opacity must be monotonic at ${p}`);
  assert(weights.from >= 0 && weights.to >= 0 && weights.articulated >= 0, `negative hybrid weight at ${p}`);
  assert(weights.from <= 1 && weights.to <= 1 && weights.articulated <= 1, `hybrid weight >1 at ${p}`);
  previousFrom = weights.from; previousTo = weights.to;
}
assert(hybridReferenceWeights(0, true, true).from > 0.999);
assert(hybridReferenceWeights(0.5, true, true).articulated > 0.999);
assert(hybridReferenceWeights(1, true, true).to > 0.999);
console.log('hybrid generated-reference + 16 emotion lip-sync QA passed');
