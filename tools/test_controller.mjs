const assert = (condition, message) => { if (!condition) throw new Error(message); };
class ResizeObserverMock { observe() {} disconnect() {} }
globalThis.ResizeObserver = ResizeObserverMock;
globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, AudioContext: null, webkitAudioContext: null };
globalThis.requestAnimationFrame = () => 1;
const ctx = { setTransform() {}, save() {}, restore() {}, clearRect() {}, scale() {}, fillRect() {}, fillText() {}, translate() {}, rotate() {}, transform() {}, drawImage() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, ellipse() {} };
const canvas = { style: {}, parentElement: { getBoundingClientRect: () => ({ width: 420, height: 470 }) }, getContext: () => ctx, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 470 }) };
const { AvatarController } = await import("../src/avatar/controller.js");
const avatar = new AvatarController(canvas);
avatar.setAudioFeatures({ rms: 0.18, low: 0.3, mid: 0.35, high: 0.2 });
assert(avatar.getSnapshot().lipSyncMode === "external", "setAudioFeatures must enter external mode");
for (let i = 1; i <= 10; i += 1) avatar.update(i * 16);
assert(avatar.getSnapshot().mouthTarget > 0.2, "external audio must drive mouth target");
avatar.setLipSyncTest(true);
assert(avatar.getSnapshot().lipSyncMode === "test", "lip-sync test must take ownership from external mode");
avatar.update(200);
assert(avatar.getSnapshot().audio.rms > 0, "test mode must publish fresh audio telemetry");
await avatar.reset();
let snapshot = avatar.getSnapshot();
assert(snapshot.lipSyncMode === "manual", "reset must return to manual mode");
assert(snapshot.viseme === "CLOSED", "reset must close the viseme");
assert(snapshot.audio.rms === 0, "reset must clear stale audio telemetry");
assert(snapshot.mouthTarget === 0, "reset must clear mouth target");
let stopped = false;
const track = { addEventListener() {}, removeEventListener() {}, stop() { stopped = true; } };
const stream = { getTracks: () => [track] };
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } });
class FailingAudioContext { constructor() { this.state = "suspended"; } async resume() { throw new Error("resume failed"); } async close() { this.state = "closed"; } }
window.AudioContext = FailingAudioContext;
let failed = false;
try { await avatar.startMicrophoneLipSync(); } catch { failed = true; }
assert(failed, "microphone startup failure must propagate");
assert(stopped, "microphone track must be stopped after startup failure");
snapshot = avatar.getSnapshot();
assert(snapshot.lipSyncMode === "manual", "failed microphone startup must restore manual mode");
assert(snapshot.audio.rms === 0, "failed microphone startup must not leave stale telemetry");
console.log("controller lifecycle test passed");
