// One network mutation at a time; ignored repeat clicks never release the active lock.
export function createSingleFlight(){
 let running=false;
 return async task=>{
  if(running)return false;
  running=true;
  try{return await task();}finally{running=false;}
 };
}
