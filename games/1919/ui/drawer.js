export function openDrawer(root){
  const layout=root.querySelector(".layout");
  if(layout?.dataset.drawer==="closed")layout.dataset.drawer="half";
}
export function bindDrawer(root){
  const layout=root.querySelector(".layout");
  root.querySelector("#drawer-resize").onclick=()=>{
    layout.dataset.drawer=layout.dataset.drawer==="half"?"full":"half";
  };
  root.querySelector("#drawer-close").onclick=()=>{layout.dataset.drawer="closed";};
}
