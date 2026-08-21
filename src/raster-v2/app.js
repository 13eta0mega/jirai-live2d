(() => {
  'use strict';
  const A='assets/runtime-v2/';
  const ASSETS={
    base:A+'stand_faceblank.png',
    eyeOpenL:A+'eye_open_l.png',eyeOpenR:A+'eye_open_r.png',eyeClosedL:A+'eye_closed_l.png',eyeClosedR:A+'eye_closed_r.png',eyeWinkR:A+'eye_wink_r.png',
    mouthClosed:A+'mouth_closed.png',mouthOpen:A+'mouth_open.png',
    stand:'assets/source/jirai_stand.png',jump:'assets/source/jirai_jump.png',peace:'assets/source/jirai_peace.png',uruuru:'assets/source/jirai_uruuru.png',gorogoro:'assets/source/jirai_gorogoro.png',haku:'assets/source/jirai_haku.png'
  };
  const EMOTIONS=[
    ['neutral','기본','rig'],['happy','행복','rig'],['excited','신남','jump'],['teasing','윙크','peace'],
    ['pleading','울망','uruuru'],['relaxed','느긋','gorogoro'],['sick','아픔','haku'],['angry','화남','rig'],
    ['annoyed','삐짐','rig'],['sad','슬픔','uruuru'],['surprised','놀람','rig'],['embarrassed','부끄러움','rig'],
    ['scared','겁남','haku'],['smug','의기양양','peace'],['confused','갸웃','rig'],['love','좋아!','jump']
  ];
  const img={};
  const load=(src)=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=(t)=>t*t*(3-2*t);
  const canvas=document.getElementById('avatarCanvas'),ctx=canvas.getContext('2d',{alpha:true});
  const grid=document.getElementById('emotionGrid');
  const fpsChip=document.getElementById('fpsChip'),modeChip=document.getElementById('modeChip'),assetChip=document.getElementById('assetChip');
  const emotionLabel=document.getElementById('emotionLabel'),stateLabel=document.getElementById('stateLabel');
  const blinkToggle=document.getElementById('blinkToggle'),breathToggle=document.getElementById('breathToggle'),lipToggle=document.getElementById('lipToggle'),pixelToggle=document.getElementById('pixelToggle');
  const mouthSlider=document.getElementById('mouthSlider'),mouthValue=document.getElementById('mouthValue'),mouthReadout=document.getElementById('mouthReadout'),fpsTarget=document.getElementById('fpsTarget');
  const wave=document.getElementById('wave');
  for(let i=0;i<54;i++){const b=document.createElement('i');b.style.height=(5+Math.random()*14)+'px';wave.appendChild(b)}
  let emotion='neutral',previous='neutral',transitionStart=0,transitionMs=240;
  let mouthManual=0,mouth=0,blink=1,nextBlink=performance.now()+2400,blinkStart=-1;
  let last=0,lastDraw=0,frames=[],cycleTimer=null,qaTimer=null;
  let logicalFps=30;
  const configs={
    neutral:{eyes:'open',mouth:.0,rot:0,scale:1,y:0},
    happy:{eyes:'closed',mouth:.38,rot:0,scale:1.015,y:-2},
    angry:{eyes:'open',mouth:.0,rot:-1.2,scale:1.01,y:2,shake:.7},
    annoyed:{eyes:'open',mouth:.0,rot:2.4,scale:1,y:1,x:3},
    surprised:{eyes:'open',mouth:.82,rot:0,scale:1.025,y:-2},
    embarrassed:{eyes:'open',mouth:.14,rot:-2.4,scale:1,y:2,x:-2},
    confused:{eyes:'open',mouth:.04,rot:5.5,scale:1,y:1,x:1},
  };
  const modes=Object.fromEntries(EMOTIONS.map(([id,,m])=>[id,m]));
  const labels=Object.fromEntries(EMOTIONS.map(([id,l])=>[id,l]));
  function setupButtons(){EMOTIONS.forEach(([id,label,mode])=>{const b=document.createElement('button');b.dataset.id=id;b.innerHTML=`${label}<small>${mode==='rig'?'RIG':'POSE'}</small>`;b.onclick=()=>setEmotion(id);grid.appendChild(b)});updateButtons()}
  function updateButtons(){[...grid.children].forEach(b=>b.classList.toggle('active',b.dataset.id===emotion));emotionLabel.textContent=labels[emotion];modeChip.textContent=(modes[emotion]==='rig'?'RIG':'POSE');stateLabel.textContent=modes[emotion]==='rig'?'idle · blink · breath · lip':'reference pose · cross-fade'}
  function setEmotion(id){if(!modes[id]||id===emotion)return;previous=emotion;emotion=id;transitionStart=performance.now();updateButtons()}
  function drawPart(im,x,y,w,h,alpha=1){if(!im||alpha<=.002)return;ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(im,x,y,w,h);ctx.restore()}
  function drawRig(id,t,alpha=1){
    const c=configs[id]||configs.neutral,base=img.base;if(!base)return;
    const breath=breathToggle.checked?Math.sin(t*1.55)*1.8:0;
    const sway=breathToggle.checked?Math.sin(t*.74)*.45:0;
    const shake=c.shake?Math.sin(t*22)*c.shake:0;
    const scale=1.62*(c.scale||1),x=360+(c.x||0)+shake,y=357+(c.y||0)+breath;
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate((c.rot+sway)*Math.PI/180);ctx.scale(scale,scale);
    ctx.drawImage(base,-base.width/2,-base.height/2);
    const bx=-base.width/2,by=-base.height/2;
    const eyeBlend=blinkToggle.checked?blink:1;
    if(c.eyes==='closed'){
      drawPart(img.eyeClosedL,bx+88,by+92,31,31,1);drawPart(img.eyeClosedR,bx+140,by+92,32,31,1);
    }else{
      drawPart(img.eyeOpenL,bx+87,by+91,34,33,eyeBlend);drawPart(img.eyeOpenR,bx+139,by+91,34,33,eyeBlend);
      drawPart(img.eyeClosedL,bx+88,by+92,31,31,1-eyeBlend);drawPart(img.eyeClosedR,bx+140,by+92,32,31,1-eyeBlend);
    }
    const m=clamp(Math.max(mouth,c.mouth||0));
    drawPart(img.mouthClosed,bx+109,by+121,41,30,1-clamp(m*1.6));
    if(m>.025){const mh=38*(.45+.8*m),my=by+119+(38-mh)*.5;drawPart(img.mouthOpen,bx+108,my,43,mh,clamp(m*1.25))}
    ctx.restore();
    if(id==='love'||id==='embarrassed')drawHearts(t,alpha);
  }
  function drawPose(id,t,alpha=1){
    const key=modes[id],im=img[key];if(!im)return;
    let scale=Math.min(520/im.width,490/im.height),x=360,y=355,rot=0;
    if(key==='jump'){y=340+Math.sin(t*3)*4;scale*=1.02}
    if(key==='gorogoro'){scale*=1.08;y=375;rot=-1}
    if(key==='haku'){scale*=1.04;y=360}
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(rot*Math.PI/180);ctx.scale(scale,scale);ctx.drawImage(im,-im.width/2,-im.height/2);ctx.restore();
    if(id==='love')drawHearts(t,alpha);
  }
  function drawHearts(t,alpha){ctx.save();ctx.globalAlpha*=alpha*.72;ctx.font='28px system-ui';ctx.fillStyle='#ff5f9e';for(let i=0;i<4;i++){const x=250+i*70+Math.sin(t*1.4+i)*12,y=185+((t*28+i*37)%110);ctx.fillText('♥',x,y)}ctx.restore()}
  function drawEntity(id,t,alpha){if(modes[id]==='rig')drawRig(id,t,alpha);else drawPose(id,t,alpha)}
  function updateBlink(now){
    if(!blinkToggle.checked){blink=1;return}
    if(blinkStart<0&&now>=nextBlink)blinkStart=now;
    if(blinkStart>=0){const p=(now-blinkStart)/330;if(p<.34)blink=1-smooth(p/.34);else if(p<.55)blink=0;else blink=smooth((p-.55)/.45);if(p>=1){blink=1;blinkStart=-1;nextBlink=now+2600+Math.random()*3600}}
  }
  function render(now){
    requestAnimationFrame(render);logicalFps=Number(fpsTarget.value);if(now-lastDraw<1000/logicalFps)return;lastDraw=now;
    const dt=Math.min(50,now-(last||now));last=now;const t=now/1000;updateBlink(now);
    const auto=lipToggle.checked?clamp(.1+.82*Math.abs(Math.sin(t*4.9)*(.55+.45*Math.sin(t*1.3)))):mouthManual;
    mouth+=(auto-mouth)*(1-Math.exp(-dt*.025));
    ctx.clearRect(0,0,720,720);
    const g=ctx.createRadialGradient(360,260,30,360,330,320);g.addColorStop(0,'rgba(255,120,177,.10)');g.addColorStop(1,'rgba(255,120,177,0)');ctx.fillStyle=g;ctx.fillRect(0,0,720,720);
    const p=clamp((now-transitionStart)/transitionMs);if(p<1&&previous!==emotion){const e=smooth(p);drawEntity(previous,t,1-e);drawEntity(emotion,t,e)}else drawEntity(emotion,t,1);
    if(pixelToggle.checked){ctx.save();ctx.globalAlpha=.12;ctx.fillStyle='#fff';for(let y=0;y<720;y+=3)ctx.fillRect(0,y,720,1);ctx.restore()}
    frames.push(now);while(frames[0]<now-1000)frames.shift();fpsChip.textContent=frames.length+' FPS';mouthValue.textContent=mouthManual.toFixed(2);mouthReadout.textContent='Mouth '+mouth.toFixed(2);
    [...wave.children].forEach((b,i)=>{const h=lipToggle.checked?6+Math.abs(Math.sin(t*4+i*.47))*20*(.2+mouth):5+Math.abs(Math.sin(t*.9+i*.41))*5;b.style.height=h+'px'});
  }
  async function init(){
    setupButtons();
    const pairs=await Promise.all(Object.entries(ASSETS).map(async([k,s])=>[k,await load(s)]));Object.assign(img,Object.fromEntries(pairs));
    fetch('firmware_pack/manifest.json').then(r=>r.json()).then(m=>assetChip.textContent=Math.round(m.total_png_bytes/1024)+' KB').catch(()=>assetChip.textContent='< 400 KB');
    transitionStart=performance.now()-transitionMs;requestAnimationFrame(render);
  }
  mouthSlider.oninput=()=>{mouthManual=Number(mouthSlider.value);lipToggle.checked=false};
  fpsTarget.onchange=()=>{frames=[]};
  document.getElementById('resetBtn').onclick=()=>{clearInterval(cycleTimer);cycleTimer=null;clearInterval(qaTimer);qaTimer=null;mouthManual=0;mouthSlider.value='0';lipToggle.checked=false;blinkToggle.checked=true;breathToggle.checked=true;setEmotion('neutral')};
  document.getElementById('cycleBtn').onclick=()=>{clearInterval(cycleTimer);let i=0;setEmotion(EMOTIONS[0][0]);cycleTimer=setInterval(()=>{i=(i+1)%EMOTIONS.length;setEmotion(EMOTIONS[i][0])},1450)};
  document.getElementById('qaBtn').onclick=()=>{clearInterval(qaTimer);setEmotion('neutral');lipToggle.checked=true;blinkToggle.checked=true;let n=0;qaTimer=setInterval(()=>{n++;if(n%3===0){blinkStart=performance.now();nextBlink=Infinity}if(n>8){clearInterval(qaTimer);qaTimer=null;nextBlink=performance.now()+1200}},500)};
  init().catch(err=>{console.error(err);stateLabel.textContent='asset load error'});
})();
