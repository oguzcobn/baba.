const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const draft=fs.readFileSync('js/draft-data.js','utf8');
const match=draft.match(/const DRAFT_CLUBS = (\[[\s\S]*?\]);/);
assert.ok(match,'FC27 squad data available');
const clubs=JSON.parse(match[1]);
const players=clubs.flatMap(c=>c.players.filter(p=>p[3]==='FC27').map(p=>p[0]));
const data=JSON.parse(fs.readFileSync('data/career-birthdates.json','utf8'));
const runtime=vm.runInNewContext(fs.readFileSync('js/career-birthdates.js','utf8')+'\nCAREER_PLAYER_BIRTHDATES');
assert.equal(players.length,419,'current 18 club squads have 419 players');
assert.equal(new Set(players).size,419,'all current player names are unique');
assert.ok(Object.keys(data.birthdates).length>=419,'all current players plus historical names are covered');
assert.deepEqual(JSON.parse(JSON.stringify(runtime)),data.birthdates,'runtime and source registry agree');
for(const name of players){
 const dob=data.birthdates[name];
 assert.ok(dob,'missing real DOB: '+name);
 assert.match(dob,/^\d{4}-\d{2}-\d{2}$/);
 const date=new Date(dob+'T00:00:00Z');
 assert.equal(date.toISOString().slice(0,10),dob,'invalid date for '+name);
 assert.ok(dob>='1980-01-01'&&dob<'2015-01-01','implausible DOB for '+name+': '+dob);
}
const age=(dob,year)=>year-Number(dob.slice(0,4))-((Number(dob.slice(5,7))>11 || (Number(dob.slice(5,7))===11 && Number(dob.slice(8,10))>16))?1:0);
for(const [name,ageNow] of [['Victor Osimhen',27],['Leroy Sané',30],['Juan',24],['Benjamin Bouchouari',25],['René Mitongo',18],['Bilal Demirağ',17]]){
 assert.equal(age(data.birthdates[name],2026),ageNow,'2026 real age: '+name);
 assert.equal(age(data.birthdates[name],2028),ageNow+2,'2028 career age: '+name);
}
console.log('PASS: all 419 FC27 players + '+Object.keys(data.birthdates).length+' registry DOBs, with correct career-season ages');
