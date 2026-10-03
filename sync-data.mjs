import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('./assets/manifest.json',import.meta.url),'utf8'));
if(data.schemaVersion!==2)throw new Error('Unsupported dataset schema');
const unique=(items,label)=>{const ids=new Set();for(const item of items){if(!item.id||ids.has(item.id))throw new Error(`Missing or duplicate ${label} id`);ids.add(item.id);}return ids;};
const categoryIds=unique(data.categories,'category');
const promptIds=unique(data.prompts,'prompt');
const runIds=unique(data.runs,'run');
const runs=new Map(data.runs.map(run=>[run.id,run]));
for(const prompt of data.prompts){
  if(prompt.promptStatus==='not_provided'&&(prompt.promptText!==null||prompt.promptFile!==null||prompt.promptArtifact!==null))throw new Error(`Unprovided prompt must not be fabricated: ${prompt.id}`);
  if(!categoryIds.has(prompt.categoryId))throw new Error(`Unknown category for ${prompt.id}`);
  if(new Set(prompt.runIds).size!==prompt.runIds.length)throw new Error(`Duplicate run membership for ${prompt.id}`);
  if(prompt.coverRunId&&!prompt.runIds.includes(prompt.coverRunId))throw new Error(`Cover is outside prompt ${prompt.id}`);
  for(const id of prompt.runIds)if(!runIds.has(id)||runs.get(id).promptId!==prompt.id)throw new Error(`Run ${id} does not belong to prompt ${prompt.id}`);
}
for(const run of data.runs){if(!promptIds.has(run.promptId)||!data.prompts.find(prompt=>prompt.id===run.promptId).runIds.includes(run.id))throw new Error(`Unlisted run ${run.id}`);}
await writeFile(new URL('./assets/data.js',import.meta.url),'window.TEST_DATA = '+JSON.stringify(data,null,2)+';\n');
console.log(`Data synchronized: ${data.prompts.length} prompts, ${data.runs.length} model runs`);
