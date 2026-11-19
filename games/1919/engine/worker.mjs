import {advance} from './simulation.mjs';
self.onmessage=({data})=>{try{postMessage({state:advance(data.state,data.map)});}catch(error){postMessage({error:error.message});}};
