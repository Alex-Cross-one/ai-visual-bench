import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const dictionarySource=await readFile('assets/translations.js','utf8');
const engineSource=await readFile('assets/i18n.js','utf8');
class Node{
  constructor(tag,text,attrs={}){this.nodeType=1;this.tagName=tag.toUpperCase();this.attrs=attrs;this.childNodes=[];this.events={};this.value='';if(text!==undefined)this.childNodes.push({nodeType:3,nodeValue:text});}
  addEventListener(type,fn){this.events[type]=fn;}
  getAttribute(key){return this.attrs[key]??null;}
  setAttribute(key,value){this.attrs[key]=value;}
  querySelectorAll(){const out=[];for(const node of this.childNodes){if(node.nodeType===1){out.push(node);out.push(...node.querySelectorAll());}}return out;}
}
function setup(languages,saved,blocked=false){
  const storage=new Map(saved?[['ai-test-library.locale',saved]]:[]);
  const root=new Node('html');const body=new Node('body');root.childNodes.push(body);
  const heading=new Node('h1','同一道题，不同的答案');
  const label=new Node('label','界面语言',{'aria-label':'界面语言'});
  const selector=new Node('select',undefined);selector.id='language-select';
  const option=new Node('option','跟随浏览器');selector.childNodes.push(option);
  const prompt=new Node('pre','用WebGL创作瓶中沧海。原始截图不可修改。');
  const code=new Node('code','原始报错');const meta=new Node('meta',undefined,{name:'description',content:'AI 测试库'});
  body.childNodes.push(heading,label,selector,prompt,code,meta);
  const document={nodeType:9,childNodes:[root],documentElement:root,getElementById:id=>id==='language-select'?selector:null,querySelectorAll:()=>root.querySelectorAll(),querySelector:()=>meta};
  const window={navigator:{languages,language:languages[0]},events:{},addEventListener(type,fn){this.events[type]=fn;},localStorage:{getItem(key){if(blocked)throw Error('Blocked');return storage.get(key)??null;},setItem(key,value){if(blocked)throw Error('Blocked');storage.set(key,value);},removeItem(key){if(blocked)throw Error('Blocked');storage.delete(key);}}};
  const context=vm.createContext({window,document,Set,WeakMap,RegExp,String});
  vm.runInContext(dictionarySource,context);vm.runInContext(engineSource,context);
  return{ui:window.UI_I18N,window,document,heading,label,selector,prompt,code,meta,storage,body,option};
}
for(const [input,expected] of [[['zh-CN'],'zh-Hans'],[['zh-SG'],'zh-Hans'],[['zh-Hans-TW'],'zh-Hans'],[['zh-Hant-CN'],'zh-Hant'],[['zh-TW'],'zh-Hant'],[['zh-HK'],'zh-Hant'],[['zh-MO'],'zh-Hant'],[['en-GB'],'en'],[['fr-FR'],'en'],[['fr-FR','zh-HK'],'zh-Hant']]){assert.equal(setup(input).ui.locale,expected);}
const en=setup(['zh-CN'],'en');assert.equal(en.ui.locale,'en');assert.equal(en.document.documentElement.lang,'en');assert.equal(en.heading.childNodes[0].nodeValue,'One prompt, different answers');assert.equal(en.label.getAttribute('aria-label'),'Interface language');assert.equal(en.meta.getAttribute('content'),'AI Test Library');assert.equal(en.prompt.childNodes[0].nodeValue,'用WebGL创作瓶中沧海。原始截图不可修改。');assert.equal(en.code.childNodes[0].nodeValue,'原始报错');
en.ui.setLanguage('zh-Hant');assert.equal(en.ui.locale,'zh-Hant');assert.equal(en.document.documentElement.lang,'zh-TW');assert.equal(en.heading.childNodes[0].nodeValue,'同一道題，不同的答案');assert.equal(en.label.getAttribute('aria-label'),'介面語言');assert.equal(en.storage.get('ai-test-library.locale'),'zh-Hant');assert.equal(en.ui.numberLocale,'zh-TW');
en.ui.setLanguage('zh-Hans');assert.equal(en.heading.childNodes[0].nodeValue,'同一道题，不同的答案');assert.equal(en.label.getAttribute('aria-label'),'界面语言');assert.equal(en.document.documentElement.lang,'zh-CN');
en.ui.setLanguage('auto');assert.equal(en.ui.choice,'auto');assert.equal(en.ui.locale,'zh-Hans');assert.equal(en.storage.has('ai-test-library.locale'),false);
en.window.navigator.languages=['en-US'];en.window.events.languagechange();assert.equal(en.ui.locale,'en');assert.equal(en.heading.childNodes[0].nodeValue,'One prompt, different answers');
const dynamic=new Node('span','已选择 2 个模型进行对照');en.body.childNodes.push(dynamic);en.ui.apply();assert.equal(dynamic.childNodes[0].nodeValue,'Selected 2 models for comparison');
assert.equal(en.ui.translate('1 项测试'),'1 test');assert.equal(en.ui.translate('11 项测试'),'11 tests');assert.equal(en.ui.translate('查看全部 8 份结果'),'View all 8 results');assert.equal(en.ui.translate('The source remains unchanged.'),'The source remains unchanged.');
const denied=setup(['zh-HK'],null,true);assert.equal(denied.ui.locale,'zh-Hant');assert.doesNotThrow(()=>denied.ui.setLanguage('en'));assert.equal(denied.ui.locale,'en');
assert.equal(setup(['zh-CN'],'unrecognized').ui.locale,'zh-Hans');
const reloaded=setup(['en-US'],'zh-Hant');assert.equal(reloaded.ui.locale,'zh-Hant');
for(const [key,entry]of Object.entries(en.window.UI_TRANSLATIONS)){assert.ok(entry.en&&entry['zh-Hant'],key);assert.ok(!/[\u3400-\u9fff]/.test(entry.en),key);}
console.log('PASS: Simplified/Traditional/English detection, region/script precedence, English fallback, saved overrides, blocked storage, language changes, full catalog, document lang/meta, accessibility attributes, dynamic strings, repeated switches, and unchanged prompt/code evidence');
