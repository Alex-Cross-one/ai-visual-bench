'use strict';
(() => {
  const data = window.TEST_DATA;
  const icons = {
    previous: '<path d="m15 5-7 7 7 7"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 16v4h14v-4"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    compare: '<rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>',
    archive: '<path d="M5 8h14v12H5Z"/><path d="M3 4h18v4H3zm7 8h4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="15.5" cy="7.5" r="1.5"/>',
    code: '<path d="m7 6-6 6 6 6m10-12 6 6-6 6M14 3l-4 18"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    file: '<path d="M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h8"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.file}</svg>`;
  const hydrateIcons = (root=document) => root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML=icon(el.dataset.icon); });
  const el = id => document.getElementById(id);
  const num = value => new Intl.NumberFormat(window.UI_I18N?.numberLocale||'zh-CN').format(value);
  const localize = (root=document) => window.UI_I18N?.apply(root);
  const translate = text => window.UI_I18N?.translate(text)??text;
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selected = new Set();
  const featuredRuns=new Map();
  const sourceCache = new Map();
  let activeModel = null;
  let activeTab = 'preview';
  let detailRevision = 0;
  let announceTimer;
  const announce = text => { el('announcement').textContent=''; clearTimeout(announceTimer); announceTimer=setTimeout(()=>{el('announcement').textContent=translate(text);},50); };
  hydrateIcons();
  if (!data || !Array.isArray(data.prompts) || !Array.isArray(data.runs)) { el('prompt-list').textContent='测试数据未能载入，请刷新页面重试。'; return; }
  const prompts=data.prompts;
  const runs=new Map(data.runs.map(run=>[run.id,run]));
  const ratings=window.createRatingManager?.({runs,esc,translate,localize,num})??{markup:()=>'',mount(){},release(){}};
  const preview=window.createPreviewManager({readSource,runs,icon,esc,translate,localize});
  const categories=new Map(data.categories.map(category=>[category.id,category]));
  let models=[];
  let activePrompt=null;
  let categoryFilter='all';
  let routing=false;
  const promptRoute=id=>`#/prompts/${encodeURIComponent(id)}`;
  const promptRuns=prompt=>prompt.runIds.map(id=>runs.get(id)).filter(Boolean);
  const promptFileCount=prompt=>promptRuns(prompt).reduce((total,run)=>total+run.artifacts.length,prompt.promptArtifact?1:0);
  const navigateRun=id=>{if(activePrompt)window.location.hash=`${promptRoute(activePrompt.id)}/runs/${encodeURIComponent(id)}`;};
  el('library-total-prompts').textContent=String(prompts.length).padStart(2,'0');
  el('all-prompt-count').textContent=prompts.length;
  el('all-model-count').textContent=new Set(data.runs.map(run=>run.model)).size;
  el('all-run-count').textContent=data.runs.length;
  el('all-file-count').textContent=prompts.reduce((total,prompt)=>total+promptFileCount(prompt),0);
  function featuredMarkup(prompt){const items=promptRuns(prompt),run=runs.get(featuredRuns.get(prompt.id)||prompt.coverRunId),position=items.findIndex(item=>item.id===run.id);return `<div class="featured-viewer"><button class="feature-switch previous" data-feature-step="-1" aria-label="上一模型"><span class="icon">${icon('previous')}</span></button><div class="featured-frame">${preview.markup(run)}</div><button class="feature-switch next" data-feature-step="1" aria-label="下一模型"><span class="icon">${icon('next')}</span></button></div><div class="feature-live-note"><span>${position+1} / ${items.length}</span><a href="${promptRoute(prompt.id)}/runs/${encodeURIComponent(run.id)}">查看详情与原始记录</a></div>${ratings.markup(run)}`;}
  function bindFeatured(root){root.querySelectorAll('[data-feature-prompt]').forEach(host=>{host.querySelectorAll('[data-feature-step]').forEach(button=>{if(button.dataset.featureBound)return;button.dataset.featureBound='1';button.addEventListener('click',()=>{const prompt=prompts.find(p=>p.id===host.dataset.featurePrompt),items=promptRuns(prompt),current=items.findIndex(run=>run.id===(featuredRuns.get(prompt.id)||prompt.coverRunId));featuredRuns.set(prompt.id,items[(current+Number(button.dataset.featureStep)+items.length)%items.length].id);preview.release(host);ratings.release(host);host.innerHTML=featuredMarkup(prompt);bindFeatured(root);preview.mount(host);ratings.mount(host);localize(host);});});});}
  function renderLibrary(){
    preview.release(el('prompt-list'));ratings.release(el('prompt-list'));
    const query=el('prompt-search').value.trim().toLowerCase();
    const visible=prompts.filter(prompt=>(categoryFilter==='all'||prompt.categoryId===categoryFilter)&&[prompt.title,prompt.summary,prompt.promptText,...prompt.tags,categories.get(prompt.categoryId)?.name??''].filter(value=>typeof value==='string').flatMap(value=>[value,window.UI_I18N?.translate(value,'en')??value,window.UI_I18N?.translate(value,'zh-Hant')??value]).join(' ').toLowerCase().includes(query));
    const groups=[{id:'all',name:'全部测试',count:prompts.length},...data.categories.map(category=>({...category,count:prompts.filter(prompt=>prompt.categoryId===category.id).length})).filter(category=>category.count>0)];
    el('category-filters').innerHTML=groups.map(category=>`<button class="category-button" data-category="${esc(category.id)}" aria-pressed="${categoryFilter===category.id}"><span>${esc(category.name)}</span><span class="category-button-count">${category.count}</span></button>`).join('');
    el('category-filters').querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{categoryFilter=button.dataset.category;renderLibrary();announce(`找到 ${el('prompt-result-count').textContent}`);}));
    el('prompt-result-count').textContent=`${visible.length} 项测试`;
    el('prompt-empty').hidden=visible.length>0;
    el('prompt-list').innerHTML=visible.map((prompt,index)=>{
      const results=promptRuns(prompt),cover=runs.get(featuredRuns.get(prompt.id)||prompt.coverRunId),category=categories.get(prompt.categoryId),route=promptRoute(prompt.id);
      
      const efforts=[...new Set(results.map(run=>run.reasoning_effort))];
      return `<article class="prompt-card" data-prompt="${esc(prompt.id)}"><div class="prompt-card-head"><div class="prompt-card-copy"><div class="prompt-card-topline"><span class="prompt-number">TEST ${String(prompts.indexOf(prompt)+1).padStart(2,'0')}</span><span class="prompt-category">${esc(category?.name??'未分类')}</span></div><h2><a href="${route}">${esc(prompt.title)}</a></h2><p class="prompt-summary">${esc(prompt.summary)}</p></div><div class="prompt-card-actions"><a class="button primary prompt-open-link" href="${route}"><span class="icon">${icon('grid')}</span>查看全部 ${results.length} 份结果</a><span>${efforts.length===1?esc(efforts[0])+' 推理强度':'多种推理强度'} · ${prompt.promptFile?'同题对照':'同主题结果'}</span></div></div><div class="prompt-live-feature" data-feature-prompt="${esc(prompt.id)}">${featuredMarkup(prompt)}</div><div class="prompt-card-bottom"><div class="prompt-card-tags">${prompt.tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div><div class="prompt-run-counts"><span><strong>${results.length}</strong> 模型输出</span><span><strong>${promptFileCount(prompt)}</strong> 原始文件</span><span class="prompt-integrity">原始报错一并保留</span></div></div></article>`;
    }).join('');
    bindFeatured(el('prompt-list'));preview.mount(el('prompt-list'));ratings.mount(el('prompt-list'));
    localize(el('library-view'));
  }
  el('prompt-search').addEventListener('input',()=>{renderLibrary();announce(`找到 ${el('prompt-result-count').textContent}`);});
  el('reset-prompt-filters').addEventListener('click',()=>{categoryFilter='all';el('prompt-search').value='';renderLibrary();el('prompt-search').focus();});
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();el('main-content').focus();el('main-content').scrollIntoView?.();});
  function activatePrompt(prompt){
    if(activePrompt?.id!==prompt.id){
      selected.clear();activePrompt=prompt;models=promptRuns(prompt);el('search').value='';el('sort').value='default';renderSelection();
    }
    const category=categories.get(prompt.categoryId);
    el('workspace-title').textContent=prompt.title;
    el('breadcrumb-title').textContent=prompt.title;
    el('workspace-description').textContent=prompt.summary;
    el('workspace-code').textContent=`TEST ${String(prompts.indexOf(prompt)+1).padStart(2,'0')}`;
    el('workspace-category').textContent=category?.name??'未分类';
    el('workspace-run-count').textContent=String(models.length).padStart(2,'0');
    el('workspace-file-count').textContent=promptFileCount(prompt);
    const efforts=[...new Set(models.map(model=>model.reasoning_effort))];
    el('workspace-effort').textContent=efforts.length===1?efforts[0]:'混合';
    el('prompt-title').textContent=prompt.title;
    const hasPrompt=typeof prompt.promptText==='string'&&!!prompt.promptFile;
    el('prompt-text').textContent=hasPrompt?prompt.promptText:translate('此数据集未提供原始提示词，未根据作品内容补写。');
    el('prompt-button-title').textContent=hasPrompt?'查看完整提示词':'查看测试说明';
    el('prompt-button-description').textContent=hasPrompt?'查看这道测试的原始要求':'此数据未附原始提示词';
    el('prompt-evidence-note').textContent=hasPrompt?'原始提示词（简体中文），按原文展示':'已展示所提供的作品与运行记录';
    el('prompt-eyebrow').textContent=hasPrompt?'SHARED PROMPT':'TEST INFORMATION';
    el('prompt-download').hidden=!hasPrompt;
    el('prompt-tags').innerHTML=prompt.requirements.map(tag=>`<span>${esc(tag)}</span>`).join('');
    el('prompt-download').setAttribute('href',prompt.promptFile??'#');
    el('prompt-download').setAttribute('download',`${prompt.title}-原始提示词.md`);
    document.title=`${prompt.title} · AI 测试库`;
    renderCards();
  }
  function applyRoute(){
    preview.stopAll();
    routing=true;
    let parts=[];try{parts=window.location.hash.replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);}catch{parts=['invalid'];}
    const prompt=parts[0]==='prompts'?prompts.find(item=>item.id===parts[1]):null;
    const home=parts.length===0;
    const validPrompt=prompt&&(parts.length===2||(parts.length===4&&parts[2]==='runs'&&prompt.runIds.includes(parts[3])));
    const targetRun=validPrompt&&parts[2]==='runs'?parts[3]:null;
    const newWorkspace=(home&&activePrompt!==null)||(validPrompt&&activePrompt?.id!==prompt.id);
    if(el('detail-dialog').open&&activeModel?.id!==targetRun)el('detail-dialog').close();
    if(el('compare-dialog').open)el('compare-dialog').close();
    if(el('prompt-dialog').open)el('prompt-dialog').close();
    el('library-view').hidden=!home;el('workspace-view').hidden=!validPrompt;el('route-error').hidden=home||!!validPrompt;
    if(home){selected.clear();renderSelection();activePrompt=null;models=[];document.title='AI 测试库 · 按提示词浏览模型结果';renderLibrary();}
    else if(validPrompt){activatePrompt(prompt);if(targetRun&&activeModel?.id!==targetRun)openDetail(targetRun);}
    else{selected.clear();renderSelection();document.title='未找到测试 · AI 测试库';}
    routing=false;
    localize();
    if(newWorkspace)window.scrollTo?.({top:0,left:0,behavior:'instant'});
    preview.refresh();
  }
  window.addEventListener('hashchange',applyRoute);
  function renderCards() {
    preview.release(el('gallery'));ratings.release(el('gallery'));
    const query=el('search').value.trim().toLowerCase();
    let visible=models.filter(m=>m.model.toLowerCase().includes(query));
    const sort=el('sort').value;
    if(sort==='tokens-asc')visible.sort((a,b)=>a.total_tokens-b.total_tokens);
    if(sort==='tokens-desc')visible.sort((a,b)=>b.total_tokens-a.total_tokens);
    if(sort==='name')visible.sort((a,b)=>a.model.localeCompare(b.model));
    el('result-count').textContent=visible.length;
    el('empty-state').hidden=visible.length>0;
    el('gallery').innerHTML=visible.map((m,i)=>`<article class="model-card ${selected.has(m.id)?'is-selected':''}" data-model="${esc(m.id)}">${preview.markup(m)}${m.originalError?'<div class="card-original-error">原始报错 · 未修复</div>':''}<div class="card-content"><div class="card-title-row"><span class="family-tag">${esc(m.reasoning_effort)}</span></div><div class="card-metrics"><div><span>总 Token</span><strong>${num(m.total_tokens)}</strong></div><div><span>输出 Token</span><strong>${num(m.output_tokens)}</strong></div></div>${ratings.markup(m)}<div class="card-bottom"><button class="detail-link" data-open="${esc(m.id)}"><span class="icon">${icon('file')}</span>查看详情</button><label class="compare-toggle"><input type="checkbox" value="${esc(m.id)}" ${selected.has(m.id)?'checked':''} ${selected.size>=6&&!selected.has(m.id)?'disabled':''} aria-label="选择 ${esc(m.model)} 进行对照">加入对照</label></div></div></article>`).join('');
    el('gallery').querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>navigateRun(button.dataset.open)));
    el('gallery').querySelectorAll('input[type="checkbox"]').forEach(checkbox=>checkbox.addEventListener('change',()=>setSelection(checkbox.value,checkbox.checked)));
    preview.mount(el('gallery'));ratings.mount(el('gallery'));
    localize(el('gallery'));
  }
  function setSelection(id,checked) {
    if(checked){if(selected.size<6||selected.has(id))selected.add(id);}else selected.delete(id);
    renderSelection();
    announce(`已选择 ${selected.size} 个模型进行对照`);
  }
  function renderSelection() {
    document.querySelectorAll('.model-card').forEach(card=>{
      const chosen=selected.has(card.dataset.model);
      card.classList.toggle('is-selected',chosen);
      const checkbox=card.querySelector('input');checkbox.checked=chosen;checkbox.disabled=selected.size>=6&&!chosen;
    });
    el('compare-tray').hidden=selected.size===0;
    document.body.classList.toggle('body-with-tray',selected.size>0);
    el('selection-count').textContent=`${selected.size} / 6`;
    el('compare-open').disabled=selected.size<2;
    el('selected-models').innerHTML=[...selected].map(id=>`<span class="selected-chip">${esc(runs.get(id)?.model??id)}<button data-remove="${esc(id)}" aria-label="移除 ${esc(runs.get(id)?.model??id)}">×</button></span>`).join('');
    el('selected-models').querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>setSelection(button.dataset.remove,false)));
    localize(el('compare-tray'));
  }
  function closeDialog(dialog) { dialog.close(); }
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>closeDialog(button.closest('dialog'))));
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>preview.refresh());
    dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)closeDialog(dialog);}});
  });
  el('detail-dialog').addEventListener('close',()=>{preview.release(el('detail-content'));ratings.release(el('detail-content'));detailRevision++;activeModel=null;el('detail-content').replaceChildren();if(!routing&&activePrompt)window.history.replaceState(null,'',promptRoute(activePrompt.id));});
  el('open-prompt').addEventListener('click',()=>{preview.stopAll();el('prompt-dialog').showModal();});
  el('search').addEventListener('input',()=>{renderCards();announce(`找到 ${el('result-count').textContent} 个模型`);});
  el('sort').addEventListener('change',renderCards);
  el('clear-search').addEventListener('click',()=>{el('search').value='';renderCards();el('search').focus();});
  el('clear-selection').addEventListener('click',()=>{selected.clear();renderSelection();announce('已清空对照选择');});
  const metricMarkup = m => `<div class="metrics-grid"><dl class="metric-pair"><dt>输入 Token</dt><dd>${num(m.input_tokens)}</dd></dl><dl class="metric-pair subset"><dt>其中 · 缓存输入</dt><dd>${num(m.cached_input_tokens)}</dd></dl><dl class="metric-pair"><dt>输出 Token</dt><dd>${num(m.output_tokens)}</dd></dl><dl class="metric-pair subset"><dt>其中 · 推理输出</dt><dd>${num(m.reasoning_output_tokens)}</dd></dl><dl class="metric-pair total"><dt>总 Token</dt><dd>${num(m.total_tokens)}</dd></dl></div>`;
  function openDetail(id) {
    preview.stopAll();preview.release(el('detail-content'));ratings.release(el('detail-content'));
    activeModel=models.find(m=>m.id===id);if(!activeModel)return;
    const m=activeModel;activeTab='preview';detailRevision++;
    el('detail-content').innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">MODEL OUTPUT <span class="eyebrow-slash">/</span> ${esc(m.reasoning_effort.toUpperCase())}</p><h2 id="detail-title">${esc(m.model)}</h2></div><div class="detail-navigation"><button class="icon-button" id="previous-model" aria-label="上一模型"><span class="icon">${icon('previous')}</span></button><span>${models.findIndex(item=>item.id===m.id)+1} / ${models.length}</span><button class="icon-button" id="next-model" aria-label="下一模型"><span class="icon">${icon('next')}</span></button><button class="icon-button" id="close-detail" aria-label="关闭模型详情"><span class="icon">${icon('close')}</span></button></div></div><div class="detail-layout"><div class="detail-main"><div class="detail-tabs" role="tablist" aria-label="作品查看方式"><button id="tab-preview" class="tab-button" role="tab" aria-selected="true" aria-controls="detail-viewport" data-tab="preview"><span class="icon">${icon('play')}</span>HTML 作品</button><button id="tab-image" class="tab-button" role="tab" tabindex="-1" aria-selected="false" aria-controls="detail-viewport" data-tab="image"><span class="icon">${icon('image')}</span>截图参考</button><button id="tab-source" class="tab-button" role="tab" tabindex="-1" aria-selected="false" aria-controls="detail-viewport" data-tab="source"><span class="icon">${icon('code')}</span>HTML 源码</button></div><div id="detail-viewport" class="detail-viewport" role="tabpanel" aria-labelledby="tab-preview" tabindex="0"></div>${m.originalError?`<div class="error-note">原始结果包含错误：<code>${esc(m.originalError)}</code>。此处保留原貌，未作修复。</div>`:''}</div><aside class="detail-sidebar">${ratings.markup(m)}<p class="sidebar-eyebrow">TOKEN USAGE</p>${metricMarkup(m)}<p class="sidebar-note">总计 = 输入 + 输出。缓存输入、推理输出已包含在各自上级数据中。Token 用量不代表作品质量。</p><div class="download-links"><a class="button secondary" href="${esc(m.source)}" download="${esc(m.model)}-${esc(activePrompt.title)}.html">下载原始 HTML<span class="icon">${icon('download')}</span></a><a class="button secondary" href="${esc(m.screenshot)}" download="${esc(m.model)}-${esc(activePrompt.title)}.png">下载原始截图<span class="icon">${icon('download')}</span></a><a class="button secondary" href="${esc(m.session)}" download="${esc(m.model)}-session.json">下载会话记录<span class="icon">${icon('download')}</span></a></div></aside></div>`;
    el('previous-model').addEventListener('click',()=>navigateRun(models[(models.findIndex(item=>item.id===m.id)+models.length-1)%models.length].id));
    el('next-model').addEventListener('click',()=>navigateRun(models[(models.findIndex(item=>item.id===m.id)+1)%models.length].id));
    ratings.mount(el('detail-content'));
    el('close-detail').addEventListener('click',()=>closeDialog(el('detail-dialog')));
    const tabs=[...el('detail-content').querySelectorAll('[data-tab]')];
    tabs.forEach((button,index)=>{
      button.addEventListener('click',()=>setTab(button.dataset.tab));
      button.addEventListener('keydown',event=>{let target;if(event.key==='ArrowRight')target=(index+1)%tabs.length;if(event.key==='ArrowLeft')target=(index+tabs.length-1)%tabs.length;if(event.key==='Home')target=0;if(event.key==='End')target=tabs.length-1;if(target!==undefined){event.preventDefault();tabs[target].focus();setTab(tabs[target].dataset.tab);}});
    });
    renderDetailTab();
    if(!el('detail-dialog').open)el('detail-dialog').showModal();
    localize(el('detail-dialog'));
  }
  function setTab(tab) {
    activeTab=tab;detailRevision++;
    el('detail-content').querySelectorAll('[data-tab]').forEach(button=>{const current=button.dataset.tab===tab;button.setAttribute('aria-selected',String(current));button.tabIndex=current?0:-1;});
    el('detail-viewport').setAttribute('aria-labelledby',`tab-${tab}`);
    renderDetailTab();
  }
  async function readSource(model) {
    if(sourceCache.has(model.id))return sourceCache.get(model.id);
    const response=await fetch(model.source,{credentials:'same-origin'});
    if(!response.ok)throw new Error('源文件未能读取');
    const source=await response.text();sourceCache.set(model.id,source);return source;
  }
  function renderDetailTab() {
    preview.release(el('detail-viewport'));
    const m=activeModel,viewport=el('detail-viewport'),revision=detailRevision;
    if(activeTab==='image'){
      viewport.innerHTML=`<img class="detail-screenshot" src="${esc(m.screenshot)}" alt="${esc(m.model)} 原始测试截图"><div class="screenshot-caption"><span>原始截图 · 未裁切、未修饰</span><a href="${esc(m.screenshot)}" target="_blank" rel="noopener">查看原图</a></div>`;
    }else if(activeTab==='source'){
      viewport.innerHTML='<div class="source-loading" role="status">正在读取原始 HTML…</div>';
      readSource(m).then(source=>{if(revision!==detailRevision)return;const pre=document.createElement('pre');pre.className='source-code';pre.textContent=source;viewport.replaceChildren(pre);}).catch(()=>{if(revision!==detailRevision)return;viewport.innerHTML='<div class="source-loading">暂时无法读取源码，请尝试下载原始 HTML 文件。</div>';localize(viewport);});
    }else{
      viewport.innerHTML=preview.markup(m)+`<p class="runtime-note detail-runtime-note">可见作品会自动运行。同时最多运行六个场景；离开画面或切到后台后停止，返回时重新载入。手动停止后不会自动重启，报错后可自行重试。部分作品需要 WebGL；沙箱不支持作品内下载等部分功能。</p>`;
      preview.mount(viewport);
    }
    localize(viewport);
  }
  el('compare-open').addEventListener('click',()=>{
    if(selected.size<2)return;
    preview.stopAll();preview.release(el('compare-content'));ratings.release(el('compare-content'));
    const items=[...selected].map(id=>models.find(m=>m.id===id));
    const fields=[['input_tokens','输入 Token'],['cached_input_tokens','其中 · 缓存输入'],['output_tokens','输出 Token'],['reasoning_output_tokens','其中 · 推理输出'],['total_tokens','总 Token']];
    el('compare-content').innerHTML=`<div class="compare-grid">${items.map(m=>`<section class="compare-column">${preview.markup(m,'compare')}${ratings.markup(m,true)}<div class="compare-status ${m.originalError?'has-error':''}">${m.originalError?'原始报错 · '+esc(m.originalError):'原始 HTML · 可见时自动运行'}</div><details class="compare-token-details"><summary>Token 记录</summary><div class="compare-metrics">${fields.map(([key,label])=>`<div class="compare-metric ${key==='total_tokens'?'is-total':''}"><span>${label}</span><strong>${num(m[key])}</strong></div>`).join('')}</div></details></section>`).join('')}</div><p class="compare-footnote">访客评分是主观意见，与原始 Token 记录分开呈现。缓存输入与推理输出为子集数据，不重复计入总计。</p>`;
    preview.mount(el('compare-content'));ratings.mount(el('compare-content'));
    el('compare-dialog').showModal();
    localize(el('compare-dialog'));
  });
  el('compare-dialog').addEventListener('close',()=>{preview.release(el('compare-content'));ratings.release(el('compare-content'));el('compare-content').replaceChildren();});
  window.UI_I18N?.onChange(()=>{preview.stopAll();if(el('compare-dialog').open)el('compare-dialog').close();renderLibrary();if(activePrompt)activatePrompt(activePrompt);if(activeModel)openDetail(activeModel.id);localize();});
  renderLibrary();
  applyRoute();
})();
