'use strict';
window.createRatingManager=({runs,esc,translate,localize,num})=>{
 const nodes=new Set(),cache=new Map(),pending=new Map(),failures=new Set();
 const markup=(run,compact=false)=>`<section class="rating-widget" data-rating-run="${esc(run.id)}" data-rating-compact="${compact}" aria-label="${esc(run.model)} 访客评分"><div class="rating-summary" role="status">正在读取评分…</div></section>`;
 const average=value=>new Intl.NumberFormat(window.UI_I18N?.numberLocale||'zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1}).format(value);
 const errorText=code=>code==='rate_limited'?'操作太频繁，请稍后重试':code==='cookies_required'?'请允许本站 Cookie 后评分':'评分暂时不可用，请重试';
 function render(node){
  const run=runs.get(node.dataset.ratingRun),entry=cache.get(run.promptId),rating=entry?.ratings.get(run.id),compact=node.dataset.ratingCompact==='true';
  if(!rating){node.innerHTML=failures.has(run.promptId)?'<p class="rating-message">评分暂时不可用，请重试</p><button class="text-button rating-retry">重试</button>':'<div class="rating-summary" role="status">正在读取评分…</div>';node.querySelector('.rating-retry')?.addEventListener('click',()=>load(run.promptId,true));localize(node);return;}
  node.innerHTML=`<div class="rating-summary"><div><span class="rating-average">${rating.average===null?'暂无评分':average(rating.average)}</span>${rating.average===null?'':'<span class="rating-max"> / 10</span>'}</div><span class="rating-count">评分数量：${num(rating.votes)}</span></div><details class="rating-editor" ${compact?'':'open'}><summary>评分 / 修改</summary><form class="rating-form"><label><span>${rating.mine===null?'你的评分':'你的评分（可修改）'}</span><select class="rating-select" aria-label="${esc(run.model)} 你的评分"><option value="">选择分数</option>${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${rating.mine===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label><button class="button secondary rating-submit" type="submit">${rating.mine===null?'提交评分':'更新评分'}</button></form><details class="rating-privacy"><summary>匿名评分说明</summary><p>无需登录。使用本站 Cookie 识别当前浏览器，每个浏览器对每项测试中的每个模型保留一份评分。换浏览器或清除 Cookie 可重复评分，结果仅供参考。本评分功能不采集 IP 地址或浏览器指纹；托管平台可能保留访问日志。</p></details></details><p class="rating-message" role="status">${failures.has(run.promptId)?'评分刷新失败，显示上次记录':''}</p>`;
  node.querySelector('.rating-form').addEventListener('submit',async event=>{
   event.preventDefault();const select=node.querySelector('.rating-select'),button=node.querySelector('.rating-submit'),message=node.querySelector('.rating-message'),score=Number(select.value);
   if(!select.value||!Number.isInteger(score)||score<1||score>10){message.textContent=translate('请选择 1–10 分');return;}
   button.disabled=true;message.textContent=translate('正在保存评分…');
   try{const response=await fetch('/api/ratings',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Rating-Intent':'vote'},body:JSON.stringify({runId:run.id,score})});const result=await response.json();if(!response.ok)throw new Error(result.error||'unavailable');if(!validRating(result.rating)||result.rating.runId!==run.id)throw new Error('invalid_response');cache.get(run.promptId).ratings.set(run.id,result.rating);for(const target of nodes)if(target.dataset.ratingRun===run.id){render(target);target.querySelector('.rating-message').textContent=translate('评分已保存');}}
   catch(error){message.textContent=translate(errorText(error.message));button.disabled=false;}
  });localize(node);
 }
 function validRating(value){return value&&runs.has(value.runId)&&Number.isInteger(value.votes)&&value.votes>=0&&(value.average===null||Number.isFinite(value.average)&&value.average>=1&&value.average<=10)&&(value.mine===null||Number.isInteger(value.mine)&&value.mine>=1&&value.mine<=10);}
 async function load(promptId,force=false){
  if(pending.has(promptId))return pending.get(promptId);if(!force&&cache.has(promptId)&&Date.now()-cache.get(promptId).at<15000)return;
  const request=(async()=>{try{const response=await fetch('/api/ratings?testId='+encodeURIComponent(promptId),{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('unavailable');const result=await response.json();const expected=[...runs.values()].filter(run=>run.promptId===promptId);if(!Array.isArray(result.ratings)||result.ratings.length!==expected.length||result.ratings.some(value=>!validRating(value)||runs.get(value.runId).promptId!==promptId)||new Set(result.ratings.map(value=>value.runId)).size!==expected.length)throw new Error('invalid_response');cache.set(promptId,{at:Date.now(),ratings:new Map(result.ratings.map(value=>[value.runId,value]))});failures.delete(promptId);}catch{failures.add(promptId);}finally{pending.delete(promptId);for(const node of nodes)if(runs.get(node.dataset.ratingRun).promptId===promptId)render(node);}})();pending.set(promptId,request);return request;
 }
 function mount(root){const prompts=new Set();root.querySelectorAll('[data-rating-run]').forEach(node=>{if(nodes.has(node))return;nodes.add(node);render(node);prompts.add(runs.get(node.dataset.ratingRun).promptId);});for(const id of prompts)load(id);}
 function release(root){for(const node of [...nodes])if(node===root||root.contains(node))nodes.delete(node);}
 return {markup,mount,release};
};
