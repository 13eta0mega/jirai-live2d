export const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const bandEnergy = (frequencyData, sampleRate, analyserSize, minHz, maxHz) => {
  if (!frequencyData?.length || !sampleRate || !analyserSize) return 0;
  const hzPerBin = sampleRate / analyserSize;
  const start = Math.max(0, Math.floor(minHz / hzPerBin));
  const end = Math.min(frequencyData.length - 1, Math.ceil(maxHz / hzPerBin));
  if (end < start) return 0;
  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    const normalized = frequencyData[i] / 255;
    sum += normalized * normalized;
    count += 1;
  }
  return count ? Math.sqrt(sum / count) : 0;
};

export function analyseSpectrum(timeData, frequencyData, sampleRate = 48000, analyserSize = 2048) {
  let sumSquares = 0;
  if (timeData?.length) {
    for (const sample of timeData) {
      const centered = (sample - 128) / 128;
      sumSquares += centered * centered;
    }
  }
  const rms = timeData?.length ? Math.sqrt(sumSquares / timeData.length) : 0;
  return {
    rms,
    low: bandEnergy(frequencyData, sampleRate, analyserSize, 90, 420),
    mid: bandEnergy(frequencyData, sampleRate, analyserSize, 420, 2200),
    high: bandEnergy(frequencyData, sampleRate, analyserSize, 2200, 6200),
  };
}

export function classifyViseme(features, noiseFloor = 0.018) {
  const rms = Math.max(0, Number(features?.rms) || 0);
  if (rms <= noiseFloor * 1.35) return "CLOSED";
  const low = Math.max(0, Number(features?.low) || 0);
  const mid = Math.max(0, Number(features?.mid) || 0);
  const high = Math.max(0, Number(features?.high) || 0);
  const total = low + mid + high + 1e-6;
  const lr = low / total;
  const mr = mid / total;
  const hr = high / total;

  if (hr > 0.41 && mr > 0.28) return "I";
  if (lr > 0.56) return "O";
  if (lr > 0.44 && hr < 0.2) return "U";
  if (mr > 0.46 || (hr > 0.33 && mr > lr)) return "E";
  return "A";
}

export function createLipSyncState() {
  return {
    open: 0,
    weight: 0,
    noiseFloor: 0.018,
    viseme: "CLOSED",
    pendingViseme: "CLOSED",
    pendingMs: 0,
  };
}

export function smoothLipSync(state, features, dtMs = 16) {
  const dt = Math.max(1, Math.min(100, Number(dtMs) || 16));
  const rms = Math.max(0, Number(features?.rms) || 0);

  if (rms < state.noiseFloor * 1.6) {
    state.noiseFloor += (Math.max(0.006, rms) - state.noiseFloor) * (1 - Math.exp(-dt * 0.0015));
  }
  state.noiseFloor = Math.min(0.06, Math.max(0.006, state.noiseFloor));

  const gate = state.noiseFloor * 1.45;
  const target = clamp01((rms - gate) / Math.max(0.045, 0.22 - gate));
  const shapedTarget = target ** 0.72;
  const speed = shapedTarget > state.open ? 0.045 : 0.022;
  state.open += (shapedTarget - state.open) * (1 - Math.exp(-dt * speed));
  state.weight += (target - state.weight) * (1 - Math.exp(-dt * 0.03));

  const candidate = classifyViseme(features, state.noiseFloor);
  if (candidate === state.viseme) {
    state.pendingViseme = candidate;
    state.pendingMs = 0;
  } else if (candidate === state.pendingViseme) {
    state.pendingMs += dt;
    const hold = candidate === "CLOSED" ? 42 : 68;
    if (state.pendingMs >= hold) {
      state.viseme = candidate;
      state.pendingMs = 0;
    }
  } else {
    state.pendingViseme = candidate;
    state.pendingMs = dt;
  }

  if (state.open < 0.025) {
    state.viseme = "CLOSED";
    state.pendingViseme = "CLOSED";
    state.pendingMs = 0;
  }

  return {
    open: clamp01(state.open),
    weight: clamp01(state.weight),
    viseme: state.viseme,
    noiseFloor: state.noiseFloor,
    rms,
    low: Math.max(0, Number(features?.low) || 0),
    mid: Math.max(0, Number(features?.mid) || 0),
    high: Math.max(0, Number(features?.high) || 0),
  };
}
