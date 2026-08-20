import { createAvatar } from "./controller.js";
import { FALLBACK_PRESETS } from "./data.js";

const EMOTIONS = [
  "neutral", "happy", "excited", "teasing", "pleading", "relaxed", "sick", "angry",
  "annoyed", "sad", "surprised", "embarrassed", "scared", "smug", "confused", "love",
];

const LABELS = {
  neutral: "중립", happy: "행복", excited: "신남", teasing: "장난", pleading: "애원",
  relaxed: "편안", sick: "아픔", angry: "화남", annoyed: "짜증", sad: "슬픔",
  surprised: "놀람", embarrassed: "당황", scared: "무서움", smug: "의기양양", confused: "혼란", love: "사랑",
};

const SOURCE_KEYS = {
  "jirai_stand.png": "stand",
  "jirai_jump.png": "jump",
  "jirai_peace.png": "peace",
  "jirai_uruuru.png": "uruuru",
  "jirai_gorogoro.png": "gorogoro",
  "jirai_haku.png": "haku",
};

function normalizePresets(config) {
  const raw = config?.presets || config;
  if (!raw || typeof raw !== "object") return FALLBACK_PRESETS;
  return Object.fromEntries(Object.entries(raw).map(([id, preset]) => [
    id,
    { ...preset, source: SOURCE_KEYS[preset.source] || preset.source },
  ]));
}

async function loadPresets() {
  try {
    const response = await fetch("config/emotion_presets.json", { cache: "no-store" });
    if (!response.ok) throw new Error("config fetch failed");
    return normalizePresets(await response.json());
  } catch {
    return FALLBACK_PRESETS;
  }
}

function $(id) {
  return document.getElementById(id);
}

function makeEmotionButtons(container, onSelect) {
  for (const id of EMOTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.emotion = id;
    button.textContent = LABELS[id];
    button.title = id;
    button.addEventListener("click", () => onSelect(id));
    container.appendChild(button);
  }
}

function formatParams(snapshot) {
  const keys = [
    "ParamEyeLOpen", "ParamEyeROpen", "ParamMouthOpenY", "ParamMouthForm", "ParamCheek",
    "ParamBreath", "ParamAngleZ", "ParamBodyAngleY", "ParamTwinTailL", "ParamTwinTailR",
  ];
  return keys.map((key) => `${key.padEnd(18, " ")} ${Number(snapshot.parameters[key] || 0).toFixed(3)}`).join("\n");
}

async function main() {
  const presets = await loadPresets();
  const avatar = await createAvatar($("avatarCanvas"), presets);
  const emotionButtons = $("emotionButtons");
  makeEmotionButtons(emotionButtons, (id) => {
    avatar.setEmotion(id).catch((error) => setStatus(error.message));
  });

  const mouth = $("mouthSlider");
  mouth.addEventListener("input", () => avatar.setMouthOpen(Number(mouth.value)));
  $("lipSyncTest").addEventListener("change", (event) => avatar.setLipSyncTest(event.target.checked));
  $("autoBlink").addEventListener("change", (event) => avatar.setBlinkEnabled(event.target.checked));
  $("breath").addEventListener("change", (event) => avatar.setBreathEnabled(event.target.checked));
  $("showParameters").addEventListener("change", (event) => avatar.setDebug({ showParameters: event.target.checked }));
  $("showBounds").addEventListener("change", (event) => avatar.setDebug({ showBounds: event.target.checked }));
  $("resetButton").addEventListener("click", async () => { await avatar.reset(); mouth.value = "0"; setStatus("중립 상태로 초기화했습니다."); });
  $("cycleButton").addEventListener("click", () => runCycle(avatar));
  $("qaButton").addEventListener("click", () => runTransitionQA(avatar));

  const update = () => {
    const snapshot = avatar.getSnapshot();
    $("emotionNow").textContent = `${LABELS[snapshot.emotion] || snapshot.emotion} (${snapshot.emotion})`;
    $("mouthValue").textContent = snapshot.mouthOpen.toFixed(2);
    $("blinkValue").textContent = snapshot.blinkLevel.toFixed(2);
    $("fpsValue").textContent = `${snapshot.fps} FPS`;
    $("params").textContent = formatParams(snapshot);
    for (const button of emotionButtons.querySelectorAll("button")) {
      button.classList.toggle("active", button.dataset.emotion === snapshot.emotion);
    }
    requestAnimationFrame(update);
  };
  update();
  setStatus("원본 PNG 기반 런타임 준비 완료 · TTS 입력은 아직 연결하지 않았습니다.");
}

function setStatus(message) {
  const node = $("status");
  if (node) node.textContent = message;
}

async function runCycle(avatar) {
  setStatus("16개 감정 순환 테스트 중…");
  for (const emotion of EMOTIONS) {
    await avatar.setEmotion(emotion);
    await new Promise((resolve) => setTimeout(resolve, 520));
  }
  await avatar.setEmotion("neutral");
  setStatus("16개 감정 순환 테스트 완료.");
}

async function runTransitionQA(avatar) {
  const sequence = [
    "neutral", "excited", "neutral", "teasing", "pleading", "angry", "sad", "happy",
    "surprised", "scared", "embarrassed", "smug", "confused", "love", "relaxed", "neutral", "sick", "neutral",
  ];
  setStatus("가이드의 감정 전환 QA 시나리오 실행 중…");
  for (const emotion of sequence) {
    await avatar.setEmotion(emotion);
    await new Promise((resolve) => setTimeout(resolve, 360));
  }
  setStatus("감정 전환 QA 시나리오 완료.");
}

main().catch((error) => {
  console.error(error);
  setStatus(`초기화 실패: ${error.message}`);
});

