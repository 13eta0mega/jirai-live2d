import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const emotion = readJson("config/emotion_presets.json");
const rig = readJson("config/rig_parameters.json");
const layers = readJson("config/layer_manifest.json");
const parts = readJson("assets/parts/parts_manifest.json");
const expected = ["neutral", "happy", "excited", "teasing", "pleading", "relaxed", "sick", "angry", "annoyed", "sad", "surprised", "embarrassed", "scared", "smug", "confused", "love"];
const actual = emotion.emotionIds || Object.keys(emotion.presets || {});
if (actual.length !== expected.length || expected.some((id) => !actual.includes(id))) throw new Error("16 emotion IDs are incomplete");
for (const id of expected) {
  if (!emotion.presets[id]) throw new Error(`Missing preset: ${id}`);
  if (!emotion.presets[id].source) throw new Error(`Missing source: ${id}`);
}
const requiredParams = ["ParamMouthOpenY", "ParamEyeLOpen", "ParamEyeROpen", "ParamBreath"];
for (const id of requiredParams) if (!rig.parameters.some((parameter) => parameter.id === id)) throw new Error(`Missing parameter: ${id}`);
if (!layers.sourcePolicy || layers.sourcePolicy.vectorization !== false || layers.sourcePolicy.aiGeneration !== false) throw new Error("Source policy must forbid vectorization and AI generation");
for (const part of parts.parts) if (!fs.existsSync(path.join(root, "assets", "parts", part.output))) throw new Error(`Missing part file: ${part.output}`);
console.log(`config test passed: ${expected.length} emotions, ${rig.parameters.length} parameters, ${parts.parts.length} derived crops`);

