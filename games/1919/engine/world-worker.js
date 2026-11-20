import { simulate } from "./world-ai.js";
self.onmessage=({data})=>{
 try{self.postMessage(simulate(data.state,data.config));}
 catch(error){self.postMessage({error:String(error)});}
};
