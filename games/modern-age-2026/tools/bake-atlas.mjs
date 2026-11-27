import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const p=await b.newPage();
 await p.route('**/atlas.html',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));
 await p.goto('http://localhost:8080/atlas.html');
 for(const id of ['crew-a','crew-b','infantry']){
  const image=await p.evaluate(async name=>(await import('./tools/bake-atlas.js')).bake(name),id);
  await writeFile('assets/people/'+id+'.webp',Buffer.from(image,'base64'))
 }
}finally{await b.close()}
