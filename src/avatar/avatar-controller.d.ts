export type EmotionId =
  | "neutral" | "happy" | "excited" | "teasing" | "pleading" | "relaxed" | "sick"
  | "angry" | "annoyed" | "sad" | "surprised" | "embarrassed" | "scared" | "smug"
  | "confused" | "love";

export type Viseme = "A" | "I" | "U" | "E" | "O" | "CLOSED";

export interface EmotionOptions {
  immediate?: boolean;
  intensity?: number;
  duration?: number;
}

export interface AvatarController {
  setEmotion(id: EmotionId, options?: EmotionOptions): Promise<void>;
  setMouthOpen(value: number): void;
  setViseme(viseme: Viseme, weight?: number): void;
  setLipSyncTest(enabled: boolean): void;
  setBlinkEnabled(enabled: boolean): void;
  setBreathEnabled(enabled: boolean): void;
  reset(): Promise<void>;
}

