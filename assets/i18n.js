'use strict';
(() => {
  const supported=new Set(['zh-Hans','zh-Hant','en']);
  const languageCodes={'zh-Hans':'zh-CN','zh-Hant':'zh-TW',en:'en'};
  const numberLocales={'zh-Hans':'zh-CN','zh-Hant':'zh-TW',en:'en-US'};
  const storageKey='ai-test-library.locale';
  const dictionaries=window.UI_TRANSLATIONS||{};
  const keys=Object.keys(dictionaries).sort((a,b)=>b.length-a.length);
  const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const matcher=keys.length?new RegExp(keys.map(key=>(/^\d/.test(key)?'(?<![0-9])':'')+escapeRegExp(key)).join('|'),'g'):null;
  const originalText=new WeakMap();
  const originalAttributes=new WeakMap();
  const listeners=[];
  function detect(languages,saved){
    if(supported.has(saved))return saved;
    for(const language of languages||[]){
      const code=String(language).toLowerCase().replace(/_/g,'-');
      if(/^zh(?:-|$)/.test(code)){if(/(?:^|-)hans(?:-|$)/.test(code))return 'zh-Hans';if(/(?:^|-)hant(?:-|$)/.test(code))return 'zh-Hant';return /(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(code)?'zh-Hant':'zh-Hans';}
      if(/^en(?:-|$)/.test(code))return 'en';
    }
    return 'en';
  }
  let saved=null;
  try{saved=window.localStorage?.getItem(storageKey)||null;}catch{}
  let choice=supported.has(saved)?saved:'auto';
  const languages=()=>window.navigator?.languages?.length?window.navigator.languages:[window.navigator?.language||'en'];
  let locale=detect(languages(),choice);
  function translate(value,targetLocale=locale){
    const text=String(value);
    if(targetLocale==='zh-Hans'||!matcher)return text;
    return text.replace(matcher,key=>dictionaries[key]?.[targetLocale]??key);
  }
  function apply(root=document){
    if(document.documentElement)document.documentElement.lang=languageCodes[locale];
    // Original prompts, source code and iframe documents are evidence, not UI copy.
    const skip=new Set(['PRE','CODE','SCRIPT','STYLE','IFRAME','TEXTAREA']);
    const visit=node=>{
      if(node.nodeType===3){
        if(!originalText.has(node))originalText.set(node,node.nodeValue);
        node.nodeValue=translate(originalText.get(node));return;
      }
      if(skip.has(node.tagName?.toUpperCase()))return;
      for(const child of node.childNodes||[])visit(child);
    };
    visit(root);
    const nodes=root.querySelectorAll?.('[aria-label], [placeholder], [title], [alt]')||[];
    for(const node of nodes){
      let originals=originalAttributes.get(node);
      if(!originals){originals={};originalAttributes.set(node,originals);}
      for(const name of ['aria-label','placeholder','title','alt']){
        const value=node.getAttribute(name);if(value===null||value===undefined)continue;
        if(!(name in originals))originals[name]=value;
        node.setAttribute(name,translate(originals[name]));
      }
    }
    const description=document.querySelector?.('meta[name="description"]');if(description){let original=originalAttributes.get(description);if(!original){original={};originalAttributes.set(description,original);}if(!('content' in original))original.content=description.getAttribute('content');description.setAttribute('content',translate(original.content));}
    const selector=document.getElementById('language-select');if(selector)selector.value=choice;
  }
  function setLanguage(value,persist=true){
    choice=supported.has(value)?value:'auto';
    locale=detect(languages(),choice);
    if(persist){try{if(choice==='auto')window.localStorage?.removeItem(storageKey);else window.localStorage?.setItem(storageKey,choice);}catch{}}
    apply();for(const listener of listeners)listener(locale);
  }
  window.UI_I18N={detect,translate,apply,setLanguage,onChange:callback=>listeners.push(callback),get locale(){return locale;},get choice(){return choice;},get numberLocale(){return numberLocales[locale];}};
  const selector=document.getElementById('language-select');if(selector)selector.addEventListener('change',()=>setLanguage(selector.value));
  window.addEventListener('languagechange',()=>{if(choice==='auto')setLanguage('auto',false);});
  apply();
})();
