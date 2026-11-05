// Next's internal URL can be 0.0.0.0 while the browser uses localhost.
// Match the HTTP Host, not arbitrary forwarded headers or a wildcard allowlist.
export function allowedRequest(request,env=process.env){
 if(request.headers.get('x-sl-client')!=='1'||!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return false;
 if(request.headers.get('sec-fetch-site')==='cross-site')return false;
 try{
  const value=request.headers.get('origin');if(!value||value==='null')return false;
  const origin=new URL(value),internal=new URL(request.url);
  if(!['http:','https:'].includes(origin.protocol)||origin.origin!==value)return false;
  const host=request.headers.get('host')||internal.host;
  if(!host||/[\s,/@?#\\]/.test(host))return false;
  const protocol=env.VERCEL==='1'?'https:':internal.protocol;
  const target=new URL(protocol+'//'+host);
  return origin.origin===target.origin;
 }catch{return false;}
}
