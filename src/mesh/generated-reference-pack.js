const EMOTIONS = ['neutral','happy','excited','angry','embarrassed','surprised','scared','teasing','love'];
const ROOT = 'assets/reference/v0.4/_encoded';

function loadDataImage(url, emotion) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`generated reference decode failed: ${emotion}`));
    image.src = url;
  });
}

async function loadEmotion(emotion) {
  const response = await fetch(`${ROOT}/${emotion}.avif.b64`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`generated reference fetch failed: ${emotion} (${response.status})`);
  const base64 = (await response.text()).trim();
  if (base64.length < 1000 || base64.length % 4 !== 0) throw new Error(`generated reference payload invalid: ${emotion}`);
  return [emotion, await loadDataImage(`data:image/avif;base64,${base64}`, emotion)];
}

export async function loadGeneratedReferencePack() {
  return Object.fromEntries(await Promise.all(EMOTIONS.map(loadEmotion)));
}

export const GENERATED_REFERENCE_PACK_EMOTIONS = EMOTIONS;
