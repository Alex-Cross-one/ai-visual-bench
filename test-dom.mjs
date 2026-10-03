export class Element{
  constructor(tag='div',attrs={}){this.style={};this.tagName=tag;this.attrs={...attrs};this.children=[];this.events={};this.parentElement=null;this._html='';this._text='';this.value=attrs.value||'';this.checked='checked'in attrs;this.disabled='disabled'in attrs;this.hidden='hidden'in attrs;this.open=false;this.dataset={};for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.className=attrs.class||'';this.classList={add:key=>{this.className+=' '+key;},remove:key=>{this.className=this.className.split(' ').filter(x=>x!==key).join(' ');},toggle:(key,force)=>{const parts=new Set(this.className.split(' ').filter(Boolean));if(force??!parts.has(key))parts.add(key);else parts.delete(key);this.className=[...parts].join(' ');}};}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  getBoundingClientRect(){return this.box??{width:1000,height:625};}
  set innerHTML(html){this._html=html;this.children=[];const stack=[this];const token=/<\/?([\w-]+)([^>]*?)\/?\s*>/g;let match;while((match=token.exec(html))){if(match[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}const attrs={};for(const a of match[2].matchAll(/([^\s=]+)(?:="([^"]*)"|'([^']*)'|([^\s]+))?/g))attrs[a[1]]=a[2]??a[3]??a[4]??'';const e=new Element(match[1],attrs);stack.at(-1).appendChild(e);if(!['input','img','meta','link','path','circle','rect','br'].includes(e.tagName)&&!match[0].endsWith('/>'))stack.push(e);}}
  get innerHTML(){return this._html;}
  set textContent(v){this._text=v;this.children=[];}
  get textContent(){return this._text;}
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k];}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  fire(k,event={}){for(const fn of this.events[k]||[])fn({target:this,preventDefault(){},...event});}
  appendChild(c){c.parentElement=this;this.children.push(c);return c;}
  replaceChildren(...c){this.children=[];this._html='';for(const el of c)this.appendChild(el);}
  matches(s){if(s.startsWith('.'))return this.className.split(' ').includes(s.slice(1));if(s.startsWith('[')){const key=s.slice(1,-1);return key in this.attrs;}if(s==='input[type="checkbox"]')return this.tagName==='input'&&this.attrs.type==='checkbox';return this.tagName===s;}
  querySelectorAll(s){const list=[];for(const c of this.children){if(c.matches(s))list.push(c);list.push(...c.querySelectorAll(s));}return list;}
  querySelector(s){return this.querySelectorAll(s)[0]??null;}
  closest(s){return this.matches(s)?this:this.parentElement?.closest(s);}
  focus(){this.focused=true;}
  showModal(){this.open=true;}
  close(){this.open=false;this.fire('close');}
}
