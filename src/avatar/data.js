export const SOURCE_FILES = {
  stand: "assets/source/jirai_stand.png",
  jump: "assets/source/jirai_jump.png",
  peace: "assets/source/jirai_peace.png",
  uruuru: "assets/source/jirai_uruuru.png",
  gorogoro: "assets/source/jirai_gorogoro.png",
  haku: "assets/source/jirai_haku.png",
};

export const PART_FILES = {
  eyeOpenL: "assets/parts/eyes/eye_open_l.png",
  eyeOpenR: "assets/parts/eyes/eye_open_r.png",
  eyeClosedL: "assets/parts/eyes/eye_closed_l.png",
  eyeClosedR: "assets/parts/eyes/eye_closed_r.png",
  eyeWinkR: "assets/parts/eyes/eye_wink_r.png",
  eyeUruuruL: "assets/parts/eyes/eye_uruuru_l.png",
  eyeUruuruR: "assets/parts/eyes/eye_uruuru_r.png",
  mouthClosed: "assets/parts/mouth/mouth_closed.png",
  mouthSmall: "assets/parts/mouth/mouth_small.png",
  mouthA: "assets/parts/mouth/mouth_a.png",
  mouthWide: "assets/parts/mouth/mouth_wide.png",
  mouthUruuru: "assets/parts/mouth/mouth_uruuru.png",
  rainbow: "assets/parts/effects/rainbow_haku.png",
};

const pose = (source, expression, bodyMotion, options = {}) => ({
  source,
  expression,
  bodyMotion,
  transitionMotion: options.transitionMotion || "face_blend",
  effects: options.effects || [],
  loop: options.loop ?? true,
  priority: options.priority ?? 30,
  blinkMode: options.blinkMode || "auto",
  breathScale: options.breathScale ?? 1,
  lipSyncEnabled: options.lipSyncEnabled ?? true,
  pose: options.pose || { x: 0, y: 0, rotation: 0, scale: 1 },
});

export const FALLBACK_PRESETS = {
  neutral: pose("stand", "neutral", "idle_breath", { priority: 10 }),
  happy: pose("stand", "happy", "happy_bob", { breathScale: 1.05, pose: { x: 0, y: -3, rotation: 0, scale: 1.02 } }),
  excited: pose("jump", "excited", "jump_once", { transitionMotion: "jump_settle", loop: false, priority: 40, blinkMode: "special", breathScale: 0.8, pose: { x: 0, y: -10, rotation: 0, scale: 1.03 } }),
  teasing: pose("peace", "teasing", "pose_forward_hands", { transitionMotion: "limb_blend", blinkMode: "special", breathScale: 0.95, pose: { x: 0, y: 0, rotation: -2, scale: 1 } }),
  pleading: pose("uruuru", "pleading", "pleading_idle", { transitionMotion: "limb_blend", effects: ["sparkle"], blinkMode: "special", breathScale: 0.7, pose: { x: 0, y: 5, rotation: 0, scale: 0.98 } }),
  relaxed: pose("gorogoro", "relaxed", "lay_idle", { transitionMotion: "lay_transition", priority: 50, blinkMode: "disabled", breathScale: 0.35, pose: { x: 0, y: 25, rotation: -9, scale: 0.92 } }),
  sick: pose("haku", "sick", "sick_recoil", { transitionMotion: "sick_transition", effects: ["rainbow", "sparkle"], loop: false, priority: 50, breathScale: 0.5, pose: { x: 0, y: 8, rotation: 0, scale: 0.98 } }),
  angry: pose("stand", "angry", "angry_tense", { breathScale: 0.85, pose: { x: 0, y: 3, rotation: 1, scale: 1 } }),
  annoyed: pose("stand", "annoyed", "annoyed_shift", { breathScale: 0.9, pose: { x: 3, y: 1, rotation: -2, scale: 1 } }),
  sad: pose("uruuru", "sad", "sad_sink", { transitionMotion: "face_blend", effects: ["tears"], blinkMode: "special", breathScale: 0.65, pose: { x: 0, y: 7, rotation: 1, scale: 0.98 } }),
  surprised: pose("haku", "surprised", "startle", { transitionMotion: "quick_react", loop: false, priority: 40, blinkMode: "special", breathScale: 0.8, pose: { x: 0, y: -2, rotation: -1, scale: 1 } }),
  embarrassed: pose("stand", "embarrassed", "shy_shift", { breathScale: 0.9, pose: { x: -2, y: 3, rotation: 2, scale: 1 } }),
  scared: pose("haku", "scared", "scared_shiver", { transitionMotion: "quick_react", blinkMode: "special", breathScale: 0.8, pose: { x: 0, y: 2, rotation: -1, scale: 1.01 } }),
  smug: pose("peace", "smug", "smug_hold", { transitionMotion: "limb_blend", blinkMode: "special", breathScale: 0.9, pose: { x: 2, y: -2, rotation: -2, scale: 1 } }),
  confused: pose("stand", "confused", "confused_tilt", { breathScale: 0.9, pose: { x: 0, y: 1, rotation: 5, scale: 1 } }),
  love: pose("jump", "love", "love_bob", { transitionMotion: "jump_settle", breathScale: 1.05, pose: { x: 0, y: -5, rotation: 0, scale: 1.02 } }),
};

