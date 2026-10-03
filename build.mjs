import './sync-data.mjs';
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'dist');
const data = JSON.parse(await readFile(path.join(root, 'assets/manifest.json'), 'utf8'));
const runIndex = data.runs.map(({id, promptId, model}) => ({id, promptId, model}));
await writeFile(path.join(root, 'server/run-index.js'), 'export const runIndex = ' + JSON.stringify(runIndex) + ';\n');
await rm(output, {recursive: true, force: true});
await mkdir(path.join(output, 'client'), {recursive: true});
await mkdir(path.join(output, 'server'), {recursive: true});
for (const name of ['index.html', 'assets', 'artifacts']) {
  await cp(path.join(root, name), path.join(output, 'client', name), {recursive: true});
}
const source = await readFile(path.join(root, 'server/worker.js'), 'utf8');
await writeFile(path.join(output, 'server/index.js'), source.replace("import {runIndex} from './run-index.js';", 'const runIndex = ' + JSON.stringify(runIndex) + ';'));
console.log('Worker and static assets ready in dist/. Use your own Worker/D1 deployment configuration.');
