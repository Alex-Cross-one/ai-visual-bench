'use strict';
// Preview-only isolation and lifecycle. Original artifact files are never rewritten.
window.createPreviewManager = ({readSource, runs, icon, esc, translate, localize}) => {
  const panels=new Set();
  let sequence=0, panelOrder=0, reconcileTimer;
  // These session choices survive rerenders/routes, but never persist beyond this page.
  const manuallyStopped=new Set(), failedRuns=new Map();
  function visible(panel,retaining=false){
    if(document.hidden||panel.node.isConnected===false)return false;
    for(let node=panel.node;node;node=node.parentElement)if(node.hidden||(node.tagName?.toLowerCase()==='dialog'&&!node.open))return false;
    const dialogs=[...document.querySelectorAll('dialog')].filter(dialog=>dialog.open),modal=dialogs.at(-1);
    if(modal&&!modal.contains(panel.node))return false;
    if(document.fullscreenElement&&!document.fullscreenElement.contains(panel.node))return false;
    const box=panel.stage.getBoundingClientRect();
    const height=Math.min(box.bottom,window.innerHeight)-Math.max(box.top,document.fullscreenElement?0:62);
    const width=Math.min(box.right,window.innerWidth)-Math.max(box.left,0);
    return width>30&&height>=(retaining?16:Math.min(48,box.height*.1));
  }
  function refresh(){clearTimeout(reconcileTimer);reconcileTimer=setTimeout(reconcile,180);}
  function reconcile(){
    if(document.hidden){stopAll('页面已切到后台，作品已停止');return;}
    for(const panel of panels)if(panel.active&&!visible(panel,true))stop(panel,'已离开可见区域，作品已停止');
    const candidates=[...panels].filter(panel=>visible(panel)&&!manuallyStopped.has(panel.model.id)&&!failedRuns.has(panel.model.id));
    candidates.sort((a,b)=>{const x=a.stage.getBoundingClientRect(),y=b.stage.getBoundingClientRect();return x.top-y.top||x.left-y.left||a.order-b.order;});
    // A visible running scene keeps its slot, preventing boundary jitter from restarting it.
    const cap=6;
    let count=[...panels].filter(panel=>panel.active).length;
    for(const panel of candidates){if(panel.active)continue;if(count<cap){start(panel);count++;}else setStatus(panel,'已达到同时运行上限，可点击切换');}
  }
  const policy="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none';";
  const markup=(model,context='normal')=>`<section class="live-preview" data-live-id="${esc(model.id)}" data-live-context="${context}" aria-label="${esc(model.model)} HTML 交互作品"><header class="live-model-heading"><h3>${esc(model.model)}</h3><span>${model.rendering==='svg'?'HTML / SVG':'HTML / WEBGL'}</span></header><div class="live-stage"><div class="live-idle"><span class="live-code-icon">${icon('code')}</span><span class="live-kind">${model.rendering==='svg'?'HTML / SVG':'HTML / WEBGL'}</span><h3>${esc(model.model)}</h3><p>直接运行模型生成的原始 HTML</p><button class="button primary live-start" type="button"><span class="icon">${icon('play')}</span>运行作品</button><span class="live-idle-note">可见时自动运行 · 查看原始 HTML 作品</span></div></div><div class="live-controls"><span class="live-status" role="status">进入可见区域后自动运行</span><div class="live-actions"><button class="text-button live-reload" type="button" hidden>重新载入</button><button class="text-button live-stop" type="button" hidden>停止</button><button class="text-button live-fullscreen" type="button" hidden aria-label="全屏查看作品"><span class="icon">${icon('expand')}</span>全屏</button></div></div><div class="live-error" role="status" hidden></div></section>`;
  const setStatus=(panel,text)=>{panel.status.textContent=translate(text);};
  function stop(panel,message='已停止，点击可重新运行',keepFullscreen=false){
    if(!keepFullscreen&&document.fullscreenElement===panel.node)document.exitFullscreen?.().catch(()=>{});
    panel.revision++;panel.active=false;clearTimeout(panel.timeout);panel.resize?.disconnect();panel.resize=null;
    panel.frame=null;panel.stage.innerHTML=panel.idle;
    panel.node.classList.remove('is-live');
    panel.node.querySelector('.live-start')?.addEventListener('click',()=>start(panel,true));
    for(const button of panel.actions)button.hidden=true;
    panel.error.hidden=true;panel.error.textContent='';setStatus(panel,message);
    if(failedRuns.has(panel.model.id)&&!manuallyStopped.has(panel.model.id)){reportError(panel,failedRuns.get(panel.model.id));setStatus(panel,'上次运行报告错误，点击可重试');}
    localize(panel.node);
  }
  const stopAll=(message)=>{for(const panel of panels)if(panel.active)stop(panel,message);};
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(refresh,{threshold:[0,.05,.1,.2,.4,.6,.8,1]}):null;
  function release(root){for(const panel of [...panels])if(root===panel.node||root.contains(panel.node)){stop(panel);observer?.unobserve(panel.node);panels.delete(panel);}refresh();}
  function reportError(panel,message){failedRuns.set(panel.model.id,String(message).slice(0,400));panel.fault=true;panel.error.hidden=false;panel.error.textContent=translate('运行时报告：')+translate(String(message).slice(0,400));setStatus(panel,'作品或依赖报告错误；原始结果未作修复');}
  async function start(panel,manual=false){
    if(panel.active&&!manual)return;
    if(manual){manuallyStopped.delete(panel.model.id);failedRuns.delete(panel.model.id);}
    // Reserve capacity before fetching. The cap applies across every surface.
    if(panel.active)stop(panel,undefined,true);
    const active=[...panels].filter(other=>other.active);
    if(active.length>=6)stop(active[0],'已达到同时运行上限，可点击切换');
    panel.active=true;panel.fault=false;const revision=++panel.revision;
    const startButton=panel.node.querySelector('.live-start');if(startButton){startButton.disabled=true;startButton.textContent=translate('正在载入…');}
    setStatus(panel,'正在读取原始 HTML 与外部依赖…');panel.error.hidden=true;panel.node.querySelector('.live-stop').hidden=false;
    try{
      const source=await readSource(panel.model);if(revision!==panel.revision||!panel.active)return;
      const frame=document.createElement('iframe');panel.frame=frame;
      frame.className='live-frame';frame.title=translate(`${panel.model.model} 原始 HTML 沙箱预览`);frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');
      const channel=`preview-${++sequence}`;panel.channel=channel;
      // Messages report only runtime state; source-window and channel checks isolate previews.
      const monitor=`<script>(()=>{const send=(type,message)=>parent.postMessage({channel:${JSON.stringify(channel)},type,message},'*');const error=console.error.bind(console);console.error=(...args)=>{error(...args);send('error',args.map(value=>String(value?.message||value)).join(' '));};addEventListener('error',event=>send('error',event.message||('Resource failed: '+(event.target?.src||event.target?.href||'unknown'))),true);addEventListener('unhandledrejection',event=>send('error',String(event.reason?.message||event.reason)));addEventListener('webglcontextlost',()=>send('error','WebGL context lost'),true);addEventListener('load',()=>send('loaded',''));})();<\/script>`;
      const prefix=`<meta http-equiv="Content-Security-Policy" content="${policy}">${monitor}`;
      frame.srcdoc=/<head\b[^>]*>/i.test(source)?source.replace(/<head\b[^>]*>/i,match=>match+prefix):prefix+source;
      panel.stage.replaceChildren(frame);panel.node.classList.add('is-live');for(const button of panel.actions)button.hidden=false;
      const resize=()=>{if(!panel.frame)return;const box=panel.stage.getBoundingClientRect();if(!box.width||!box.height)return;const width=960,height=552,scale=Math.min(box.width/width,box.height/height);frame.style.width=`${width}px`;frame.style.height=`${height}px`;frame.style.left='50%';frame.style.top='50%';frame.style.transformOrigin='center';frame.style.transform=`translate(-50%, -50%) scale(${scale})`;};
      if(typeof ResizeObserver==='function'){panel.resize=new ResizeObserver(resize);panel.resize.observe(panel.stage);}resize();
      panel.timeout=setTimeout(()=>{if(panel.active&&!panel.fault)setStatus(panel,'仍在载入；网络或 WebGL 限制可能影响画面');},15000);
    }catch(error){if(revision!==panel.revision)return;stop(panel,'暂时无法载入，请重试或查看原始截图');reportError(panel,error.message);}
  }
  function mount(root){root.querySelectorAll('[data-live-id]').forEach(node=>{
    const model=runs.get(node.dataset.liveId);if(!model)return;
    const stage=node.querySelector('.live-stage');const panel={node,model,stage,context:node.dataset.liveContext,order:panelOrder++,revision:0,active:false,idle:stage.innerHTML,status:node.querySelector('.live-status'),error:node.querySelector('.live-error'),actions:['.live-reload','.live-stop','.live-fullscreen'].map(selector=>node.querySelector(selector))};panels.add(panel);
    node.querySelector('.live-start').addEventListener('click',()=>start(panel,true));
    node.querySelector('.live-reload').addEventListener('click',()=>start(panel,true));
    node.querySelector('.live-stop').addEventListener('click',()=>{manuallyStopped.add(panel.model.id);stop(panel);panel.node.querySelector('.live-start')?.focus();refresh();});
    node.querySelector('.live-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(node.requestFullscreen)await node.requestFullscreen();else setStatus(panel,'此浏览器不支持全屏，请打开作品详情');}catch{setStatus(panel,'全屏未能开启，请打开作品详情');}});
    if(manuallyStopped.has(model.id))setStatus(panel,'已停止，点击可重新运行');
    else if(failedRuns.has(model.id)){reportError(panel,failedRuns.get(model.id));setStatus(panel,'上次运行报告错误，点击可重试');}
    observer?.observe(node);localize(node);
  });refresh();}
  window.addEventListener('message',event=>{
    const panel=[...panels].find(item=>item.active&&item.frame?.contentWindow===event.source&&item.channel===event.data?.channel);if(!panel)return;
    if(event.data.type==='error')reportError(panel,event.data.message);
    if(event.data.type==='loaded'){clearTimeout(panel.timeout);if(!panel.fault)setStatus(panel,'HTML 已载入 · 按原始作品呈现');}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll('页面已切到后台，作品已停止');else refresh();});
  document.addEventListener('fullscreenchange',refresh);
  window.addEventListener('scroll',refresh,true);
  window.addEventListener('resize',refresh);
  window.addEventListener('pagehide',()=>stopAll());
  window.addEventListener('pageshow',refresh);
  return {markup,mount,release,stopAll,refresh};
};
