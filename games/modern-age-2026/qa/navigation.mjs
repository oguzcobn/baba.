import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function findPath('),html.indexOf('function go('));
const N=32,blocked=new Set();
const passable=(x,y,naval)=>x>=0&&x<N&&y>=0&&y<N&&(naval===blocked.has(Math.floor(y)*N+Math.floor(x)));
const find=new Function('N','passable',source+';return findPath')(N,passable);
for(const kindUnit of ['worker','infantry','armor']){
 const u={x:3.5,y:3.5,kindUnit};
 assert.deepEqual(find(u,15.5,15.5),[{x:15.5,y:15.5}]);
 blocked.add(9*N+9);
 const detour=find(u,15.5,15.5);assert.ok(detour.length>1);
 let a=u,length=0;
 for(const b of detour){length+=Math.hypot(b.x-a.x,b.y-a.y);for(let t=0;t<=1;t+=.002){
   const x=a.x+t*(b.x-a.x),y=a.y+t*(b.y-a.y);
   for(const dx of [-.13,.13])for(const dy of [-.13,.13])assert.ok(passable(x+dx,y+dy,false));
 }a=b}
 assert.ok(length<20);blocked.clear();
}
for(let i=1;i<12;i++)for(let j=1;j<12;j++)blocked.add(j*N+i);
assert.deepEqual(find({x:2.5,y:2.5,kindUnit:'naval'},9.5,9.5),[{x:9.5,y:9.5}]);
blocked.clear();blocked.add(N+1);blocked.add(2*N+2);
assert.deepEqual(find({x:1.5,y:1.5,kindUnit:'naval'},2.5,2.5),[]);
console.log('Open diagonal 16.97 tiles versus 24 on the old grid. Building clearance and separated water cells passed.');
