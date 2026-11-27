window.ModernPeople=(()=>{
 const names=['crew-a','crew-b','infantry'],actions=['idle','walk','work','carry','carryIdle','ready'];
 const url=(name,ext)=>window.MODERN_EMBEDDED_PEOPLE?.[name+'.'+ext]||'./assets/people/'+name+'.'+ext;
 const sheets=names.map(n=>{const i=new Image();i.src=url(n,'webp');return i});
 const variant=u=>u.kindUnit==='infantry'?2:u.id%2;
 function pose(u){
  if(u.carry>0)return u.path?.length?3:4;
  if(u.path?.length)return 1;
  if(['build','gather'].includes(u.role))return 2;
  return u.kindUnit==='infantry'&&(u.attack||u.cool>0)?5:0
 }
 function phase(u,time,a){return ((a===1||a===3?(u.travel||0)/.78:time*(a===2?.85:.32))+u.id*.173)%1}
 const direction=u=>((Math.round((Math.PI/2-(u.angle||0))*4/Math.PI)%8)+8)%8;
 const scale=u=>.53*(.98+(u.id%5)*.01);
 return {names,actions,url,sheets,variant,pose,phase,direction,scale}
})();