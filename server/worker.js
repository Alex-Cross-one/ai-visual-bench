import {runIndex} from './run-index.js';
const ORIGIN='https://bottle-ocean-benchmark.fizzy-tulip-7700.chatgpt.site';
const COOKIE='__Host-gallery_voter';
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{...HEADERS,...extra}});
function identity(request){const value=(request.headers.get('Cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
const randomId=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function voterHash(id){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ai-test-library-rating-v1:'+id)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const cookieHeader=id=>`${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`;
const dbFor=env=>{if(!env.DB?.prepare||!env.DB?.batch)throw new Error('StorageUnavailable');return env.DB;};
async function smallBody(request){const reader=request.body?.getReader();if(!reader)return '';let size=0;const chunks=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();throw new Error('BodyTooLarge');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);}
async function aggregate(db,ids,hash){
 const query=`SELECT run_id, AVG(score) AS average, COUNT(*) AS votes, MAX(CASE WHEN voter_hash = ? THEN score END) AS mine FROM ratings WHERE run_id IN (${ids.map(()=>'?').join(',')}) GROUP BY run_id`;
 const found=(await db.prepare(query).bind(hash,...ids).all()).results||[];const map=new Map(found.map(row=>[row.run_id,row]));
 return ids.map(runId=>{const row=map.get(runId);return {runId,average:row?Number(row.average):null,votes:row?Number(row.votes):0,mine:row?.mine==null?null:Number(row.mine)};});
}
function limitStatement(db,key,bucket,ticket,cap){return db.prepare('INSERT INTO rating_limits (key,bucket,count,ticket) VALUES (?,?,1,?) ON CONFLICT(key) DO UPDATE SET bucket=excluded.bucket, count=CASE WHEN rating_limits.bucket=excluded.bucket THEN rating_limits.count+1 ELSE 1 END, ticket=excluded.ticket WHERE rating_limits.bucket<>excluded.bucket OR rating_limits.count<?').bind(key,bucket,ticket,cap);}
export function createApp(index=runIndex){
 const prompts=new Map();for(const run of index){if(!prompts.has(run.promptId))prompts.set(run.promptId,[]);prompts.get(run.promptId).push(run.id);}const allowed=new Set(index.map(run=>run.id));
 return {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/ratings'){
   try{
    if(request.method==='GET'){
     const ids=prompts.get(url.searchParams.get('testId'));if(!ids)return json({error:'unknown_test'},404);
     let id=identity(request);const fresh=!id;if(!id)id=randomId();const data=await aggregate(dbFor(env),ids,await voterHash(id));return json({ratings:data},200,fresh?{'Set-Cookie':cookieHeader(id)}:{});
    }
    if(request.method!=='PUT')return json({error:'method_not_allowed'},405,{'Allow':'GET, PUT'});
    if(request.headers.get('Origin')!==ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site'||request.headers.get('X-Rating-Intent')!=='vote')return json({error:'origin_denied'},403);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'json_required'},415);
    if(Number(request.headers.get('Content-Length')||0)>1024)return json({error:'body_too_large'},413);
    let raw;try{raw=await smallBody(request);}catch(error){if(error.message==='BodyTooLarge')return json({error:'body_too_large'},413);throw error;}
    let body;try{body=JSON.parse(raw);}catch{return json({error:'invalid_json'},400);}
    if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='runId,score'||typeof body.runId!=='string'||!Number.isInteger(body.score)||body.score<1||body.score>10)return json({error:'invalid_vote'},400);
    if(!allowed.has(body.runId))return json({error:'unknown_run'},404);
    const id=identity(request);if(!id)return json({error:'cookies_required'},428);
    const db=dbFor(env),hash=await voterHash(id),now=Date.now(),bucket=Math.floor(now/60000),ticket=crypto.randomUUID();
    // One transaction: both limits must issue this request's ticket before its vote can change.
    const result=await db.batch([
     limitStatement(db,'browser:'+hash,bucket,ticket,20),
     limitStatement(db,'site',bucket,ticket,300),
     db.prepare('INSERT INTO ratings (run_id,voter_hash,score,created_at,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rating_limits WHERE key=? AND ticket=?) AND EXISTS(SELECT 1 FROM rating_limits WHERE key=? AND ticket=?) ON CONFLICT(run_id,voter_hash) DO UPDATE SET score=excluded.score,updated_at=excluded.updated_at').bind(body.runId,hash,body.score,now,now,'browser:'+hash,ticket,'site',ticket)
    ]);
    if(!result[2]?.meta?.changes)return json({error:'rate_limited'},429,{'Retry-After':'60'});
    return json({rating:(await aggregate(db,[body.runId],hash))[0]});
   }catch(error){console.error('Ratings unavailable',error?.name||'Error');return json({error:'ratings_unavailable'},503);}
  }
  if(url.pathname.startsWith('/api/'))return json({error:'not_found'},404);
  if(!env.ASSETS?.fetch)return new Response('Site assets unavailable',{status:503});
  const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');
  if(decodeURIComponent(url.pathname).startsWith('/artifacts/')&&(url.pathname.endsWith('.html')||(response.headers.get('Content-Type')||'').startsWith('text/html'))){
   headers.set('Content-Disposition','attachment; filename="original.html"');
   headers.set('Content-Security-Policy',"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'");
   headers.set('Referrer-Policy','no-referrer');
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }};
}
export default createApp();
