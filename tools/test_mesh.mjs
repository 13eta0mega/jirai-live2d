import { createGrid, deformGrid, deformPoint } from "../src/mesh/grid.js";
import { createSecondaryMotionState, stepSecondaryMotion } from "../src/mesh/physics.js";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const grid = createGrid(8, 10);
assert(grid.positions.length === 9 * 11 * 2, "grid vertex count mismatch");
assert(grid.triangles.length === 8 * 10 * 6, "triangle index count mismatch");
assert(grid.lines.length > 0, "wireframe indices missing");

const secondary = createSecondaryMotionState();
const neutral = deformGrid(grid.positions, {}, secondary);
for (const value of neutral) assert(Number.isFinite(value), "neutral deformation generated non-finite coordinate");

const before = deformPoint(0, -0.65, {}, secondary);
const after = deformPoint(0, -0.65, { ParamAngleX: 15 }, secondary);
assert(after[0] > before[0] + 0.02, "head angle must deform upper mesh horizontally");

for (let i = 0; i < 60; i += 1) stepSecondaryMotion(secondary, { headX: 0.8, bodyZ: 0.2, velocityX: 0.1, breath: 0.4 }, 16);
assert(Math.abs(secondary.leftTail.value) > 0.1, "left tail spring did not react");
assert(Math.abs(secondary.rightTail.value) > 0.1, "right tail spring did not react");
const tailPoint = deformPoint(-0.85, -0.25, {}, secondary);
assert(Math.abs(tailPoint[0] + 0.85) > 0.002, "tail spring must affect side vertices");

const mouthNeutral = deformPoint(0.18, -0.12, { ParamMouthOpenY: 0, ParamMouthForm: 0 }, secondary);
const mouthOpen = deformPoint(0.18, -0.12, { ParamMouthOpenY: 1, ParamMouthForm: 0.8 }, secondary);
assert(Math.abs(mouthOpen[0] - mouthNeutral[0]) > 0.001 || Math.abs(mouthOpen[1] - mouthNeutral[1]) > 0.001, "mouth parameters must affect lower-face mesh");

console.log("mesh deformation test passed");
