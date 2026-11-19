const orders=new WeakMap();
export function drawEffects(svg,from,to,order){
  const canvas=svg.parentElement.querySelector("canvas");
  if(orders.get(canvas)===order.id)return;
  orders.set(canvas,order.id);
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  const start=performance.now(),reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame(now){
    if(!canvas.isConnected||orders.get(canvas)!==order.id)return;
    const box=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio);
    const width=Math.round(box.width*dpr),height=Math.round(box.height*dpr);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,box.width,box.height);
    const t=Math.max(0,(now-start)/1150);
    if(t>=1||document.hidden)return;
    const matrix=svg.getScreenCTM();
    const a=new DOMPoint(...from).matrixTransform(matrix),b=new DOMPoint(...to).matrixTransform(matrix);
    const x=a.x-box.left,y=a.y-box.top,dx=b.x-a.x,dy=b.y-a.y;
    ctx.strokeStyle="#f0cc83";ctx.lineWidth=2;ctx.setLineDash([5,4]);
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
    const progress=reduced ? 0.5 : t;
    ctx.fillStyle="#ffe0a0";ctx.beginPath();ctx.arc(x+dx*progress,y+dy*progress,5,0,Math.PI*2);ctx.fill();
    ctx.font="bold 12px system-ui";ctx.fillText(String(order.count),x+dx*progress+9,y+dy*progress-5);
    if(reduced)setTimeout(()=>frame(performance.now()),1180);else requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
