export type EmotionId =
  | "neutral" | "happy" | "excited" | "teasing" | "pleading" | "relaxed" | "sick"
  | "angry" | "annoyed" | "sad" | "surprised" | "embarrassed" | "scared" | "smug"
  | "confused" | "love";
export type Viseme = "A" | "I" | "U" | "E" | "O" | "CLOSED";
export type LipSyncMode = "manual" | "test" | "microphone" | "external";
export interface EmotionOptions { immediate?: boolean; intensity?: number; duration?: number; }
export interface AudioFeatures { rms: number; low?: number; mid?: number; high?: number; }
export interface AvatarSnapshot {
  emotion: EmotionId; mouthOpen: number; mouthForm: number; viseme: Viseme; lipSyncMode: LipSyncMode;
  blinkLevel: number; breath: number; fps: number; parameters: Record<string, number>;
  audio: AudioFeatures & { noiseFloor?: number; open?: number; weight?: number; viseme?: Viseme };
}
export interface AvatarController {
  setEmotion(id: EmotionId, options?: EmotionOptions): Promise<void>;
  setMouthOpen(value: number): void;
  setViseme(viseme: Viseme, weight?: number): void;
  setLipSyncTest(enabled: boolean): void;
  startMicrophoneLipSync(): Promise<boolean>;
  stopMicrophoneLipSync(options?: { preserveMode?: boolean }): Promise<void>;
  setAudioFeatures(features: AudioFeatures): void;
  clearAudioFeatures(): void;
  setBlinkEnabled(enabled: boolean): void;
  setBreathEnabled(enabled: boolean): void;
  getSnapshot(): AvatarSnapshot;
  reset(): Promise<void>;
  destroy(): Promise<void>;
}
