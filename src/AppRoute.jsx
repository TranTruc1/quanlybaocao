import {useState,useEffect,useCallback} from 'react';
import {parseAppRoute,appRouteHash} from './app-route.js';
export function useAppRoute(){
 const [route,setRoute]=useState(()=>parseAppRoute(globalThis.window?.location?.hash));
 useEffect(()=>{
  const read=()=>setRoute(parseAppRoute(window.location.hash));
  window.addEventListener('popstate',read);window.addEventListener('hashchange',read);
  // Hash routes work on Vercel and static hosting without additional rewrite config.
  if(!window.location.hash)window.history.replaceState(null,'',appRouteHash(route));
  return()=>{window.removeEventListener('popstate',read);window.removeEventListener('hashchange',read);};
 },[]);
 const navigate=useCallback((next,{replace=false}={})=>{
  const hash=appRouteHash(next),normalized=parseAppRoute(hash);
  if(window.location.hash!==hash)window.history[replace?'replaceState':'pushState'](null,'',hash);
  setRoute(normalized);
 },[]);
 return [route,navigate];
}
