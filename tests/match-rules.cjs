// Fast, deterministic football rules regression — no browser or npm install required.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('js/match2d.js','utf8');
new vm.Script(src,{filename:'js/match2d.js'}); // Syntax check
const exported=vm.runInNewContext(src+'\nMatch2D;',{}, {timeout:5000});
const getRules=exported.foulRestart;
const cases=[
  [{x:52,y:34},'FREEKICK','midfield foul'],
  [{x:88.49,y:34},'FREEKICK','outside penalty area'],
  [{x:88.5,y:34},'PENALTY','front penalty line'],
  [{x:93,y:34},'PENALTY','inside penalty area'],
  [{x:92,y:56},'FREEKICK','wide of the penalty area'],
  [{x:103,y:13.84},'PENALTY','side boundary counts'],
  [{x:110,y:34},'FREEKICK','outside field cannot be a penalty'],
  [{x:52,y:15},'FREEKICK','wide midfield']
];
for(const [at,want,reason] of cases)assert.equal(getRules(at),want,reason);
console.log('PASS: match2d syntax and '+cases.length+' referee position tests');

// Position-aware shooting range prevents the famous midfield centre-back goal bug.
assert.equal(exported.maxShotDistance('ST'),18,'centre-backs shoot from the box');
assert.equal(exported.maxShotDistance('BK'),18,'full-backs shoot from the box');
assert.equal(exported.maxShotDistance('OS'),28,'midfielders can shoot from range');
assert.equal(exported.maxShotDistance('FV'),29,'forwards can shoot from range');
const career=fs.readFileSync('js/career.js','utf8');
assert.match(career,/ST: \['corner', 'cross', 'rebound'\]/,'centre-back goal types stay inside the box');
console.log('PASS: positional shooting limits and defensive goals');
