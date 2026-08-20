import { FALLBACK_PRESETS } from '../src/avatar/data.js';
import { createMeshAvatar } from './controller.js';

const EMOTIONS = ['neutral','happy','excited','teasing','pleading','relaxed','sick','angry','annoyed','sad','surprised','embarrassed','scared','smug','confused','love'];
const LABELS = { neutral:'중립', happy:'행복', excited:'신남', teasing:'장난', pleading:'애원', relaxed:'편안', sick:'아픔', angry:'화남', annoyed:'짜증', sad:'슬픔', surprised:'놀람', embarrassed:'당황', scared:'무서움', smug:'의기양양', confused:'혼란', love:'사랑' };
const SOURCE_KEYS = { 'jirai_stand.png':'stand','jirai_jump.png':'jump','jirai_peace.png':'peace','jirai_uruuru.png':'uruuru','jirai_gorogoro.png':'gorogoro','jirai_haku.png':'haku' };
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizePresets(config) {
  const raw = config?.presets || config;
  if (!raw || typeof raw !== 'object') return FALLBACK_PRESETS;
  return Object.fromEntries(Object.entries(raw).map(([id,preset]) => [id,{...preset,source:SOURCE_KEYS[preset.source]||preset.source}]));
}
async function loadPresets(){
  try { const r=await fetch('../config/emotion_presets.json',{cache:'no-store'}); if(!r.ok) throw new Error(); return normalizePresets(await r.json()); }
  catch { return FALLBACK_PRESETS; }
}
async function loadMeshOptions(){
  try { const r=await fetch('../config/mesh_rig.json',{cache:'no-store'}); if(!r.ok) throw new Error(); return (await r.json()).grid||{}; }
  catch { return {columns:24,rows:28}; }
}
function setStatus(message){ $('status').textContent = message; }
function makeEmotionButtons(container,onSelect){
  for(const id of EMOTIONS){ const b=document.createElement('button'); b.type='button'; b.dataset.emotion=id; b.textContent=LABELS[id]; b.title=id; b.addEventListener('click',()=>onSelect(id)); container.appendChild(b); }
}
function formatParams(s){
  const t=s.transition?`${s.transition.from}->${s.transition.to} ${(s.transition.progress*100).toFixed(0)}%`:'idle';
  const rb=s.referenceBlend?`ref from=${s.referenceBlend.from.toFixed(2)} art=${s.referenceBlend.articulated.toFixed(2)} to=${s.referenceBlend.to.toFixed(2)}`:'n/a';
  return [`renderer ${s.renderer}`,`transition ${t}`,`hybrid ${rb}`,`viseme ${s.viseme}`,`mouth ${s.mouthOpen.toFixed(3)}`,...Object.entries(s.parameters||{}).slice(0,18).map(([k,v])=>`${k} ${Number(v).toFixed(3)}`)].join('\n');
}
async function runVisemeSweep(avatar,emotion){ await avatar.setEmotion(emotion,{duration:650}); for(const viseme of ['A','I','U','E','O','CLOSED']){ avatar.setViseme(viseme,viseme==='CLOSED'?0:0.92); await sleep(180); } }
async function runStrictQA(avatar){
  setStatus('v0.4 QA: 감정 전환 중…');
  for(const e of EMOTIONS){ await avatar.setEmotion(e,{duration:e==='excited'?900:700}); await sleep(260); }
  setStatus('v0.4 QA: 16감정 × 6 viseme 검사 중…');
  for(const e of EMOTIONS) await runVisemeSweep(avatar,e);
  avatar.setViseme('CLOSED',0); await avatar.setEmotion('neutral',{duration:700}); setStatus('v0.4 QA 시나리오 완료');
}
async function main(){
  const avatar=await createMeshAvatar($('avatarCanvas'),await loadPresets(),await loadMeshOptions()); window.__jiraiAvatar=avatar;
  const buttons=$('emotionButtons'); const mouth=$('mouthSlider'); const mic=$('microphoneButton'); const lipTest=$('lipSyncTest'); let busy=false;
  makeEmotionButtons(buttons,(id)=>avatar.setEmotion(id,{duration:760}).catch(e=>setStatus(e.message)));
  mouth.addEventListener('input',()=>avatar.setMouthOpen(Number(mouth.value)));
  lipTest.addEventListener('change',async(e)=>{ if(e.target.checked&&avatar.getSnapshot().lipSyncMode==='microphone') await avatar.stopMicrophoneLipSync(); avatar.setLipSyncTest(e.target.checked); });
  mic.addEventListener('click',async()=>{ if(busy)return; busy=true; try{ if(avatar.getSnapshot().lipSyncMode==='microphone'){await avatar.stopMicrophoneLipSync();mic.textContent='마이크 립싱크 시작';} else {lipTest.checked=false;avatar.setLipSyncTest(false);await avatar.startMicrophoneLipSync();mic.textContent='마이크 립싱크 중지';} }catch(e){setStatus(`마이크 오류: ${e.message}`);} finally{busy=false;} });
  $('autoBlink').addEventListener('change',e=>avatar.setBlinkEnabled(e.target.checked)); $('breath').addEventListener('change',e=>avatar.setBreathEnabled(e.target.checked)); $('showBounds').addEventListener('change',e=>avatar.setDebug({showBounds:e.target.checked})); $('showParameters').addEventListener('change',e=>$('params').hidden=!e.target.checked);
  $('resetButton').addEventListener('click',()=>avatar.reset()); $('qaButton').addEventListener('click',()=>runStrictQA(avatar));
  $('cycleButton').addEventListener('click',async()=>{for(const e of EMOTIONS){await avatar.setEmotion(e,{duration:700});await sleep(250);}});
  let last=0; const tick=(time)=>{ if(time-last>80){last=time;const s=avatar.getSnapshot();$('emotionNow').textContent=`${LABELS[s.emotion]||s.emotion} (${s.emotion})`; $('mouthValue').textContent=s.mouthOpen.toFixed(2); $('blinkValue').textContent=s.blinkLevel.toFixed(2); $('fpsValue').textContent=`${s.fps} FPS · v0.4 preview`; $('visemeValue').textContent=s.viseme; $('audioMode').textContent=s.lipSyncMode; $('audioLevel').textContent=Number(s.audio?.rms||0).toFixed(3); $('audioMeterFill').style.width=`${Math.min(100,(s.audio?.rms||0)*520)}%`; $('params').textContent=formatParams(s); for(const b of buttons.querySelectorAll('button')) b.classList.toggle('active',b.dataset.emotion===s.emotion); } requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  setStatus('v0.4.0-alpha.1 preview · 10 generated endpoints + articulated middle motion + 16-emotion viseme rig');
  window.addEventListener('pagehide',()=>void avatar.destroy(),{once:true});
}
main().catch(e=>{console.error(e);setStatus(`초기화 실패: ${e.message}`);});
