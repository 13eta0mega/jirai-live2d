import { classifyViseme, createLipSyncState, smoothLipSync } from "../src/avatar/lipsync.js";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(classifyViseme({ rms: 0.001, low: 0, mid: 0, high: 0 }) === "CLOSED", "silence must close the mouth");
assert(classifyViseme({ rms: 0.15, low: 0.9, mid: 0.15, high: 0.05 }) === "O", "low-heavy spectrum should classify as O");
assert(classifyViseme({ rms: 0.15, low: 0.1, mid: 0.6, high: 0.55 }) === "I", "high/mid spectrum should classify as I");
assert(classifyViseme({ rms: 0.15, low: 0.18, mid: 0.8, high: 0.12 }) === "E", "mid-heavy spectrum should classify as E");

const state = createLipSyncState();
for (let i = 0; i < 12; i += 1) smoothLipSync(state, { rms: 0.18, low: 0.3, mid: 0.35, high: 0.2 }, 16);
assert(state.open > 0.45, "attack smoothing should open the mouth quickly");
const peak = state.open;
for (let i = 0; i < 4; i += 1) smoothLipSync(state, { rms: 0.002, low: 0, mid: 0, high: 0 }, 16);
assert(state.open < peak && state.open > 0, "release smoothing should close gradually");
console.log("lip-sync test passed");
