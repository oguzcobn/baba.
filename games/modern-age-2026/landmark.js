import {BufferAttribute,BufferGeometry} from './vendor/three.module.min.js';

// The asset baker emits one non-indexed primitive with three tightly packed float attributes.
export async function loadLandmark(){
 const response=await fetch(new URL('./assets/trabzon-kosku.glb',import.meta.url));
 if(!response.ok)throw Error('Köşk modeli yüklenemedi');
 const bytes=await response.arrayBuffer(),header=new DataView(bytes);
 if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2)throw Error('GLB 2 bekleniyor');
 const length=header.getUint32(12,true);
 const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
 const primitive=doc.meshes[0].primitives[0],geometry=new BufferGeometry();
 for(const [key,name] of Object.entries({POSITION:'position',NORMAL:'normal',COLOR_0:'color'})){
   const a=doc.accessors[primitive.attributes[key]],view=doc.bufferViews[a.bufferView];
   if(a.componentType!==5126||a.type!=='VEC3'||view.byteStride)throw Error('Geçersiz model özniteliği');
   const data=new Float32Array(bytes,28+length+(view.byteOffset||0)+(a.byteOffset||0),a.count*3);
   geometry.setAttribute(name,new BufferAttribute(data,3));
 }
 geometry.computeBoundingSphere();
 return geometry;
}
