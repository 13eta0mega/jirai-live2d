import { createAvatar } from "./controller.js";
import { FALLBACK_PRESETS } from "./data.js";

const EMOTIONS = [
  "neutral", "happy", "excited", "teasing", "pleading", "relaxed", "sick", "angry",
  "annoyed", "sad", "surprised", "embarrassed", "scared", "smug", "confused", "love",
];
const LABELS = { neutral: "중립", happy: "행복", excited: "신남", teasing: "장난", pleading: "애원", relaxed: "편안", sick: "아픔", angry: "화남", annoyed: "짜증", sad: "슬픔", surprised: "놀람", embarrassed: "당황", scared: "무서움", smug: "의기양양", confused: "혼란", love: "사랑" };
const SOURCE_KEYS = { "jirai_stand.png": "stand", "jirai_jump.png": "jump", "jirai_peace.png": "peace", "jirai_uruuru.png": "uruuru", "jirai_gorogoro.png": "gorogoro", "jirai_haku.png": "haku" };
function normalizePresets(config) { const raw = config?.presets || config; if (!raw || typeof raw !== "object") return FALLBACK_PRESETS; return Object.fromEntries(Object.entries(raw).map(([id, preset]) => [id, { ...preset, source: SOURCE_KEYS[preset.source] || preset.source }])); }
async function loadPresets() { try { const response = await fetch("config/emotion_presets.json", { cache: "no-store" }); if (!response.ok) throw new Error("config fetch failed"); return normalizePresets(await response.json()); } catch { return FALLBACK_PRESETS; } }
const $ = (id) => document.getElementById(id); const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function makeEmotionButtons(container, onSelect) { for (const id of EMOTIONS) { const button = document.createElement("button"); button.type = "button"; button.dataset.emotion = id; button.textContent = LABELS[id]; button.title = id; button.addEventListener("click", () => onSelect(id)); container.appendChild(button); } }
function formatParams(snapshot) { const keys = ["ParamEyeLOpen", "ParamEyeROpen", "ParamMouthOpenY", "ParamMouthForm", "ParamCheek", "ParamBreath", "ParamAngleX", "ParamAngleY", "ParamAngleZ", "ParamBodyAngleY"]; return keys.map((key) => `${key.padEnd(18, " ")} ${Number(snapshot.parameters[key] || 0).toFixed(3)}`).join("\n"); }

async function main() {
  const presets = await loadPresets(); const avatar = await createAvatar($("avatarCanvas"), presets); const emotionButtons = $("emotionButtons"); const mouth = $("mouthSlider"); const micButton = $("microphoneButton"); const lipSyncTest = $("lipSyncTest"); let micBusy = false;
  const syncMicButton = (active) => { micButton.classList.toggle("active", active); micButton.textContent = active ? "마이크 립싱크 중지" : "마이크 립싱크 시작"; };
  makeEmotionButtons(emotionButtons, (id) => avatar.setEmotion(id).catch((error) => setStatus(error.message)));
  mouth.addEventListener("input", () => avatar.setMouthOpen(Number(mouth.value)));
  lipSyncTest.addEventListener("change", async (event) => { if (event.target.checked) { await avatar.stopMicrophoneLipSync(); syncMicButton(false); } avatar.setLipSyncTest(event.target.checked); });
  micButton.addEventListener("click", async () => { if (micBusy) return; micBusy = true; micButton.disabled = true; try { const snapshot = avatar.getSnapshot(); if (snapshot.lipSyncMode === "microphone") { await avatar.stopMicrophoneLipSync(); syncMicButton(false); setStatus("마이크 립싱크를 중지했습니다."); } else { lipSyncTest.checked = false; avatar.setLipSyncTest(false); await avatar.startMicrophoneLipSync(); syncMicButton(true); setStatus("마이크 입력으로 RMS + 주파수 대역 기반 립싱크를 실행 중입니다."); } } catch (error) { syncMicButton(false); setStatus(`마이크 시작 실패: ${error.message}`); } finally { micBusy = false; micButton.disabled = false; } });
  $("autoBlink").addEventListener("change", (event) => avatar.setBlinkEnabled(event.target.checked)); $("breath").addEventListener("change", (event) => avatar.setBreathEnabled(event.target.checked)); $("showParameters").addEventListener("change", (event) => avatar.setDebug({ showParameters: event.target.checked })); $("showBounds").addEventListener("change", (event) => avatar.setDebug({ showBounds: event.target.checked }));
  $("resetButton").addEventListener("click", async () => { await avatar.reset(); mouth.value = "0"; lipSyncTest.checked = false; syncMicButton(false); setStatus("중립/수동 입력 상태로 완전히 초기화했습니다."); });
  $("cycleButton").addEventListener("click", () => runCycle(avatar)); $("qaButton").addEventListener("click", () => runTransitionQA(avatar));
  let lastUiUpdate = -Infinity;
  const update = (time) => { if (time - lastUiUpdate >= 80) { lastUiUpdate = time; const snapshot = avatar.getSnapshot(); $("emotionNow").textContent = `${LABELS[snapshot.emotion] || snapshot.emotion} (${snapshot.emotion})`; $("mouthValue").textContent = snapshot.mouthOpen.toFixed(2); $("blinkValue").textContent = snapshot.blinkLevel.toFixed(2); $("fpsValue").textContent = `${snapshot.fps} FPS`; $("visemeValue").textContent = snapshot.viseme; $("audioMode").textContent = snapshot.lipSyncMode; $("audioLevel").textContent = Number(snapshot.audio?.rms || 0).toFixed(3); $("audioMeterFill").style.width = `${Math.min(100, Math.max(0, (snapshot.audio?.rms || 0) * 520))}%`; $("params").textContent = formatParams(snapshot); $("params").hidden = !$("showParameters").checked; for (const button of emotionButtons.querySelectorAll("button")) button.classList.toggle("active", button.dataset.emotion === snapshot.emotion); if (snapshot.lipSyncMode !== "microphone" && micButton.classList.contains("active") && !micBusy) syncMicButton(false); } requestAnimationFrame(update); };
  requestAnimationFrame(update);
  const missingParts = avatar.getSnapshot().missingParts || []; if (missingParts.length) setStatus(`v0.2.1 런타임 준비 완료 · 선택 파츠 ${missingParts.length}개를 불러오지 못해 해당 효과만 비활성화했습니다.`); else setStatus("v0.2.1 런타임 준비 완료 · 마이크 립싱크, 감정별 모션, 시선 추적, 효과 렌더링을 지원합니다.");
  window.addEventListener("pagehide", () => { void avatar.destroy(); }, { once: true });
}
function setStatus(message) { const node = $("status"); if (node) node.textContent = message; }
async function runCycle(avatar) { setStatus("16개 감정 순환 테스트 중…"); for (const emotion of EMOTIONS) { await avatar.setEmotion(emotion, { duration: 360 }); await sleep(320); } await avatar.setEmotion("neutral", { duration: 360 }); setStatus("16개 감정 순환 테스트 완료."); }
async function runTransitionQA(avatar) { const sequence = ["neutral", "excited", "neutral", "teasing", "pleading", "angry", "sad", "happy", "surprised", "scared", "embarrassed", "smug", "confused", "love", "relaxed", "neutral", "sick", "neutral"]; setStatus("감정 전환 QA 시나리오 실행 중…"); for (const emotion of sequence) { await avatar.setEmotion(emotion, { duration: 320 }); await sleep(260); } setStatus("감정 전환 QA 시나리오 완료."); }
main().catch((error) => { console.error(error); setStatus(`초기화 실패: ${error.message}`); });
