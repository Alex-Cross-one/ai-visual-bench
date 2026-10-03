import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from './server/worker.js';
const root=await mkdtemp(path.join(tmpdir(),'gallery-rating-test-')),file=path.join(root,'data.sqlite');
let sqlite=new DatabaseSync(file);for(const name of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')))sqlite.exec(await readFile('drizzle/'+name,'utf8'));
function binding(){return {prepare(sql){assert.ok(!sql.includes(';'),'one statement per prepare');return {bind(...params){return {sql,params,async all(){return {results:sqlite.prepare(sql).all(...params)};}};}};},async batch(items){sqlite.exec('BEGIN IMMEDIATE');try{const result=items.map(item=>({meta:{changes:Number(sqlite.prepare(item.sql).run(...item.params).changes)}}));sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};}
const origin='https://bottle-ocean-benchmark.fizzy-tulip-7700.chatgpt.site',app=createApp([{id:'test--a',promptId:'test',model:'a'},{id:'test--b',promptId:'test',model:'b'},{id:'other--a',promptId:'other',model:'a'}]);
const env={DB:binding(),ASSETS:{fetch:async()=>new Response('original artifact bytes',{headers:{'Content-Type':'text/html'}})}};
const get=(testId='test',cookie)=>app.fetch(new Request(origin+'/api/ratings?testId='+testId,{headers:cookie?{Cookie:cookie}:{}}),env);
const put=(cookie,body,headers={})=>app.fetch(new Request(origin+'/api/ratings',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json','X-Rating-Intent':'vote',Cookie:cookie,...headers},body:typeof body==='string'?body:JSON.stringify(body)}),env);
let response=await get();assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie').split(';')[0];assert.match(response.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict/);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.deepEqual((await response.json()).ratings[0],{runId:'test--a',average:null,votes:0,mine:null});
const cookie2=(await get()).headers.get('Set-Cookie').split(';')[0];assert.notEqual(cookie,cookie2);
response=await put(cookie,{runId:'test--a',score:8});assert.equal(response.status,200);assert.deepEqual((await response.json()).rating,{runId:'test--a',average:8,votes:1,mine:8});
response=await put(cookie2,{runId:'test--a',score:6});assert.deepEqual((await response.json()).rating,{runId:'test--a',average:7,votes:2,mine:6});
response=await put(cookie,{runId:'test--a',score:10});assert.deepEqual((await response.json()).rating,{runId:'test--a',average:8,votes:2,mine:10});
await put(cookie,{runId:'other--a',score:2});assert.equal((await (await get('other',cookie)).json()).ratings[0].average,2);
for(const score of [0,11,1.5,'7',true,null])assert.equal((await put(cookie,{runId:'test--a',score})).status,400);
assert.equal((await put(cookie,{runId:'missing',score:4})).status,404);assert.equal((await put(cookie,{runId:'test--a',score:4,extra:true})).status,400);
assert.equal((await put(cookie,'bad-json')).status,400);assert.equal((await put(cookie,'x'.repeat(2048))).status,413);assert.equal((await put(cookie,{runId:'test--a',score:4},{Origin:'null'})).status,403);assert.equal((await put(cookie,{runId:'test--a',score:4},{Origin:'https://other.example'})).status,403);assert.equal((await put(cookie,{runId:'test--a',score:4},{'X-Rating-Intent':'x'})).status,403);assert.equal((await put(cookie,{runId:'test--a',score:4},{'Content-Type':'text/plain'})).status,415);assert.equal((await put('',{runId:'test--a',score:4})).status,428);
const cookie3=(await get()).headers.get('Set-Cookie').split(';')[0];const attempts=await Promise.all(Array.from({length:25},(_,i)=>put(cookie3,{runId:'test--b',score:i%10+1})));assert.equal(attempts.filter(r=>r.status===200).length,20);assert.equal(attempts.filter(r=>r.status===429).length,5);assert.equal((await (await get('test',cookie3)).json()).ratings[1].votes,1);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM ratings').get().n,4);assert.throws(()=>sqlite.prepare('INSERT INTO ratings VALUES (?,?,?,?,?)').run('x','x',2.5,0,0),/CHECK/);
sqlite.close();sqlite=new DatabaseSync(file);env.DB=binding();response=await get('test',cookie);const persisted=await response.json();assert.equal(persisted.ratings[0].mine,10);assert.equal(persisted.ratings[0].votes,2);assert.equal(persisted.ratings[0].average,8);assert.ok(!JSON.stringify(persisted).includes(cookie.split('=')[1]));
for(const pathname of ['/artifacts/a/source.html','/artifacts/a/source']){response=await app.fetch(new Request(origin+pathname),env);assert.match(response.headers.get('Content-Disposition'),/attachment/);assert.match(response.headers.get('Content-Security-Policy'),/sandbox allow-scripts/);assert.equal(await response.text(),'original artifact bytes');}
assert.equal((await app.fetch(new Request(origin+'/api/ratings?testId=test'),{})).status,503);
sqlite.close();await rm(root,{recursive:true});console.log('PASS: real SQLite durability/reopen, two-browser aggregate/upsert, test isolation, schema integer check, concurrent quota/unique vote, all validation/error paths, no identity leakage, unchanged sandboxed raw artifacts');