export const EXPRESSION_PARAMS = {
  neutral: { eyeOpen: 0.85, eyeSmile: 0, eyeBallX: 0, eyeBallY: 0, browL: 0, browR: 0, mouthForm: 0, cheek: 0.18 },
  happy: { eyeOpen: 0.25, eyeSmile: 1, eyeBallX: 0, eyeBallY: 0, browL: 0.1, browR: 0.1, mouthForm: 0.65, cheek: 0.35 },
  excited: { eyeOpen: 0.1, eyeSmile: 1, eyeBallX: 0, eyeBallY: 0, browL: 0.2, browR: 0.2, mouthForm: 0.75, cheek: 0.4 },
  teasing: { eyeOpen: 0.55, eyeSmile: 0.45, eyeBallX: 0.25, eyeBallY: 0, browL: 0.1, browR: -0.05, mouthForm: 0.45, cheek: 0.3 },
  pleading: { eyeOpen: 1, eyeSmile: 0, eyeBallX: 0, eyeBallY: 0.1, browL: 0.3, browR: 0.3, mouthForm: 0.2, cheek: 0.25 },
  relaxed: { eyeOpen: 0, eyeSmile: 1, eyeBallX: 0, eyeBallY: 0, browL: 0, browR: 0, mouthForm: 0.15, cheek: 0.2 },
  sick: { eyeOpen: 0.8, eyeSmile: 0, eyeBallX: 0, eyeBallY: 0.1, browL: -0.2, browR: -0.2, mouthForm: -0.25, cheek: 0.15 },
  angry: { eyeOpen: 0.5, eyeSmile: 0, eyeBallX: 0, eyeBallY: -0.05, browL: -0.75, browR: -0.75, mouthForm: -0.6, cheek: 0.1 },
  annoyed: { eyeOpen: 0.58, eyeSmile: 0, eyeBallX: -0.25, eyeBallY: 0, browL: 0.25, browR: -0.2, mouthForm: -0.35, cheek: 0.12 },
  sad: { eyeOpen: 0.9, eyeSmile: 0, eyeBallX: 0, eyeBallY: 0.15, browL: 0.55, browR: 0.55, mouthForm: -0.45, cheek: 0.3 },
  surprised: { eyeOpen: 1, eyeSmile: 0, eyeBallX: 0, eyeBallY: -0.05, browL: 0.75, browR: 0.75, mouthForm: 0, cheek: 0.18 },
  embarrassed: { eyeOpen: 0.55, eyeSmile: 0.1, eyeBallX: 0.35, eyeBallY: 0, browL: 0.15, browR: 0.15, mouthForm: 0.25, cheek: 0.65 },
  scared: { eyeOpen: 0.95, eyeSmile: 0, eyeBallX: 0, eyeBallY: 0, browL: 0.5, browR: 0.5, mouthForm: -0.1, cheek: 0.2 },
  smug: { eyeOpen: 0.45, eyeSmile: 0.25, eyeBallX: 0.3, eyeBallY: -0.05, browL: -0.05, browR: 0.1, mouthForm: 0.5, cheek: 0.25 },
  confused: { eyeOpen: 0.7, eyeSmile: 0, eyeBallX: -0.1, eyeBallY: 0.2, browL: 0.7, browR: -0.1, mouthForm: -0.05, cheek: 0.2 },
  love: { eyeOpen: 0.2, eyeSmile: 1, eyeBallX: 0, eyeBallY: 0, browL: 0.15, browR: 0.15, mouthForm: 0.75, cheek: 0.55 },
};

export const VISEMES = {
  CLOSED: { mouthOpen: 0, mouthForm: 0, mouthPart: "mouthClosed" },
  A: { mouthOpen: 0.8, mouthForm: 0.05, mouthPart: "mouthA" },
  I: { mouthOpen: 0.36, mouthForm: 0.2, mouthPart: "mouthSmall" },
  U: { mouthOpen: 0.52, mouthForm: -0.12, mouthPart: "mouthA" },
  E: { mouthOpen: 0.45, mouthForm: 0.12, mouthPart: "mouthSmall" },
  O: { mouthOpen: 0.72, mouthForm: -0.08, mouthPart: "mouthWide" },
};
