const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/lab-runtime.js', 'utf8');
new vm.Script(source, { filename: 'js/lab-runtime.js' });
for (const id of ['voice', 'image', 'video', 'transcribe', 'dub', 'remote']) {
  assert.ok(source.includes("id:'" + id + "'"), 'Missing model entry: ' + id);
}
assert.match(source, /http:\/\/127\.0\.0\.1:8767/);
assert.match(source, /X-Baba-Token/);
assert.match(source, /sessionStorage/);
assert.match(source, /function check\(/);
assert.match(source, /function download\(/);
assert.match(source, /function markup\(/);
assert.match(source, /function mount\(/);
const lab = fs.readFileSync('js/lab.js','utf8');
assert.match(lab, /BABALocalAI\.markup\(\)/);
assert.match(lab, /BABALocalAI\.mount\(root\)/);
const index=fs.readFileSync('index.html','utf8');
assert.match(index, /js\/lab-runtime\.js/);
assert.match(index, /css\/lab-runtime\.css/);
console.log('BABA LAB runtime: five local model workflows, remote launcher and UI integration OK');